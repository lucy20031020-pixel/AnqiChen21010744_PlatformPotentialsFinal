const API = "http://127.0.0.1:8000/api";
const GUIDELINES_KEY = "whyRemovedGuidelinesAccepted";
const LOCAL_REPORTS_KEY = "whyRemovedLocalReports";
const LOCAL_GOVERNANCE_KEY = "whyRemovedLocalGovernanceLog";
const USE_LOCAL_BACKEND = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const STATIC_DATA_PATHS = {
  "/reports": "./data/reports.json",
  "/rules": "./data/moderation_rules.json",
  "/data-dictionary": "./data/data_dictionary.json",
  "/governance-log": "./data/governance_log.json",
};

let currentReports = [];

const fallbackSystem = {
  principles: [
    "transparent explanations",
    "independent appeal support",
    "privacy for vulnerable creators",
    "context-aware moderation",
    "accountability beyond the platform",
  ],
};

const fallbackReports = [
  {
    id: 1,
    platform: "TikTok",
    postTitle: "Documenting a peaceful protest",
    contentType: "video",
    creatorName: "Anonymous creator",
    anonymous: true,
    contextLocation: "Main street near campus",
    creatorType: "student journalist",
    accountImpact: "account warning",
    userReportSignal: "unknown",
    identityRisk: true,
    consentGiven: true,
    status: "appeal_draft_ready",
    retentionState: "active_review",
    personalDataDeletionDue: null,
    flagged: true,
    explanationScore: 8,
    appealStrength: "strong",
    reviewPath: "human_review_recommended",
    moderationSource: {
      source: "unknown",
      confidence: "low",
      explanation: "The platform notice does not clearly say whether the decision came from automation, user reports, or human review.",
    },
    flaggedContentParts: ["removal notice: safety", "content summary: protest"],
    appealOptions: ["request human review", "ask for specific policy citation", "submit context statement"],
    transparencyPanel: {
      whatHappened: "TikTok removed or restricted this video and the account impact is: account warning.",
      triggeredRule: "violence_or_safety",
      decisionType: "Automated or unclear decision; human review is recommended because context matters.",
      moderationSource: {
        source: "unknown",
        confidence: "low",
        explanation: "The platform notice does not clearly say whether the decision came from automation, user reports, or human review.",
      },
      userReportsInvolved: "Unknown. The platform notice did not clearly say whether user reports were involved.",
      evidenceUsed: ["removal notice: safety", "content summary: protest"],
      nextSteps: ["request human review", "ask for specific policy citation", "submit context statement"],
    },
    appeals: [],
    finalDecision: null,
    finalDecisionReason: null,
    privacyWarnings: ["Anonymous submission enabled.", "Location is approximate."],
    likelyPolicyMatch: "violence_or_safety",
    moderationExplanation:
      "The platform notice likely matched safety or violence rules, but the content summary includes civic documentation context.",
    recommendedEvidence: ["original caption", "platform notice screenshot", "context statement"],
    appealDraft:
      "I am appealing this removal because the post documents a peaceful public event and does not encourage violence or dangerous acts.",
  },
];

async function request(path, options) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

async function loadJson(path, fallback) {
  if (USE_LOCAL_BACKEND) {
    try {
      const data = await request(path);
      document.querySelector("#apiStatus").textContent = "Backend connected. Explanation logic is live.";
      return data;
    } catch {
      document.querySelector("#apiStatus").textContent = "Static mode. Changes are saved in this browser.";
    }
  }

  const data = await loadStaticJson(path, fallback);
  document.querySelector("#apiStatus").textContent = "Static mode. Changes are saved in this browser.";
  return data;
}

async function loadStaticJson(path, fallback) {
  if (path === "/system") return fallbackSystem;

  const staticPath = STATIC_DATA_PATHS[path];
  if (!staticPath) return fallback;

  try {
    const response = await fetch(staticPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Static data error ${response.status}`);
    const data = await response.json();
    if (path === "/reports") return mergeById(data, getLocalReports());
    if (path === "/governance-log") return [...data, ...getLocalGovernanceLog()];
    return data;
  } catch {
    if (path === "/reports") return mergeById(fallback, getLocalReports());
    if (path === "/governance-log") return getLocalGovernanceLog();
    return fallback;
  }
}

function readLocalArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalReports() {
  return readLocalArray(LOCAL_REPORTS_KEY);
}

function saveLocalReport(report) {
  const reports = getLocalReports();
  const index = reports.findIndex((item) => item.id === report.id);
  if (index >= 0) reports[index] = report;
  else reports.push(report);
  writeLocalArray(LOCAL_REPORTS_KEY, reports);
}

function getLocalGovernanceLog() {
  return readLocalArray(LOCAL_GOVERNANCE_KEY);
}

function addLocalGovernanceEvent(action, reason, actor = "creator") {
  const events = getLocalGovernanceLog();
  events.push({
    id: Date.now(),
    actor,
    action,
    reason,
    timestamp: new Date().toISOString(),
  });
  writeLocalArray(LOCAL_GOVERNANCE_KEY, events);
}

function mergeById(baseItems, localItems) {
  const merged = new Map();
  baseItems.forEach((item) => merged.set(item.id, item));
  localItems.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function findCurrentReport(reportId) {
  return currentReports.find((report) => report.id === reportId);
}

function renderPrinciples(system) {
  const container = document.querySelector("#principles");
  container.innerHTML = `
    <p class="eyebrow">Design principles</p>
    ${(system.principles || fallbackSystem.principles)
      .map((principle) => `<div class="principle"><strong>${principle}</strong></div>`)
      .join("")}
  `;
}

function renderReports(reports) {
  currentReports = reports;
  const container = document.querySelector("#reports");
  container.innerHTML = reports
    .slice()
    .reverse()
    .map((report) => {
      const panel = buildTransparencyPanel(report);
      return `
        <article class="report-card ${report.flagged ? "flagged" : ""}">
          <h3>${report.postTitle}</h3>
          <div class="meta">
            <span class="pill">${report.platform}</span>
            <span class="pill">${report.contentType}</span>
            <span class="pill blue">${report.likelyPolicyMatch}</span>
            <span class="pill blue">appeal: ${report.appealStrength}</span>
            ${report.flagged ? '<span class="pill red">privacy-sensitive</span>' : ""}
          </div>
          <p><strong>Account impact:</strong> ${report.accountImpact || "not provided"}</p>
          <p><strong>Approximate context:</strong> ${report.contextLocation || "not provided"}</p>
          <p><strong>Retention:</strong> ${report.retentionState || "active_review"}${
            report.personalDataDeletionDue ? ` | personal data deletion due: ${report.personalDataDeletionDue}` : ""
          }</p>

          <div class="transparency-panel">
            <strong>Transparency panel</strong>
            <dl>
              <dt>What happened</dt>
              <dd>${panel.whatHappened}</dd>
              <dt>Triggered rule</dt>
              <dd>${panel.triggeredRule}</dd>
              <dt>Decision type</dt>
              <dd>${panel.decisionType}</dd>
              <dt>Likely source</dt>
              <dd>${formatModerationSource(panel.moderationSource)}</dd>
              <dt>User reports</dt>
              <dd>${panel.userReportsInvolved}</dd>
              <dt>Evidence or content parts used</dt>
              <dd><ul>${panel.evidenceUsed.map((item) => `<li>${item}</li>`).join("")}</ul></dd>
              <dt>What you can do next</dt>
              <dd><ul>${panel.nextSteps.map((item) => `<li>${item}</li>`).join("")}</ul></dd>
            </dl>
          </div>

          <p><strong>Detailed explanation:</strong> ${report.moderationExplanation}</p>
          <div class="privacy-warnings">
            <strong>Privacy check</strong>
            <ul>
              ${(report.privacyWarnings || ["No extra privacy warnings detected."])
                .map((warning) => `<li>${warning}</li>`)
                .join("")}
            </ul>
          </div>
          <p><strong>Evidence to add:</strong> ${(report.recommendedEvidence || []).join(", ") || "none"}</p>
          <div class="appeal-draft">
            <strong>Appeal draft</strong>
            <p>${report.appealDraft}</p>
          </div>
          <div class="appeal-status">
            <strong>Appeal status</strong>
            ${renderAppeals(report.appeals || [])}
            ${renderFinalDecision(report)}
          </div>
          <small>ID ${report.id} | ${report.creatorName || "Anonymous creator"} | ${report.creatorType} | score ${report.explanationScore}</small>
        </article>
      `;
    })
    .join("");
}

function buildTransparencyPanel(report) {
  if (report.transparencyPanel) return report.transparencyPanel;
  return {
    whatHappened: `${report.platform || "The platform"} removed or restricted this ${report.contentType || "post"} and the account impact is: ${report.accountImpact || "not provided"}.`,
    triggeredRule: report.likelyPolicyMatch || "unclear_or_generic_guidelines",
    decisionType: report.reviewPath || "automated explanation only",
    moderationSource: report.moderationSource || inferLocalModerationSource(report),
    userReportsInvolved: report.userReportSignal === "yes"
      ? "The platform notice suggests user reports may have been involved."
      : report.userReportSignal === "no"
        ? "No user reports were mentioned in the information provided."
        : "Unknown. The platform notice did not clearly say whether user reports were involved.",
    evidenceUsed: report.flaggedContentParts || ["No specific flagged parts detected."],
    nextSteps: report.appealOptions || ["Request a clearer explanation from the platform."],
  };
}

function formatModerationSource(source) {
  if (!source) return "Unknown. The platform did not provide enough information.";
  return `${source.source} (${source.confidence} confidence). ${source.explanation}`;
}

function renderAppeals(appeals) {
  if (!appeals.length) return "<p>No appeal submitted yet.</p>";
  return `
    <ul>
      ${appeals
        .map(
          (appeal) => `
          <li>
            ${appeal.status}: ${appeal.writtenStatement || "Appeal submitted."}
            ${appeal.requestHumanReview ? " Human review requested." : ""}
          </li>
        `
        )
        .join("")}
    </ul>
  `;
}

function renderFinalDecision(report) {
  if (!report.finalDecision) return "<p>Final decision has not been recorded.</p>";
  return `<p><strong>Final decision:</strong> ${report.finalDecision}. ${report.finalDecisionReason || ""}</p>`;
}

function renderRules(rules) {
  const container = document.querySelector("#rules");
  container.innerHTML = Object.entries(rules)
    .map(([key, value]) => {
      const text = typeof value === "object" ? JSON.stringify(value, null, 2) : value;
      return `<div class="rule"><strong>${key}</strong><pre>${text}</pre></div>`;
    })
    .join("");
}

function renderDictionary(dictionary) {
  const container = document.querySelector("#dictionary");
  container.innerHTML = Object.entries(dictionary)
    .map(
      ([field, details]) => `
      <div class="field">
        <strong>${field}</strong>
        <p>${details.purpose}</p>
        <small>Access: ${details.access} | Risk: ${details.risk}</small>
      </div>
    `
    )
    .join("");
}

function renderGovernanceLog(events) {
  const container = document.querySelector("#governanceLog");
  container.innerHTML = events
    .slice()
    .reverse()
    .map(
      (event) => `
      <div class="event">
        <strong>${event.action}</strong>
        <p>${event.reason}</p>
        <small>${event.actor} | ${event.timestamp}</small>
      </div>
    `
    )
    .join("");
}

function formToReport(form) {
  const data = new FormData(form);
  return {
    platform: data.get("platform"),
    postTitle: data.get("postTitle"),
    contentType: data.get("contentType"),
    creatorName: data.get("anonymous") === "on" ? "Anonymous creator" : data.get("creatorName"),
    anonymous: data.get("anonymous") === "on",
    contentSummary: data.get("contentSummary"),
    contextLocation: data.get("contextLocation"),
    removalNotice: data.get("removalNotice"),
    creatorType: data.get("creatorType"),
    accountImpact: data.get("accountImpact"),
    userReportSignal: data.get("userReportSignal"),
    appealGoal: data.get("appealGoal"),
    identityRisk: data.get("identityRisk") === "on",
    consentGiven: data.get("consentGiven") === "on",
    language: data.get("language"),
    evidenceAvailable: data.getAll("evidence"),
  };
}

async function refresh() {
  const [system, reports, rules, dictionary, log] = await Promise.all([
    loadJson("/system", fallbackSystem),
    loadJson("/reports", fallbackReports),
    loadJson("/rules", {}),
    loadJson("/data-dictionary", {}),
    loadJson("/governance-log", []),
  ]);
  renderPrinciples(system);
  renderReports(reports);
  renderRules(rules);
  renderDictionary(dictionary);
  renderGovernanceLog(log);
}

document.querySelector("#reportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const report = formToReport(event.currentTarget);
  try {
    if (!USE_LOCAL_BACKEND) throw new Error("Static mode");
    await request("/reports", {
      method: "POST",
      body: JSON.stringify(report),
    });
    await refresh();
  } catch {
    const localReport = {
      ...report,
      id: Date.now(),
      status: "appeal_draft_ready",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      retentionState: "active_review",
      personalDataDeletionDue: null,
      flagged: report.identityRisk,
      explanationScore: report.identityRisk ? 6 : 4,
      privacyWarnings: buildLocalPrivacyWarnings(report),
      reviewPath: report.identityRisk ? "human_review_recommended" : "automated_explanation",
      moderationSource: inferLocalModerationSource(report),
      flaggedContentParts: buildLocalFlaggedParts(report),
      appealOptions: buildLocalAppealOptions(report),
      transparencyPanel: buildLocalTransparencyPanel(report),
      appeals: [],
      finalDecision: null,
      finalDecisionReason: null,
      appealStrength: report.contentSummary.includes("documentation") ? "strong" : "moderate",
      likelyPolicyMatch: report.removalNotice.includes("safety") ? "violence_or_safety" : "unclear_or_generic_guidelines",
      recommendedEvidence: ["platform notice screenshot", "original caption", "context statement"],
      moderationExplanation: "Local fallback: backend not running, so this is a simulated explanation.",
      appealDraft:
        "I am appealing this removal because the notice is too vague to understand the exact violation. Please provide a specific policy citation and review the post in context.",
    };
    saveLocalReport(localReport);
    addLocalGovernanceEvent("local_case_created", `Case ${localReport.id}: ${localReport.postTitle}`);
    await refresh();
  }
});

function buildLocalPrivacyWarnings(report) {
  const warnings = [];
  const combinedText = `${report.contentSummary || ""} ${report.removalNotice || ""}`;
  const location = report.contextLocation || "";

  if (report.anonymous) {
    warnings.push("Anonymous submission enabled.");
  } else {
    warnings.push("Name or creator alias will be visible in this case record.");
  }

  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(combinedText)) {
    warnings.push("Possible email address detected in the description or notice.");
  }

  if (/\b(?:\+?\d[\s-]?){8,}\b/.test(combinedText)) {
    warnings.push("Possible phone number detected in the description or notice.");
  }

  if (/\b\d+\s+[a-z0-9\s]+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i.test(location)) {
    warnings.push("Location may be too specific. Use an approximate area instead.");
  } else {
    warnings.push("Location is approximate.");
  }

  return warnings;
}

function buildLocalFlaggedParts(report) {
  const parts = [];
  const combined = `${report.postTitle || ""} ${report.contentSummary || ""} ${report.removalNotice || ""}`.toLowerCase();
  ["safety", "sexual", "body", "protest", "violence", "harassment", "misinformation"].forEach((term) => {
    if (combined.includes(term)) parts.push(`possible signal: ${term}`);
  });
  return parts.length ? parts : ["No specific flagged parts detected."];
}

function buildLocalAppealOptions(report) {
  const options = ["request a specific policy citation", "ask for human review"];
  if ((report.contentSummary || "").toLowerCase().includes("documentation")) {
    options.push("submit public-interest or documentation context");
  }
  if (report.identityRisk) {
    options.push("request privacy-sensitive handling of the appeal");
  }
  return options;
}

function buildLocalTransparencyPanel(report) {
  const flaggedParts = buildLocalFlaggedParts(report);
  const appealOptions = buildLocalAppealOptions(report);
  return {
    whatHappened: `${report.platform} removed or restricted this ${report.contentType}; account impact: ${report.accountImpact}.`,
    triggeredRule: report.removalNotice.includes("safety") ? "violence_or_safety" : "unclear_or_generic_guidelines",
    decisionType: report.identityRisk ? "Human review is recommended because context or identity risk may matter." : "Likely automated explanation based on visible policy signals.",
    moderationSource: inferLocalModerationSource(report),
    userReportsInvolved: report.userReportSignal === "yes"
      ? "The platform notice suggests user reports may have been involved."
      : report.userReportSignal === "no"
        ? "No user reports were mentioned."
        : "Unknown. The platform notice did not say whether user reports were involved.",
    evidenceUsed: flaggedParts,
    nextSteps: appealOptions,
  };
}

function inferLocalModerationSource(report) {
  const notice = `${report.removalNotice || ""} ${report.accountImpact || ""}`.toLowerCase();
  if (report.userReportSignal === "yes" || ["reported by users", "user reports", "reported this content", "multiple reports"].some((term) => notice.includes(term))) {
    return {
      source: "user_reports_possible",
      confidence: "medium",
      explanation: "The notice or case information suggests user reports may have contributed, but the platform would need to confirm this.",
    };
  }
  if (["automated", "detected by our systems", "our systems detected", "machine learning", "automatically removed"].some((term) => notice.includes(term))) {
    return {
      source: "automated_system_likely",
      confidence: "medium",
      explanation: "The notice uses system-detection language, so the decision may have been made or triggered by automated moderation.",
    };
  }
  if (["reviewed by our team", "human review", "moderator reviewed", "after review"].some((term) => notice.includes(term))) {
    return {
      source: "human_review_claimed",
      confidence: "medium",
      explanation: "The notice claims review language, but the platform should still explain what evidence the reviewer used.",
    };
  }
  return {
    source: "unknown",
    confidence: "low",
    explanation: "The platform notice does not clearly say whether the decision came from automation, user reports, or human review.",
  };
}

document.querySelector("#appealForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const reportId = Number(data.get("reportId"));
  const appealRecord = {
    id: Date.now(),
    writtenStatement: data.get("writtenStatement"),
    backgroundContext: data.get("backgroundContext"),
    supportingMaterials: data.get("supportingMaterials"),
    requestHumanReview: data.get("requestHumanReview") === "on",
    status: data.get("requestHumanReview") === "on" ? "human_review_requested" : "submitted",
    submittedAt: new Date().toISOString(),
  };

  try {
    if (!USE_LOCAL_BACKEND) throw new Error("Static mode");
    await request("/appeals", {
      method: "POST",
      body: JSON.stringify({
        reportId,
        writtenStatement: appealRecord.writtenStatement,
        backgroundContext: appealRecord.backgroundContext,
        supportingMaterials: appealRecord.supportingMaterials,
        requestHumanReview: appealRecord.requestHumanReview,
        requestedBy: "creator",
      }),
    });
    event.currentTarget.reset();
    await refresh();
  } catch {
    const report = findCurrentReport(reportId);
    if (!report) {
      document.querySelector("#apiStatus").textContent = "Case ID not found.";
      return;
    }
    const updatedReport = {
      ...report,
      status: "appeal_submitted",
      appeals: [...(report.appeals || []), appealRecord],
    };
    saveLocalReport(updatedReport);
    addLocalGovernanceEvent("local_appeal_submitted", `Case ${reportId}: ${appealRecord.writtenStatement || "Appeal submitted."}`);
    event.currentTarget.reset();
    await refresh();
  }
});

document.querySelector("#resolveForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const reportId = Number(data.get("reportId"));
  try {
    if (!USE_LOCAL_BACKEND) throw new Error("Static mode");
    await request(`/reports/${reportId}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        finalDecision: data.get("finalDecision"),
        reason: data.get("reason") || "Case reviewed and resolved.",
        requestedBy: "creator",
      }),
    });
    event.currentTarget.reset();
    await refresh();
  } catch {
    const report = findCurrentReport(reportId);
    if (!report) {
      document.querySelector("#apiStatus").textContent = "Case ID not found.";
      return;
    }
    const resolvedAt = new Date();
    const deletionDue = new Date(resolvedAt);
    deletionDue.setDate(deletionDue.getDate() + 60);
    const updatedReport = {
      ...report,
      status: "resolved",
      finalDecision: data.get("finalDecision"),
      finalDecisionReason: data.get("reason") || "Case reviewed and resolved.",
      resolvedAt: resolvedAt.toISOString(),
      retentionState: "resolved_waiting_for_deletion_window",
      personalDataDeletionDue: deletionDue.toISOString().slice(0, 10),
    };
    saveLocalReport(updatedReport);
    addLocalGovernanceEvent(
      "local_final_decision_recorded",
      `Case ${reportId}: ${updatedReport.finalDecision} - ${updatedReport.finalDecisionReason}`
    );
    event.currentTarget.reset();
    await refresh();
  }
});

document.querySelector("#accessMode").addEventListener("change", (event) => {
  document.body.classList.toggle("accessible", event.target.checked);
});

function setupGuidelinesModal() {
  const modal = document.querySelector("#guidelinesModal");
  const acceptButton = document.querySelector("#acceptGuidelines");
  if (!modal || !acceptButton) return;

  if (localStorage.getItem(GUIDELINES_KEY) !== "true") {
    modal.hidden = false;
  }

  acceptButton.addEventListener("click", () => {
    localStorage.setItem(GUIDELINES_KEY, "true");
    modal.hidden = true;
  });
}

setupGuidelinesModal();
refresh();
