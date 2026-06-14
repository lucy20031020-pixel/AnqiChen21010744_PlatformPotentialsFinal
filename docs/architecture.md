# MVS Architecture: Why was my post removed?

## Layer 1: Inequality and Principles

The system addresses opaque social media moderation. Creators may have posts removed, hidden, demonetized, or restricted without receiving a clear explanation. The harm is unequal because small creators, activists, educators, sex workers, migrants, journalists, and marginalized communities often depend on platform visibility while also being more exposed to biased or context-blind moderation.

The prototype is based on five principles:

- Transparent explanations.
- Independent appeal support.
- Privacy for vulnerable creators.
- Context-aware moderation.
- Accountability beyond the platform.

## Layer 2: Creator Case Intake

The frontend collects a removal case rather than a civic incident report. The user records:

- Platform, such as TikTok, Red Notes, Instagram, or YouTube.
- Post type and post title.
- The platform's removal notice.
- A plain-language summary of what the post was actually about.
- Creator context and account impact.
- Whether identity or safety risk is involved.
- Evidence already available for appeal.

This demonstrates who the design is for: creators who need a clearer explanation and a more structured appeal process.

## Layer 3: Data Governance and Privacy

The database includes a data dictionary that explains each field's purpose, access level, and risk. The system intentionally stores a summary of the post rather than requiring the full media file. This reduces unnecessary collection of sensitive content.

Identity risk is treated as a privacy signal, not a ranking signal for deservingness.

The prototype implements three UK GDPR-related data principles:

- Data minimization: real names are optional, anonymous submission is enabled by default, and location/context should remain approximate.
- Consent: users must tick a consent checkbox before the backend stores a case.
- Retention limitation: unresolved cases can be kept during active review; once a case is marked `resolved`, personal or identifying information is deleted after 60 days.

## Layer 4: Explanation and Algorithmic Behaviour

The backend reads `moderation_rules.json` and applies:

- Policy-signal matching from vague platform notices and post summaries.
- Flagged-part explanation showing which fields matched policy signals.
- Monetization and fundraising-policy analysis for cases where removals are tied to donation language, ad revenue, or creator income.
- Review-path classification showing whether automated explanation is enough or human review is recommended.
- Moderation-source estimation showing whether the visible notice suggests automation, user reports, human review, or an unknown source.
- Transparency panel generation showing what happened, triggered rule, decision type, user report involvement, evidence used, and next steps.
- Context-restorer detection, such as education, news, satire, testimony, or advocacy.
- High-impact outcome detection, such as demonetization or account warnings.
- Appeal strength scoring.
- Appeal option generation, such as requesting human review, policy citation, or context-sensitive handling.
- Evidence checklist generation.
- Appeal draft generation.

The system does not claim to know the platform's true internal decision. It produces an explainable estimate that helps the user understand and contest the decision.

## Layer 5: Governance and Accountability

Rule updates and appeal submissions are written to `database/governance_log.json`. This simulates an independent accountability trail. In a fuller system, this layer could be governed by digital rights groups, creator unions, civil society reviewers, or platform accountability researchers.

The appeal flow accepts a written statement, background context, supporting materials, and a human review request. Final decisions are recorded with an outcome and reason so that the user is not left with another vague moderation message.

## Layer 6: Infrastructure and Independence

The system is designed as an add-on independent from any one platform. This matters because the same company that removes content should not be the only source of explanation or appeal support.

For a production version, this layer would need to specify:

- Where appeal data is hosted.
- How creator identities are protected.
- How multilingual access is supported.
- How evidence is encrypted or deleted.
- How the system avoids becoming another surveillance database.

## Data Flow

```text
Creator Interface
  -> POST /api/reports
  -> Backend explanation engine
  -> Policy match + context analysis + appeal scoring
  -> JSON case store
  -> Explanation, evidence checklist, and appeal draft returned to interface

Appeal and governance interface
  -> POST /api/appeals or POST /api/rules
  -> Independent governance log
```
