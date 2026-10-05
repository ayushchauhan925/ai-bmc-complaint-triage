# Future Scope

Improvements and new features that could be added to Civic Connect. The platform is complete and
deployed as it stands; everything here is **not built yet**. Items come from the project's known
limitations, from design discussions, and from what a real municipal rollout would need.

> Related: [`features.md`](features.md) (what exists today) · [`explain.md`](explain.md) (how it
> works, including honest limitations).

**Guiding rule for every item:** keep the principle *AI proposes, deterministic code decides,
humans stay in control*. New AI features should produce signals or advice; sensitive decisions stay
in tested, auditable code.

## Contents

1. [Priority overview](#1-priority-overview)
2. [Work assignment and field operations](#2-work-assignment-and-field-operations)
3. [Citizen experience and reach](#3-citizen-experience-and-reach)
4. [AI and intelligence](#4-ai-and-intelligence)
5. [Analytics and planning](#5-analytics-and-planning)
6. [Geography and maps](#6-geography-and-maps)
7. [Notifications and real time](#7-notifications-and-real-time)
8. [Accounts, security and compliance](#8-accounts-security-and-compliance)
9. [Administration and governance](#9-administration-and-governance)
10. [Integrations](#10-integrations)
11. [Platform, scale and reliability](#11-platform-scale-and-reliability)
12. [Quality, testing and accessibility](#12-quality-testing-and-accessibility)
13. [Suggested roadmap](#13-suggested-roadmap)

---

## 1. Priority overview

| Horizon | Theme | Examples |
|---|---|---|
| **Next (weeks)** | Close known gaps | Optional auto-assignment, forced password change, session invalidation, Devanagari PDFs, ward lookup from GPS |
| **Soon (1–3 months)** | Reach and operations | WhatsApp/IVR intake, crew work orders, SMS, real-time updates, job queue |
| **Later (3–12 months)** | Scale and intelligence | Seasonal forecasting, predictive maintenance, official-data integration, multi-city tenancy |

---

## 2. Work assignment and field operations

| Idea | What it adds | Notes |
|---|---|---|
| **Optional auto-assignment** | Assign the top-ranked officer automatically on submission | Admin setting, **off by default**. Reuse the existing ranking (same ward → fewest open → fewest critical → fewest SLA breaches → proximity). Skip complaints flagged for review. Show as "automatic" on the timeline and audit log; admin can always reassign. |
| **Field crew / work orders** | Officer assigns site work to lower-level employees | New crew role, work-order records, crew login, status per work order, photo proof per crew member. A lighter first step: a free-text "crew / work note" on the complaint. |
| **Contractor management** | Track outsourced repairs | Contractor records, cost estimates, completion proof, penalties for missed deadlines. |
| **Inventory and materials** | Record materials used per fix | Supports cost reporting and stock alerts. |
| **Routing for multi-stop days** | Efficient daily route for an officer or crew | Order nearby tasks by distance and priority. |
| **Offline-first field app** | Work without network | Installable PWA with a local queue that syncs when online. |
| **Shift and availability** | Do not assign to people who are off duty | Leave, shifts and holidays feed the officer ranking. |
| **Multi-department tasks** | Real coordination when two departments are involved | Today secondary departments are informational; add sub-tasks with their own owners and SLAs. |
| **Escalation chain** | Notify a supervisor when an officer misses a deadline | Configurable hierarchy (officer → ward head → department head). |
| **Department-admin role** | Department heads manage only their staff | Deliberately not built; add if the organisation needs it. |

---

## 3. Citizen experience and reach

| Idea | What it adds |
|---|---|
| **WhatsApp intake** | Report by sending a photo and a location pin, and get status replies on the same chat. |
| **IVR / voice complaints** | Call, speak in Hindi/Marathi, speech-to-text creates the complaint. |
| **SMS status updates** | Reach people without smartphones or data. |
| **Voice input in the form** | Dictate the description in the browser. |
| **Anonymous / guest reporting** | Report without an account, track with a code. |
| **Citizen upvotes / "me too"** | Confirm a nearby issue instead of filing a duplicate; strengthens the evidence score. |
| **Public issue map** | A citizen-facing map of open issues in their area (privacy-safe, no personal data). |
| **Photo guidance** | On-screen tips ("stand 2 m back, include a landmark") and a live blur warning. |
| **More languages** | Gujarati, Tamil, Bengali and others; extend the interface and the AI prompts. |
| **Native-speaker review** | Review the Hindi and Marathi strings with native speakers before wide release. |
| **Staff and landing-page translations** | Today only citizen screens are translated. |
| **Satisfaction and trust metrics** | Per-department citizen ratings shown publicly. |
| **Gamification and recognition** | Badges for active reporters; verified-reporter status. |
| **Citizen-confirmed closure window** | Auto-close if the citizen doesn't respond in N days, with a reminder first. |

---

## 4. AI and intelligence

| Idea | What it adds | Guardrail |
|---|---|---|
| **Reviewed, versioned evaluation set from staff corrections** | Turn human corrections into new labelled test cases | Never auto-retrain; humans approve what enters the set. |
| **Fine-tuned or distilled classifier** | Lower cost and latency for common categories | Keep the validated-schema output and the fallback path. |
| **Local / on-prem model option** | Data stays inside the city | Same interface as the current instrumented client. |
| **Better image models** | Detect damage size, severity and repair type from photos | Advisory only; evidence score still shows the measurement. |
| **Stronger edited-image detection** | Catch heavily edited or re-used photos | Today's perceptual hash can miss heavy edits. |
| **Duplicate-detection tuning** | Learn thresholds from confirmed/rejected suggestions | Calibrate offline; keep the deterministic linking rule. |
| **Cost-aware model routing** | Use a small model for easy cases, a larger one for hard ones | Metered by the existing usage dashboard. |
| **Prompt-injection red-team suite** | Larger adversarial test set | Extend the evaluation framework. |
| **Explanation quality checks** | Verify AI explanation factors against the inputs | Reject explanations that cite facts not present. |
| **Conversational status assistant** | "Where is my complaint?" in natural language | Read-only; answers only from the citizen's own data. |
| **Auto-generated daily briefings** | Scheduled situation report for admins | Keep the verified-numbers-only approach. |
| **Root-cause suggestions** | "Repeat potholes on this road suggest resurfacing" | Advisory, based on recurring-problem data. |

---

## 5. Analytics and planning

| Idea | What it adds |
|---|---|
| **Seasonality-aware forecasting** | Monsoon and festival effects once months of data exist (today: Holt linear, no seasonality). |
| **Predictive maintenance** | Predict where potholes, blockages or leaks are likely before they are reported. |
| **Resource planning** | Convert forecast demand into crew and budget needs per ward. |
| **Causal impact analysis** | Move beyond the current before/after comparison with proper controls. |
| **Cost and ROI reports** | Cost per resolution, per department, per category. |
| **Benchmarking between wards** | Fair comparison adjusted for population and area. |
| **Custom dashboards and saved views** | Admins build and share their own reports. |
| **Scheduled report delivery** | Weekly PDF/CSV by email to department heads. |
| **Data warehouse export** | Open API and nightly export for BI tools. |
| **Open data portal** | Publish anonymised datasets for researchers and journalists. |
| **Infrastructure health scoring** | Per-road or per-asset health index from complaint history. |

---

## 6. Geography and maps

| Idea | What it adds |
|---|---|
| **GPS-to-ward polygon lookup** | Real ward boundaries instead of demo wards; accurate ward-aware assignment. |
| **Administrative boundaries for anomalies** | Replace the ~1.1 km grid cell with real wards and zones. |
| **Asset layer** | Show known assets (streetlights, drains, signals) and link complaints to them. |
| **Road network awareness** | Snap complaints to the nearest road segment for better hotspot shapes. |
| **Reverse geocoding improvements** | Better landmark and address suggestions while pinning. |
| **Offline map tiles** | For field work with poor connectivity. |
| **Heatmap time slider** | Replay how problems spread over days or weeks. |
| **Geofenced alerts** | Notify officers when entering an area with critical open complaints. |

---

## 7. Notifications and real time

| Idea | What it adds |
|---|---|
| **WebSockets / server-sent events** | Real-time updates instead of 30–120 s polling. |
| **SMS and WhatsApp channels** | The notification channel interface already supports adding one file per channel. |
| **Quiet hours and preferences** | Per-user control over what is sent and when. |
| **Digest emails** | Daily summary instead of many single emails. |
| **Verified push on real devices** | Web Push is unit-tested with the push service mocked; test against real services. |
| **Admin-issued reset links** | Email a reset link on behalf of a user, in addition to the direct password reset. |

---

## 8. Accounts, security and compliance

| Idea | What it adds |
|---|---|
| **Force password change on next login** | Required after an admin reset or for default demo passwords. Needs a flag column and a login check. |
| **Immediate session invalidation** | Log out existing sessions after a password change or deactivation (token version column, or short-lived tokens with refresh). |
| **Two-factor authentication** | TOTP or SMS for staff and admins. |
| **Single sign-on** | Government identity providers for staff. |
| **Strong password policy and breach checks** | Reject common or breached passwords. |
| **Per-IP and per-account adaptive rate limiting** | Reduce brute-force and abuse. |
| **Session and device management** | Show and revoke active sessions. |
| **Fine-grained permissions** | Custom roles built from capabilities rather than three fixed roles. |
| **Data retention and deletion** | Automatic purge or anonymisation after a period; "delete my data" for citizens. |
| **Privacy tooling** | Face and number-plate blurring in uploaded photos. |
| **Consent records** | Store consent for notifications and data use. |
| **Security audit and penetration test** | Independent review before any real deployment. |
| **Secrets management** | Move to a managed secrets store with rotation. |
| **Pin the database CA everywhere** | Verify (not only encrypt) the database certificate in every environment. |
| **Tamper-evident audit log** | Hash-chained or write-once audit entries. |

---

## 9. Administration and governance

| Idea | What it adds |
|---|---|
| **Real department and ward data import** | Replace the synthetic catalog with authoritative data, with documented provenance. |
| **Bulk operations** | Bulk reassign, bulk close, bulk export, with confirmation and audit. |
| **Command palette / global search** | One search box for complaints, officers, departments, incidents. |
| **Advanced table features** | Column reordering, saved filters, TanStack Table for bulk actions. |
| **Configuration UI** | Edit decision-engine weights, thresholds and escalation rules in the app (versioned, audited). |
| **Decision-engine versioning UI** | Compare the effect of a new engine version on past complaints (shadow mode). |
| **Approval workflows** | Two-person approval for sensitive changes (department deactivation, SLA policy). |
| **Officer performance reviews** | Resolution time, reopen rate, citizen rating, with fairness caveats. |
| **Training mode** | Sandbox with sample data for onboarding new staff. |
| **Admin activity alerts** | Notify when unusual admin actions occur. |

---

## 10. Integrations

| Idea | What it adds |
|---|---|
| **Existing grievance systems** | Sync with municipal or state complaint portals. |
| **Payments and fees** | For services that carry a fee. |
| **GIS / asset systems** | Import official GIS layers. |
| **Weather feeds** | Anticipate waterlogging and tree-fall complaints from forecasts. |
| **Traffic data** | Raise priority where a damaged road carries heavy traffic. |
| **Calendar and attendance systems** | Feed officer availability. |
| **Webhooks and public API** | Let partners subscribe to events and read open data. |
| **Social-media monitoring** | Detect and convert public posts into draft complaints (human-reviewed). |

---

## 11. Platform, scale and reliability

| Idea | What it adds |
|---|---|
| **Real job queue** | Replace in-process jobs with a durable queue and workers (advisory locks currently protect multi-instance runs). |
| **Durable metrics** | Move request and error metrics out of memory into a metrics store. |
| **Caching layer** | Cache heavy analytics queries. |
| **Read replicas** | Offload dashboards from the primary database. |
| **Vector index** | Replace Node-side cosine similarity with a vector index when data is large. |
| **Multi-tenant / multi-city** | Isolate data per city with per-tenant branding and configuration. |
| **Release-step migrations** | Run migrations as a deploy step with `AUTO_MIGRATE=false` for multi-instance production. |
| **Backups and disaster recovery** | Documented backup, restore tests and RPO/RTO targets. |
| **Paid hosting tier** | Remove free-tier cold starts for live use. |
| **Infrastructure as code** | Reproducible environments. |
| **Real billing data for AI cost** | Replace estimated costs with provider billing data. |
| **Observability stack** | Tracing, alerting and on-call dashboards. |

---

## 12. Quality, testing and accessibility

| Idea | What it adds |
|---|---|
| **Cross-browser and device testing** | Firefox, Safari and physical phones (today: automated Chromium plus screenshots). |
| **Cloudinary end-to-end verification** | Verify uploads against a live account in CI. |
| **Load and soak tests** | Know the throughput limits and the AI latency under load. |
| **Visual regression tests** | Catch unintended UI changes. |
| **Accessibility audit** | Screen-reader testing and WCAG conformance review. |
| **Devanagari in PDF reports** | Needs a PDF approach that can shape Indic scripts (conjuncts and vowel signs); today the PDF shows a placeholder beside the English summary. |
| **Contract tests for the API** | Generate and verify a typed client from an OpenAPI spec. |
| **Playwright coverage for new flows** | Add the officer password-reset dialog and other recent features. |
| **Dedicated test database setup** | One command that provisions a throwaway database so tests never touch production. |

---

## 13. Suggested roadmap

**Phase 1 — Hardening (next)**
1. Force password change and immediate session invalidation.
2. Dedicated test-database setup script.
3. GPS-to-ward lookup and real ward import.
4. Optional auto-assignment (admin toggle, off by default).
5. Native-speaker review of Hindi/Marathi strings.

**Phase 2 — Reach and operations**
1. WhatsApp and SMS channels.
2. Real-time updates (SSE or WebSockets) and a durable job queue.
3. Crew work orders and a field PWA with offline support.
4. Citizen "me too" confirmations and a public issue map.

**Phase 3 — Intelligence and scale**
1. Seasonal forecasting and predictive maintenance.
2. Reviewed evaluation set from staff corrections, then a distilled classifier.
3. Multi-city tenancy, open data portal and integrations with official systems.
4. Security audit, retention policy and compliance work before any production launch.
