from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re


BASE_DIR = Path(__file__).resolve().parents[1]
DATABASE_DIR = BASE_DIR / "database"
CASES_PATH = DATABASE_DIR / "reports.json"
GOVERNANCE_LOG_PATH = DATABASE_DIR / "governance_log.json"
DATA_DICTIONARY_PATH = DATABASE_DIR / "data_dictionary.json"
RULES_PATH = Path(__file__).resolve().parent / "moderation_rules.json"


app = FastAPI(title="Why was my post removed? MVS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "Why was my post removed? API",
        "message": "Backend is running. Open frontend/index.html for the prototype interface.",
        "docs": "/docs",
        "endpoints": [
            "/api/system",
            "/api/reports",
            "/api/rules",
            "/api/data-dictionary",
            "/api/governance-log",
            "/api/appeals",
        ],
    }


class RemovalCaseInput(BaseModel):
    platform: str = Field(min_length=1)
    postTitle: str = Field(min_length=1)
    contentType: str = "video"
    creatorName: str = ""
    anonymous: bool = True
    contentSummary: str = ""
    contextLocation: str = ""
    removalNotice: str = ""
    creatorType: str = "independent creator"
    accountImpact: str = "post removed"
    userReportSignal: str = "unknown"
    appealGoal: str = "restore post"
    identityRisk: bool = False
    consentGiven: bool = False
    language: str = "English"
    evidenceAvailable: list[str] = Field(default_factory=list)


class RuleUpdate(BaseModel):
    actor: str = "independent_review_collective"
    reason: str
    rules: dict[str, Any]


class AppealInput(BaseModel):
    reportId: int
    writtenStatement: str = ""
    backgroundContext: str = ""
    supportingMaterials: str = ""
    requestHumanReview: bool = True
    requestedBy: str = "creator"


class ResolveInput(BaseModel):
    finalDecision: str = "overturned"
    reason: str = "Case reviewed and resolved."
    requestedBy: str = "creator"


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def find_policy_match(text: str, policy_signals: dict[str, list[str]]) -> tuple[str, list[str]]:
    best_category = "unclear_or_generic_guidelines"
    best_hits: list[str] = []

    for category, keywords in policy_signals.items():
        hits = [word for word in keywords if word.lower() in text]
        if len(hits) > len(best_hits):
            best_category = category
            best_hits = hits

    return best_category, best_hits


def find_flagged_content_parts(case: dict[str, Any], policy_signals: dict[str, list[str]]) -> list[str]:
    fields = {
        "post title": case.get("postTitle", ""),
        "content summary": case.get("contentSummary", ""),
        "platform notice": case.get("removalNotice", ""),
        "account impact": case.get("accountImpact", ""),
    }
    flagged_parts: list[str] = []

    for label, value in fields.items():
        lowered = value.lower()
        for category, keywords in policy_signals.items():
            hits = [word for word in keywords if word.lower() in lowered]
            if hits:
                flagged_parts.append(f"{label}: {', '.join(hits)} ({category})")

    return flagged_parts or ["No specific flagged parts detected; the platform notice may be too vague."]


def decide_review_path(
    case: dict[str, Any],
    policy_hits: list[str],
    context_hits: list[str],
    impact_hits: list[str],
) -> str:
    if context_hits or case.get("identityRisk") or impact_hits:
        return "human_review_recommended"
    if policy_hits:
        return "automated_policy_match_detected"
    return "unclear_notice_requires_platform_explanation"


def infer_moderation_source(case: dict[str, Any]) -> dict[str, str]:
    notice = f"{case.get('removalNotice', '')} {case.get('accountImpact', '')}".lower()
    user_report_signal = case.get("userReportSignal", "unknown")

    if user_report_signal == "yes" or any(term in notice for term in ["reported by users", "user reports", "reported this content", "multiple reports"]):
        return {
            "source": "user_reports_possible",
            "confidence": "medium",
            "explanation": "The notice or case information suggests user reports may have contributed, but the platform would need to confirm this.",
        }

    if any(term in notice for term in ["automated", "detected by our systems", "our systems detected", "machine learning", "automatically removed"]):
        return {
            "source": "automated_system_likely",
            "confidence": "medium",
            "explanation": "The notice uses system-detection language, so the decision may have been made or triggered by automated moderation.",
        }

    if any(term in notice for term in ["reviewed by our team", "human review", "moderator reviewed", "after review"]):
        return {
            "source": "human_review_claimed",
            "confidence": "medium",
            "explanation": "The notice claims review language, but the platform should still explain what evidence the reviewer used.",
        }

    return {
        "source": "unknown",
        "confidence": "low",
        "explanation": "The platform notice does not clearly say whether the decision came from automation, user reports, or human review.",
    }


def build_appeal_options(
    case: dict[str, Any],
    policy_match: str,
    context_hits: list[str],
    impact_hits: list[str],
) -> list[str]:
    options = [
        "request a specific policy citation",
        "ask for human review",
        "submit a context statement explaining intent and audience",
    ]

    if context_hits:
        options.append("argue that the post is educational, documentary, satirical, or advocacy content")
    if impact_hits:
        options.append("ask the platform to remove account-level penalties if the decision was wrong")
    if case.get("identityRisk"):
        options.append("request privacy-sensitive handling because the case involves identity or safety risk")
    if policy_match == "unclear_or_generic_guidelines":
        options.append("challenge the vague notice and ask what exact content element violated the rule")

    return options


def describe_decision_type(review_path: str) -> str:
    if review_path == "human_review_recommended":
        return "Automated or unclear decision; human review is recommended because context matters."
    if review_path == "automated_policy_match_detected":
        return "Likely automated policy match based on detectable rule signals."
    return "Unclear from the platform notice; the user should request a specific explanation."


def build_transparency_panel(
    case: dict[str, Any],
    policy_match: str,
    flagged_parts: list[str],
    review_path: str,
    appeal_options: list[str],
    moderation_source: dict[str, str],
) -> dict[str, Any]:
    user_report_signal = case.get("userReportSignal", "unknown")
    if user_report_signal == "yes":
        report_text = "The platform notice suggests user reports may have been involved."
    elif user_report_signal == "no":
        report_text = "No user reports were mentioned in the information provided."
    else:
        report_text = "Unknown. The platform notice did not clearly say whether user reports were involved."

    return {
        "whatHappened": f"{case.get('platform')} removed or restricted this {case.get('contentType')} and the account impact is: {case.get('accountImpact')}.",
        "triggeredRule": policy_match,
        "decisionType": describe_decision_type(review_path),
        "moderationSource": moderation_source,
        "userReportsInvolved": report_text,
        "evidenceUsed": flagged_parts,
        "nextSteps": appeal_options,
    }


def generate_appeal(case: dict[str, Any], policy_match: str, context_hits: list[str]) -> str:
    platform = case.get("platform", "the platform")
    goal = case.get("appealGoal", "restore the post")
    context_sentence = ""
    if context_hits:
        context_sentence = f" The post should be reviewed in context because it appears to involve {', '.join(context_hits)}."

    return (
        f"I am appealing this moderation decision on {platform}. "
        f"My goal is to {goal}. The removed content was a {case.get('contentType', 'post')} titled "
        f"'{case.get('postTitle', '')}'. The likely policy area appears to be {policy_match}, "
        "but the notice did not provide enough specific explanation for me to understand or correct the issue."
        f"{context_sentence} I request a human review, a specific policy citation, and restoration or a clear explanation "
        "of what exact element violated the rule."
    )


def build_privacy_warnings(case: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    combined_text = f"{case.get('contentSummary', '')} {case.get('removalNotice', '')}"
    location = case.get("contextLocation", "")

    if case.get("anonymous", True):
        warnings.append("Anonymous submission enabled.")
    else:
        warnings.append("Name or creator alias will be visible in this case record.")

    if re.search(r"\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b", combined_text, re.IGNORECASE):
        warnings.append("Possible email address detected in the description or notice.")

    if re.search(r"\b(?:\+?\d[\s-]?){8,}\b", combined_text):
        warnings.append("Possible phone number detected in the description or notice.")

    if re.search(
        r"\b\d+\s+[a-z0-9\s]+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b",
        location,
        re.IGNORECASE,
    ):
        warnings.append("Location may be too specific. Use an approximate area instead.")
    elif location:
        warnings.append("Location is approximate.")
    else:
        warnings.append("No location provided. This supports data minimization.")

    return warnings


def explain_case(case: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any]:
    if not case.get("consentGiven"):
        raise HTTPException(status_code=400, detail="Consent is required before storing a case.")

    if case.get("anonymous", True):
        case["creatorName"] = "Anonymous creator"

    privacy_warnings = build_privacy_warnings(case)
    text = (
        f"{case.get('platform', '')} {case.get('postTitle', '')} {case.get('contentType', '')} "
        f"{case.get('contentSummary', '')} {case.get('removalNotice', '')} {case.get('accountImpact', '')}"
    ).lower()
    policy_match, policy_hits = find_policy_match(text, rules.get("policy_signals", {}))
    context_hits = [word for word in rules.get("context_restorers", []) if word.lower() in text]
    impact_hits = [word for word in rules.get("high_impact_outcomes", []) if word.lower() in text]
    flagged_content_parts = find_flagged_content_parts(case, rules.get("policy_signals", {}))
    review_path = decide_review_path(case, policy_hits, context_hits, impact_hits)
    appeal_options = build_appeal_options(case, policy_match, context_hits, impact_hits)
    moderation_source = infer_moderation_source(case)
    transparency_panel = build_transparency_panel(
        case,
        policy_match,
        flagged_content_parts,
        review_path,
        appeal_options,
        moderation_source,
    )

    score = 2
    explanation_parts = []

    if policy_hits:
        score += min(len(policy_hits), 3)
        explanation_parts.append(f"matched likely policy signals: {', '.join(policy_hits)}")
    else:
        explanation_parts.append("the platform notice appears vague or generic")

    if context_hits:
        score += 3
        explanation_parts.append(f"context may support appeal: {', '.join(context_hits)}")

    if impact_hits:
        score += 2
        explanation_parts.append(f"high-impact account outcome detected: {', '.join(impact_hits)}")

    if case.get("identityRisk"):
        score += 1
        explanation_parts.append("case includes identity or safety risk, so privacy should be protected")

    if score >= 7:
        appeal_strength = "strong"
    elif score >= 4:
        appeal_strength = "moderate"
    else:
        appeal_strength = "needs_more_evidence"

    required_evidence = rules.get("appeal_evidence", [])
    available = set(case.get("evidenceAvailable", []))
    recommended = [item for item in required_evidence if item not in available][:4]

    return {
        **case,
        "id": int(datetime.now().timestamp() * 1000),
        "status": "appeal_draft_ready",
        "createdAt": now_iso(),
        "resolvedAt": None,
        "retentionState": "active_review",
        "personalDataDeletionDue": None,
        "flagged": case.get("identityRisk", False) or bool(impact_hits),
        "policyCategory": policy_match,
        "likelyPolicyMatch": policy_match,
        "reviewPath": review_path,
        "moderationSource": moderation_source,
        "flaggedContentParts": flagged_content_parts,
        "appealOptions": appeal_options,
        "transparencyPanel": transparency_panel,
        "appeals": [],
        "finalDecision": None,
        "finalDecisionReason": None,
        "explanationScore": score,
        "appealStrength": appeal_strength,
        "moderationExplanation": "; ".join(explanation_parts),
        "privacyWarnings": privacy_warnings,
        "recommendedEvidence": recommended,
        "appealDraft": generate_appeal(case, policy_match, context_hits),
    }


def apply_retention_policy(cases: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    now = datetime.now(timezone.utc)

    for case in cases:
        if case.get("status") != "resolved":
            case["retentionState"] = "active_review"
            continue

        resolved_at = parse_iso(case.get("resolvedAt"))
        if not resolved_at:
            case["retentionState"] = "resolved_waiting_for_deletion_window"
            continue

        deletion_due = resolved_at + timedelta(days=60)
        case["personalDataDeletionDue"] = deletion_due.date().isoformat()

        if now >= deletion_due and case.get("retentionState") != "personal_data_deleted":
            case["creatorName"] = "Deleted after retention period"
            case["contentSummary"] = "Deleted after retention period"
            case["contextLocation"] = "Deleted after retention period"
            case["removalNotice"] = "Deleted after retention period"
            case["identityRisk"] = False
            case["privacyWarnings"] = ["Personal and identifying information deleted after 60-day retention period."]
            case["retentionState"] = "personal_data_deleted"
            changed = True
        else:
            case["retentionState"] = "resolved_waiting_for_deletion_window"

    return cases, changed


@app.get("/api/system")
def get_system_overview():
    return {
        "name": "Why was my post removed?",
        "inequality": "Social media takedown and appeal systems are opaque, platform-controlled, and harder to navigate for marginalized or small creators.",
        "principles": [
            "transparent explanations",
            "independent appeal support",
            "privacy for vulnerable creators",
            "data minimization and explicit consent",
            "60-day deletion after resolution",
            "context-aware moderation",
            "accountability beyond the platform",
        ],
    }


@app.get("/api/reports")
def get_cases():
    cases = read_json(CASES_PATH, [])
    cases, changed = apply_retention_policy(cases)
    if changed:
        write_json(CASES_PATH, cases)
    return cases


@app.post("/api/reports")
def create_case(case: RemovalCaseInput):
    cases = read_json(CASES_PATH, [])
    rules = read_json(RULES_PATH, {})
    explained_case = explain_case(case.model_dump(), rules)
    cases.append(explained_case)
    write_json(CASES_PATH, cases)
    return explained_case


@app.post("/api/reports/{case_id}/resolve")
def resolve_case(case_id: int, resolution: ResolveInput):
    cases = read_json(CASES_PATH, [])
    target = next((case for case in cases if case.get("id") == case_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Case not found.")

    target["status"] = "resolved"
    target["finalDecision"] = resolution.finalDecision
    target["finalDecisionReason"] = resolution.reason
    target["resolvedAt"] = now_iso()
    target["retentionState"] = "resolved_waiting_for_deletion_window"
    resolved_at = parse_iso(target["resolvedAt"])
    if resolved_at:
        target["personalDataDeletionDue"] = (resolved_at + timedelta(days=60)).date().isoformat()

    write_json(CASES_PATH, cases)

    log = read_json(GOVERNANCE_LOG_PATH, [])
    log.append(
        {
            "id": len(log) + 1,
            "actor": resolution.requestedBy,
            "action": "final_decision_recorded",
            "reason": f"Case {case_id}: {resolution.finalDecision} - {resolution.reason}",
            "timestamp": now_iso(),
        }
    )
    write_json(GOVERNANCE_LOG_PATH, log)
    return target


@app.get("/api/rules")
def get_rules():
    return read_json(RULES_PATH, {})


@app.post("/api/rules")
def update_rules(update: RuleUpdate):
    write_json(RULES_PATH, update.rules)
    log = read_json(GOVERNANCE_LOG_PATH, [])
    log.append(
        {
            "id": len(log) + 1,
            "actor": update.actor,
            "action": "updated_explanation_rules",
            "reason": update.reason,
            "timestamp": now_iso(),
        }
    )
    write_json(GOVERNANCE_LOG_PATH, log)
    return {"status": "rules_updated", "rules": update.rules}


@app.get("/api/governance-log")
def get_governance_log():
    return read_json(GOVERNANCE_LOG_PATH, [])


@app.get("/api/data-dictionary")
def get_data_dictionary():
    return read_json(DATA_DICTIONARY_PATH, {})


@app.post("/api/appeals")
def create_appeal(appeal: AppealInput):
    cases = read_json(CASES_PATH, [])
    target = next((case for case in cases if case.get("id") == appeal.reportId), None)
    if not target:
        raise HTTPException(status_code=404, detail="Case not found.")

    appeal_record = {
        "id": int(datetime.now().timestamp() * 1000),
        "writtenStatement": appeal.writtenStatement,
        "backgroundContext": appeal.backgroundContext,
        "supportingMaterials": appeal.supportingMaterials,
        "requestHumanReview": appeal.requestHumanReview,
        "status": "human_review_requested" if appeal.requestHumanReview else "submitted",
        "submittedAt": now_iso(),
    }
    target.setdefault("appeals", []).append(appeal_record)
    target["status"] = "appeal_submitted"
    write_json(CASES_PATH, cases)

    log = read_json(GOVERNANCE_LOG_PATH, [])
    log.append(
        {
            "id": len(log) + 1,
            "actor": appeal.requestedBy,
            "action": "creator_submitted_appeal",
            "reason": f"Case {appeal.reportId}: {appeal.writtenStatement or 'Appeal submitted.'}",
            "timestamp": now_iso(),
        }
    )
    write_json(GOVERNANCE_LOG_PATH, log)
    return {"status": "appeal_logged"}
