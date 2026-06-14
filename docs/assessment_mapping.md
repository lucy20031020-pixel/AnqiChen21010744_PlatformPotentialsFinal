# Assessment Mapping

## Clear Articulation of Inequality

The project addresses opaque and unequal content moderation on social platforms. It focuses on creators whose posts are removed, hidden, demonetized, or restricted without meaningful explanation.

## Multi-Layer System Design

The MVS includes:

- Governance: independent appeal log and rule-change log.
- Data flows: documented API flow from case intake to explanation output.
- Moderation: transparency panel, policy-signal matching, flagged content parts, user-report uncertainty, context analysis, appeal strength scoring.
- Privacy: identity-risk flag, limited media storage, private case records, default anonymity, explicit consent, and 60-day deletion after resolution.
- Accessibility: accessible display mode and plain-language explanations.
- Algorithmic behaviour: visible rules, explanation score, likely policy match, evidence checklist.

## High-Fidelity Prototype

The frontend is a clickable prototype where a creator can submit a removal case, see a transparency panel, receive an appeal strength estimate, submit a structured appeal, request human review, and receive a final decision with reasons.

## Implementation Logic

The FastAPI backend transforms user input into a structured moderation explanation. It stores cases, reads policy rules, detects context-restoring signals, scores appeal strength, and logs appeals.

## Equity Outcomes

The system supports:

- More transparent moderation decisions.
- Stronger appeal preparation for small or marginalized creators.
- Reduced dependence on platform-controlled explanations.
- Safer handling of identity-sensitive cases.
- Evidence-based accountability research across platforms.
