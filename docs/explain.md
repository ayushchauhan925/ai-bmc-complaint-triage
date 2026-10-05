# Civic Connect — Feature Explainer

A plain-language, feature-by-feature walkthrough of everything Civic Connect does: **what** each
feature is, **why** it exists, **how** it works, and **where** to find it in the app and code.
It is written so a judge, a reviewer or a new contributor can understand the whole platform
without reading the source.

> Companion docs: [`architecture.md`](architecture.md) · [`ai-pipeline.md`](ai-pipeline.md) ·
> [`api.md`](api.md) · [`database-schema.md`](database-schema.md) · [`demo-flow.md`](demo-flow.md) ·
> the root [`README.md`](../README.md) for setup, deployment and the API reference.

> **Disclaimer:** demo/seed data, wards, SLA targets and department names are **synthetic
> application rules**, not official BMC operational data or policy.

---

## Contents

1. [The idea in one page](#1-the-idea-in-one-page)
2. [The core principle: AI proposes, code decides](#2-the-core-principle-ai-proposes-code-decides)
3. [Who uses it (roles)](#3-who-uses-it-roles)
4. [Citizen features](#4-citizen-features)
5. [The complaint pipeline (what happens on submit)](#5-the-complaint-pipeline-what-happens-on-submit)
6. [AI understanding & AI safety](#6-ai-understanding--ai-safety)
7. [Evidence intelligence](#7-evidence-intelligence)
8. [Hybrid decision engine (priority)](#8-hybrid-decision-engine-priority)
9. [Duplicate detection](#9-duplicate-detection)
10. [Incidents](#10-incidents)
11. [Departments, routing & officer assignment](#11-departments-routing--officer-assignment)
12. [SLA engine](#12-sla-engine)
13. [Escalation engine](#13-escalation-engine)
14. [Human-in-the-loop review & AI feedback](#14-human-in-the-loop-review--ai-feedback)
15. [Officer features](#15-officer-features)
16. [Admin Command Center & analytics](#16-admin-command-center--analytics)
17. [GIS: map, heatmap & hotspots](#17-gis-map-heatmap--hotspots)
18. [Anomaly detection](#18-anomaly-detection)
19. [Forecasting](#19-forecasting)
20. [Department workload](#20-department-workload)
21. [Recurring problems & resolution impact](#21-recurring-problems--resolution-impact)
22. [Search](#22-search)
23. [Image intelligence](#23-image-intelligence)
24. [Timeline & audit log](#24-timeline--audit-log)
25. [Notifications](#25-notifications)
26. [AI governance: evaluation, usage & cost, health](#26-ai-governance-evaluation-usage--cost-health)
27. [Background jobs & observability](#27-background-jobs--observability)
28. [Resilience & graceful degradation](#28-resilience--graceful-degradation)
29. [Account security](#29-account-security)
30. [Languages (English / Hindi / Marathi)](#30-languages-english--hindi--marathi)
31. [Exports: CSV & PDF](#31-exports-csv--pdf)
32. [Shared data-table system](#32-shared-data-table-system)
33. [Public transparency dashboard](#33-public-transparency-dashboard)
34. [Testing & quality](#34-testing--quality)
35. [Deployment architecture](#35-deployment-architecture)
36. [Honest limitations](#36-honest-limitations)
37. [Suggested demo order](#37-suggested-demo-order)

---

## 1. The idea in one page

**Problem.** City helplines and portals receive thousands of messy complaints: written in
different languages, with vague locations, photos of varying quality, and many people reporting
the *same* pothole or leaking pipe. Manual triage is slow, emergencies get buried, and officers
never see the bigger picture.

**Solution.** Civic Connect is an AI-assisted municipal (BMC-style) complaint platform. A citizen
reports an issue in English, Hindi, Hinglish or Marathi, with photos and a map pin. The system:

1. **Understands** the report with a validated, structured AI analysis.
2. **Scores the evidence** behind it.
3. **Finds duplicates** and groups them into a single **incident**.
4. **Decides** priority, department and SLA with an explainable rule engine.
5. **Escalates** anything that needs attention (SLA, surges, repeat problems).
6. Puts a **human in the loop** when the AI is unsure.
7. Gives operators a **command center**: map, hotspots, anomalies, forecasts, workload, audit
   trail, and AI quality/cost/health monitoring.

It is deliberately more than "CRUD plus an LLM": the AI is one input into a deterministic,
tested, auditable system.

---

## 2. The core principle: AI proposes, code decides

> The LLM only produces **signals** — category, severity signals, risk indicators, urgency,
> confidence. **Priority, routing, SLA, escalation, duplicate linking, hotspots, anomalies and
> forecasts are computed by deterministic, tested, auditable code.**

Why this matters:

| Concern | How the principle answers it |
|---|---|
| *"What if the AI hallucinates?"* | Output is schema-validated; unknown values collapse to safe defaults; the AI cannot trigger a sensitive action. |
| *"Can we audit a decision?"* | Every priority comes with named decision factors; every action lands in the audit log. |
| *"What if the AI is down?"* | Rule-based fallback routing/priority/SLA keeps the complaint moving. |
| *"Can someone manipulate it with text?"* | Prompt-injection text is detected and flagged for human review; it can't change priority. |
| *"Is it testable?"* | Pure functions with unit tests; the LLM is mocked in integration tests. |

Every tunable weight and threshold lives in one file, `backend/src/utils/constants.js`.

---

## 3. Who uses it (roles)

| Role | Purpose | Scope |
|---|---|---|
| **Citizen** | Reports and tracks issues, gives feedback, can reopen | Own complaints only |
| **Officer** | Works the queue for their department; reviews AI decisions | Their own department |
| **Admin** | Runs the whole platform: analytics, SLA policy, departments, officers, audit, AI health | Global |

A separate "department admin" role was deliberately not added: department-scoped officers plus
global admins cover the need without a schema/JWT change. **Backend authorisation is
authoritative**; frontend role checks are UX only. The user record is re-fetched on every
request, so a deactivated account or a changed role takes effect immediately — roles are never
trusted from the token.

| Capability | Citizen | Officer | Admin |
|---|:--:|:--:|:--:|
| Submit / track own complaints, own timeline & SLA | ✅ | — | ✅ (view) |
| Decision trace, evidence, related complaints | ❌ | ✅ | ✅ |
| Review (approve / correct / duplicates) | ❌ | own dept | ✅ all |
| Analytics, hotspots, anomalies, forecast, SLA, escalations | ❌ | ❌ | ✅ |
| Audit log, AI performance/usage/evaluation, observability, jobs | ❌ | ❌ | ✅ |
| Edit SLA policy, departments, officers | ❌ | ❌ | ✅ |

---

## 4. Citizen features

### 4.1 Multilingual complaint submission
Citizens write in **English, Hindi, Hinglish or Marathi** — the AI detects the language. A
complaint can include **up to 5 photos** and a **map-pinned location** (OpenStreetMap, with
"use current location"). *Pages:* `citizen/SubmitComplaint`.

### 4.2 Guided AI assistant
For short or incomplete drafts the citizen can click **Get AI suggestions**. One AI call returns
the likely category, up to 4 follow-up questions ("Is it blocking traffic?"), and an optional
clearer rewrite. It is *one-shot*, not a chatbot, and it **never decides the final category** —
that happens at submission. *Endpoint:* `POST /api/complaints/ai-assist`.

### 4.3 Completeness hint (not AI)
A transparent checklist — description detail, impact, pinned location, landmark, photo — gives
supportive suggestions as the user types. It is explicitly **rule-based, not AI**, and **never
blocks submission**. It improves report quality before any AI cost is spent.

### 4.4 Pre-submission duplicate warning
Before submitting, **Check for similar complaints nearby** shows existing nearby reports of the
same problem ("someone already reported this"). It reuses the same embedding comparison as the
backend but with a **separate, lower threshold**, because a raw draft has no AI summary yet, so
its similarity to stored (summary-enriched) embeddings is systematically lower. Submission is
never blocked by this check.

### 4.5 Status tracking with a public-safe timeline
The complaint page shows a live **timeline** (submitted → AI analysed → assigned → in progress →
resolved), an **SLA countdown**, and a notice if related complaints exist. Citizens see **only
public events with internal details stripped** — no AI decision internals, evidence scores or
staff review notes.

### 4.6 Feedback and reopen
After resolution the citizen can answer whether it was truly fixed. Answering **"not resolved"**
automatically reopens it (`RESOLVED → REOPENED → ASSIGNED`) so it returns to the officer queue.
A standalone **Report issue not actually resolved** button also accepts an evidence photo. This
closes the loop: "resolved" is verified by the person who reported it.

### 4.7 In-app notifications and device push
Status changes arrive as in-app notifications; optionally as browser push (see
[§25](#25-notifications)).

### 4.8 PDF receipt
**Download receipt** produces a PDF with the complaint ID, status, category, location, target
date, description and public timeline.

---

## 5. The complaint pipeline (what happens on submit)

Implemented in `backend/src/services/complaint/analysisPipeline.service.js`.

```
Submit ─▶ validate · image signature check · phash + blur (local) · Cloudinary upload
      ─▶ AI understanding (validated, sanitised, injection-guarded)   [fail → fallback]
      ─▶ embedding → duplicate / related search (semantic+text+geo+time+category+photo)
      ─▶ evidence score  +  historical repeat count
      ─▶ hybrid decision (priority · factors · review gates)
      ─▶ routing (category → department) · SLA snapshot
      ─▶ incident grouping (strong, category-compatible matches only)
      ─▶ timeline · audit · notifications
```

1. **Intake** — body validated with Zod; each image's **real file signature** (magic bytes, not
   the client's claimed MIME) is checked; perceptual hash and sharpness are computed locally;
   photos go to Cloudinary; complaint + images stored in one DB transaction; a `CREATED`
   timeline event and audit entry are written.
2. **AI understanding** — text is sanitised and sent (with photos) to the model; the response is
   parsed with Zod. Failure produces `success: false`, never an exception.
3. **Embedding + related search** — pre-filtered by radius/time in SQL, scored in Node. If
   embeddings are unavailable it degrades to a stricter text+geo path instead of switching off.
4. **Image similarity** — same photo at the same spot ⇒ duplicate candidate; same photo at a
   *different* location ⇒ a human-review reason.
5. **Evidence score** and **historical repeat count** computed.
6. **Hybrid decision** — priority, factors, review gates.
7. **Routing + SLA** — deterministic department; SLA hours **snapshotted** on the complaint.
8. **Persistence** — `complaints` updated, `complaint_decisions` upserted.
9. **Status transitions** — `AI_ANALYZED`, then `ASSIGNED` unless review is required.
10. **Incident grouping**, then 11. **notifications** and **audit**.

Every optional step is wrapped so a failure is logged and counted but **never fails the
complaint**. A **human-corrected complaint is never overwritten** by automatic re-analysis.

---

## 6. AI understanding & AI safety

*Code:* `services/ai/complaintAnalysis.service.js`, `aiResponseParser.js`, `aiSafety.js`,
`prompt.service.js`.

### 6.1 One unified analysis call
A **single** model call analyses text **and** up to 5 photos together, returning everything
downstream logic needs, to avoid doubling OpenAI usage:

| Field | Meaning |
|---|---|
| `title`, `summary`, `normalized_description` | Clean English rendering of the report |
| `category`, `subcategory` | One of 28 canonical categories |
| `language` | Detected language |
| `confidence` | Model's confidence (0–1) |
| `missing_information` | What the citizen left out |
| `severity_signals` | 11–14 booleans: traffic hazard, near school/hospital, injury reported, public-health risk, emergency access blocked, … |
| `urgency` | `LOW / NORMAL / HIGH / IMMEDIATE` |
| `recommended_action` | Suggested next step (advisory) |
| `location_relevance` | `CLEAR / VAGUE / MISSING` |
| `risk_indicators` | Allow-listed enum list |
| `explanation_factors` | ≤5 short factual phrases (no chain-of-thought is requested or stored) |
| `image_analysis` | Per-image: issue visible, supports claim, blurry, irrelevant, manipulated, evidence confidence |
| `moderation` | Spam / irrelevance flag |

### 6.2 AI safety
| Threat | Defence |
|---|---|
| Malformed / non-JSON output | Parser returns failure → fallback path |
| Hallucinated category/urgency/location relevance | `z.enum(...).catch(safeDefault)` (unknown category → `OTHER`) |
| Invented risk indicators | Filtered against the `RISK_INDICATORS` allow-list |
| Markup / XSS / oversize model text | Tags stripped, control chars removed, hard length caps |
| **Prompt injection** in complaint text | Delimiter neutralisation, length cap, **pattern detection** (`ignore previous instructions`, `system:`, `set the priority to …`). The complaint is still accepted but flagged for human review; the system prompt tells the model the text is untrusted data |
| AI controlling sensitive operations | Impossible — only signals reach the decision engine |

Older/partial responses still validate (all extended fields have defaults), so upgrades are
backward-compatible.

**Review, never rejection:** low confidence, an image that doesn't support the claim, a
suspicious image, spam, or injection-like text each set `review_required` with a human-readable
reason. The complaint is still created and tracked — just flagged.

---

## 7. Evidence intelligence

*Code:* `services/decision/evidence.service.js` — a pure, unit-tested function.

A **0–100 evidence score** from nine auditable signals, each with points, a max, a
positive/neutral/negative status and a plain-language detail:

| Signal | Max | Source |
|---|---:|---|
| Description detail | 15 | Word count (spam ⇒ 0) |
| Location detail | 15 | Typed address + AI `location_relevance` |
| Photo attached | 10 | Image count |
| Photo quality | 10 | AI verdict, **downgraded by locally measured blur** |
| Photo matches complaint | 10 | AI `image_supports_claim` × evidence confidence |
| AI classification confidence | 15 | Model confidence |
| Corroborating reports | 15 | Strong, category-compatible related complaints |
| Recurring location | 5 | Earlier same-category reports within 150 m / 60 days |
| Recent corroboration | 5 | Related reports within 72 h |

- Signals that **don't apply** (e.g. photo quality with no photo) are *excluded from the
  denominator*, not counted as zero — a text-only complaint isn't unfairly penalised.
- **Red flags subtract points**: manipulated image −15, unrelated image −10, instruction-like
  text −10.
- **Bands:** STRONG ≥ 75 · MODERATE ≥ 50 · WEAK ≥ 30 · else INSUFFICIENT (shown in the UI as
  *Strong / Moderate / Limited / Very limited*).

**Why:** staff can see *why* a report is trusted or not, instead of a black-box "confidence".

---

## 8. Hybrid decision engine (priority)

*Code:* `services/decision/decisionEngine.service.js` — pure and versioned
(`DECISION_ENGINE.version`). Every step is emitted as a named **decision factor**
`{source, label, points}` shown in the UI with a source tag.

```
base priority (category tier + AI severity signals + duplicate volume + age)
 + AI risk indicators not already covered by a signal       (capped at +10)
 + recurring-location history                                (+8)
 ± evidence adjustment                                       (STRONG +4 · INSUFFICIENT −5)
 → safety floors: injury_reported / emergency_access_blocked ⇒ at least HIGH
 → AI "IMMEDIATE" urgency honoured only if confidence ≥ 0.6 AND evidence ≠ INSUFFICIENT
 → human-review gates
```

It is deliberately **not an average**: floors and gates are hard rules. **Review gates** fire
for low AI confidence, `OTHER` with weak confidence, spam/irrelevance, unverified "immediate"
urgency, instruction-like text, image concerns, **HIGH/CRITICAL priority resting on weak,
uncorroborated evidence** ("verify before dispatch" — priority is *not* silently downgraded),
and AI unavailable.

---

## 9. Duplicate detection

*Code:* `services/duplicate/duplicateDetection.service.js`, `models/duplicate.model.js`.

**Signals:** embedding cosine similarity (semantic), lexical similarity (word Jaccard +
character-trigram Dice — works for Devanagari), distance, recency, category-family match, photo
perceptual similarity.

**Duplicate probability** (0–1) is a calibrated blend:
- With embeddings: `0.45·semantic + 0.20·text + 0.15·distance + 0.10·time + 0.10·category`
- Text-only: `0.55·text + 0.20·distance + 0.10·time + 0.15·category`
- Photo similarity blends in at 20 %.

**Linking rule** (`isLinkable`): probability ≥ 0.6, category-compatible, and — for text-only
evidence — within 150 m (wording alone doesn't prove the same physical spot). Different-category
neighbours stay "related", not "same incident".

Suggestions are **persisted** (`complaint_duplicates`) with human-readable indicators — *Very
similar meaning*, *Same spot (<50 m)*, *Visually similar photo* — and a review state
`SUGGESTED / CONFIRMED / REJECTED`.

> **Nothing is ever deleted or silently merged.** Staff can confirm (link into an incident) or
> reject (detach; both reports remain).

---

## 10. Incidents

Complaints describing one real-world problem are grouped into an **incident** (`INC-YYYY-NNNN`).
Only *strong, category-compatible* matches join. The incident's priority is re-escalated using
**geographic concentration** (how tightly reports cluster) and **duration** bonuses — no AI call.

**Incident intelligence panel** (`GET /api/incidents/:id`):

- complaint count / open count · categories affected · worst severity
- first and latest report
- **trend** — `RISING / STABLE / FALLING`, or `INSUFFICIENT_DATA` under 3 reports (never guessed)
- **extent** — centroid, containing radius, bounds
- worst SLA state, breached count, next deadline · escalation events

Admins can also **merge** one incident into another (the source closes, both timelines record
it) and export an **incident PDF**. *Pages:* `admin/Incidents`, `admin/IncidentDetails`.

---

## 11. Departments, routing & officer assignment

> **Demo model, not official BMC data.** The 20 departments are this project's configurable
> demo catalog. A real deployment should replace names/codes with authoritative data.

### 11.1 Department catalog
Single source of truth: `backend/src/utils/departmentCatalog.js`. Twenty departments (Roads,
Solid Waste, Water Supply, Storm Water Drainage, Sewerage, Street Lighting & Electrical,
Traffic Signals, Gardens & Trees, Public Health, Encroachment, Animal Management, Disaster /
Emergency Response, Buildings & Structural Safety, Public Infrastructure, Parks, Public
Toilets, Flood Management, Environmental Services, Disaster Management, General Civic
Services), each with a **stable code** and the complaint types it handles. The server **throws at
load** on a duplicate code, an unroutable AI category or a missing fallback, so a bad edit
can't ship silently. There are 84 routable codes (28 canonical AI categories plus aliases).

### 11.2 Deterministic routing (the LLM never routes)
1. `category → primary department` via the catalog; where a code appears under several
   departments the first-listed wins and the others become **secondary**.
2. **Secondary departments** (e.g. flooding → Flood Management; sewage overflow / dead animal →
   Public Health; fallen tree → Emergency Response) are recorded on the timeline as "also
   involved". One department owns the complaint.
3. If the primary department is **inactive or missing**, the first active secondary is used,
   then **General Civic Services** (the fallback, which can never be deactivated).

### 11.3 Officers → department → ward
Every officer belongs to exactly one department (required, active) and optionally one ward. Both
are chosen from DB-backed dropdowns and validated server-side.

### 11.4 Smart officer recommendation
`recommendOfficers({departmentId, latitude, longitude, wardId})` ranks **active officers of that
department only**: **same ward first**, then fewest open assignments, then fewest critical, then
fewest SLA breaches, then proximity to the officer's current work. Each recommendation carries
human-readable reasons. **It only recommends** — the admin assigns, and the server re-checks
that the department/officer are active and matched. The LLM is never involved.

### 11.5 Department management (admin)
- **Departments page:** all departments with code, categories, active/total officers, open and
  critical complaints; search, Active/Inactive tabs, details dialog, edit description/contacts,
  CSV export.
- **Deactivation guard:** a department with open complaints **cannot be deactivated unless a
  reassignment target is given**; the move is one transaction (complaints and incidents move,
  officer cleared, timeline events, audit entry).
- **Officers page:** department, ward, active/critical assignments, SLA breaches, status; add
  and edit; moving or deactivating an officer with open work returns 409 unless
  `release_assignments` is set.

---

## 12. SLA engine

*Code:* `services/complaint/sla.service.js`, `slaPolicy.service.js`; table `sla_policies`.

- Targets are **configurable per priority and optionally per category**, editable in the UI;
  every change is audited. Defaults: Critical 12 h, High 24 h, Medium 48 h, Low 72 h; warn at
  80 %.
- Applicable hours are **snapshotted** on the complaint (`sla_hours`), so a later policy edit
  doesn't rewrite history.
- The SLA snapshot gives start, deadline, status (`ON_TRACK / APPROACHING / BREACHED /
  COMPLETED_*`), time remaining, breach/warning flags and resolution time.
- A human priority correction recomputes the deadline from the original creation time.

*Page:* `admin/SlaEscalations` — **SLA monitor** (sortable at-risk list), **Escalations**,
**Targets** (edit policy), plus PDF/CSV export.

---

## 13. Escalation engine

*Code:* `services/complaint/escalation.service.js`, `escalationEngine.service.js`; table
`escalation_events`.

Deterministic and **idempotent** (unique `dedupe_key`), each traceable to the rule and numbers
that fired it:

| Rule | Fires when |
|---|---|
| `SLA_APPROACHING` / `SLA_BREACHED` | Complaint crosses its warning ratio / deadline |
| `HIGH_SEVERITY_UNASSIGNED` | CRITICAL still unassigned after 2 h / HIGH after 8 h |
| `REPEATED_COMPLAINTS` | ≥ 3 same-category reports within 150 m / 30 days, one resolved and one open again |
| `MAJOR_INCIDENT` | Open incident reaches 5 (HIGH) or 10 (CRITICAL) complaints |
| `SURGE_*` | Anomaly score ≥ 4 (derivative surges suppressed when a volume/category surge already explains them) |

Events **auto-resolve** when their complaint/incident closes, notify admins, add timeline
entries and audit records, and can be **acknowledged** in the UI.

---

## 14. Human-in-the-loop review & AI feedback

*Code:* `services/review/humanReview.service.js`, `feedbackMetrics.service.js`.

### 14.1 Review queue
`/admin/review` lists every flagged complaint with **why** it was flagged, a quick **Approve**,
and an inspect-and-decide view.

### 14.2 Review actions
`POST /api/complaints/:id/review`:

| Action | Effect |
|---|---|
| **APPROVE** | Confirms the AI/system decision |
| **CORRECT** | Change category / priority / department; a category change re-routes deterministically (unless a department is chosen); SLA recomputed |
| **FALSE_POSITIVE** | Closes the complaint but preserves it |
| **CONFIRM_DUPLICATE** | Links into an incident |
| **REJECT_DUPLICATE** | Detaches; both reports remain |

Admins can review anything; officers only their own department. Each review stores the **AI
value next to the human value** (`human_reviews`), an audit entry and a timeline event.

### 14.3 AI performance metrics
`GET /api/admin/ai-performance` is computed only from *staff-reviewed* complaints, with sample
sizes: classification accuracy, priority agreement, routing agreement, correction/approval rate,
false positives, duplicate precision, confidence calibration, confidence distribution. Below 5
reviews it says **insufficient data**.

> **Nothing retrains a model from this data** — it is evaluation only.

---

## 15. Officer features

### 15.1 Department dashboard and queue
Officers see their department's complaints with search, priority filter and **server-side
sorting** (priority, SLA deadline, status, …). *Pages:* `officer/Dashboard`, `officer/AllComplaints`.

### 15.2 Work flow
Open complaint → **Accept** → **Start work** → upload an "after" photo + note → **Mark
resolution submitted**. An admin approves the final `RESOLVED` transition.

### 15.3 AI Work Assistant (officer copilot)
**Get AI suggestions** returns an **inspection checklist**, **evidence to collect** and a
**pre-resolution checklist**. It is explicitly **advisory**, and cached on the complaint after
first generation so revisiting doesn't re-call OpenAI. *Endpoint:*
`GET /api/officer/ai-assistance/:id`.

### 15.4 AI before/after resolution verification
The original ("before") photo and the officer's resolution ("after") photo are compared and
return `SUPPORTED / UNCERTAIN / NOT_SUPPORTED` with signals (same area addressed, image quality,
after-image related to before, extra review recommended). **Always advisory** — an admin still
decides.

### 15.5 Field view (mobile-first)
`/officer/field`: open tasks sorted **nearest-first** using the browser's geolocation (never
sent to the server), a task map, one-tap **Accept / Start**, and turn-by-turn **Navigate**.

### 15.6 Staff review panel
On the complaint page staff see the AI assessment, decision factors, evidence breakdown,
related complaints (with *link* / *not related* actions) and the review panel.

---

## 16. Admin Command Center & analytics

### 16.1 Command Center (`/admin`)
Eight headline metrics (each links to its detail view), a review-queue banner, demand trend, SLA
state, open hotspots, anomalies, department workload (pending vs overdue), AI confidence
distribution, duplicate rate, and critical and breached lists. Auto-refreshes every 60 s.
Exports a PDF.

### 16.2 Civic Intelligence Center
A summary of departments, wards, hotspots and recent incidents, plus the **AI Situation
Report**: the backend first computes a stats snapshot from **verified aggregate queries only**
(no raw text, no citizen PII), sends only that to the model with an instruction to use *only
those numbers*, and stores the snapshot beside the narrative so the admin can verify it.
Generated **only on explicit admin action**. *Endpoint:* `POST /api/admin/situation-report`.

### 16.3 Analytics page
Trends, week-over-week change, SLA performance, AI confidence distribution, duplicate rate.
*Endpoints:* `/api/analytics/*`.

---

## 17. GIS: map, heatmap & hotspots

*Code:* `services/complaint/hotspot.service.js`, `utils/geo.js`. *Page:* `admin/MapView`.

- **Markers** (clustered, colour-coded by priority).
- **Heatmap** — severity-weighted `[lat, lng, weight]` points; resolved complaints count half.
- **Hotspots** via **DBSCAN** (grid-indexed) *per category* — an elongated problem (potholes
  along a road) becomes **one** hotspot instead of arbitrary circles. Defaults: 350 m radius,
  min 3 complaints.
- Each hotspot reports count, radius, area, density/km², severity-weighted density, unresolved
  count and share, last-48 h share, incident count, dominant priority, and a transparent score:
  `severityWeightedCount × (1 + recentShare) × (0.5 + 0.5 × unresolvedShare)`.
- **Incident zones** and **anomaly areas** overlay on the same map.
- **Filters:** category, severity, status (incl. *unresolved*), department, date range; deep-link
  with `?focus=lat,lng`. A side panel lists ranked hotspots with drill-down.

Filters are validated and parameterised; the map uses OpenStreetMap (no Google Maps).

---

## 18. Anomaly detection

*Code:* `services/analytics/anomaly.service.js` — **no LLM involved**.

The latest 24 h bucket is compared against up to 28 preceding daily buckets using a **robust
z-score**: `(observed − median) / max(1.4826·MAD, √mean, 1)`. To count as an anomaly it must also
have **score ≥ 3**, **≥ 5 events** and **≥ 1.5× the baseline mean** — so "0 → 3" is never a
surge, and earlier spikes don't desensitise the detector (median/MAD are robust to outliers).

**Dimensions:** overall volume · per category · per department (incoming workload) · geographic
(~1.1 km grid cells) · high/critical severity · resolution-time slowdown. Each anomaly carries
its score, baseline, observed value, window, location and a plain explanation. With fewer than 7
observable days it returns `sufficientData: false` and **no anomalies** rather than guessing.

---

## 19. Forecasting

*Code:* `services/analytics/forecast.service.js`.

**Holt's linear trend** (double exponential smoothing) with ~80 % **prediction intervals** and a
**7-day hold-out backtest against a naive baseline** — the UI shows the backtest, including when
the model is *no better than a simple average*. Series forecast: overall daily volume, top-5
categories, top departments' incoming workload, and the **unresolved backlog**.

Requires ≥ 14 days of history and ≥ 5 active days, otherwise it returns
`{available:false, reason}` ("insufficient data"). The current incomplete day is excluded and
negatives are floored at 0. *Page:* `admin/Operations` → **Forecast & expected demand**.

---

## 20. Department workload

*Code:* `services/analytics/departmentWorkload.service.js`.

Per department: assigned, pending, in progress, resolved, overdue, pending high-priority,
average resolution hours, incoming 7 d vs previous 7 d (trend), category mix, and
`slaCompliance = withinSla / (withinSla + afterSla + openBreached)`. It is `null` ("no data")
until something has actually been judged — **never a fake 100 %**. Drill-down shows a 30-day
incoming-vs-resolved series.

---

## 21. Recurring problems & resolution impact

*Page:* `/admin/recurring`.

- **Recurring problems** — places where a problem was *fixed and then reported again* within
  ~150 m, with fixes, reopenings and status. Exposes "fixed" problems that weren't really fixed.
- **Resolution impact** — compares complaints of the same kind **30 days before vs after** each
  fix. It is labelled an *observed comparison, not proof of cause*.

---

## 22. Search

- **Admin complaint filters:** text (description, address, AI title, complaint number),
  category, status, priority, **SLA status**, department, officer, **incident**, **citizen**
  (name/email), complaint id, date range.
- **Semantic search** (`GET /api/admin/search/semantic`): embeds the query and ranks recent
  complaints by *meaning*; **automatically falls back to keyword search and says so**
  (`mode: "keyword"`).
- **AI natural-language admin search** (`POST /api/admin/ai-search`): e.g. *"Show unresolved
  potholes near schools"*. The model only produces a **JSON filter**, which is re-validated
  field-by-field against an allow-list; the backend builds the parameterised query. **The AI never
  writes SQL.** Every query is logged (`ai_admin_queries`) with the filters actually applied.

---

## 23. Image intelligence

*Code:* `services/image/imageIntelligence.service.js`, `utils/imageFormat.js`.

Computed **locally** at upload (pure JS via `jimp`; no native binaries, no paid API):

- 64-bit **dHash** perceptual hash
- **Laplacian-variance** sharpness (blur)
- brightness, dimensions
- **Magic-byte validation** rejects forged files; header-parsed dimensions refuse
  **decompression bombs** (> 40 MP skips analysis)

Used for: blur downgrade in the evidence score, duplicate-photo detection, and reuse-at-another-
location flags. These are *measurements*; what a photo *shows* comes only from the vision model
and is advisory. If a photo can't be decoded the analysis is reported unavailable and the
complaint continues.

---

## 24. Timeline & audit log

### 24.1 Complaint timeline
`GET /complaints/:id/timeline` merges the authoritative status history with `complaint_events`
(AI analysed, evidence scored, priority set, department assigned, duplicates found, incident
linked, human review, SLA warning/breach, escalated). **Citizens receive only public events**
with internal detail removed; staff see everything.

### 24.2 Audit log
`audit_logs` records the **actor, role, action, entity, before/after values and timestamp**.
Credential-like keys are redacted at any depth and long strings truncated. An audit failure
never breaks the audited operation. It covers creation, AI analysis/fallback, status changes,
assignments, admin edits, reviews, incident merges, SLA policy changes, escalations, evaluation
runs and job triggers. *Page:* `admin/AuditLog` — filters, server search/sort, pagination,
before/after diff, CSV/PDF export.

---

## 25. Notifications

*Code:* `services/notification/`.

`notify()` is the single entry point; delivery goes through pluggable **channels**
(`{name, isEnabled(), send()}`):

- **`in_app`** — always on; the system of record.
- **`email`** — `nodemailer`, active only when `SMTP_HOST` is set.
- **`push`** — Web Push (VAPID), active only when `VAPID_*` keys are set; dead subscriptions are
  pruned automatically. Users opt in under **Profile → Device notifications**.

Adding SMS is one new file plus one registry line. A failing channel **never throws into
business logic**.

---

## 26. AI governance: evaluation, usage & cost, health

*Page:* `admin/AiSystem` (tabs: **AI quality · Usage & cost · System health**).

### 26.1 Evaluation framework
`backend/evals/dataset.json` + `services/evaluation/evaluation.service.js`: ~60 hand-labelled
cases — classification (English/Hindi/Hinglish/Marathi), summary relevance, routing, priority,
duplicate scoring, prompt-injection detection, AI-output validation and image checks (synthetic
blur / perceptual-similarity images).

- **Offline mode** needs no OpenAI and works as a regression guard.
- **Live mode** also calls the model for classification/summaries (small cost).
- Tasks that can't run are **skipped with a reason** — never counted as agreement. Results are
  stored in `ai_evaluations` and runnable from the UI.

### 26.2 Usage & cost monitoring
Every OpenAI call goes through one instrumented client (`config/openai.js`) recording use case,
model, tokens, **estimated** cost, latency and success in `ai_usage`. The page shows totals,
failure rate, per-use-case and per-model breakdowns and daily cost, and flags the most expensive
workflow. Costs are estimates from a static list-price table.

### 26.3 System health
Database round-trip, uptime, slowest endpoints (p50/p95), error counts, recent errors, job
definitions and history, AI status, active notification channels — with **run-now** buttons for
jobs.

---

## 27. Background jobs & observability

**Jobs** (in-process, overlap-guarded, recorded in `job_runs`; no Redis/queue needed):

| Job | Interval | Purpose |
|---|---|---|
| `sla_check` | 5 min | Update SLA states, fire warnings/breaches |
| `escalation_rules` | 10 min | Evaluate escalation rules |
| `anomaly_scan` | 15 min | Refresh anomalies |
| `ai_retry` | 10 min | Retry complaints whose AI analysis failed (max 4 attempts) |

SLA checks also run **lazily** when an admin opens the SLA/intelligence views, so behaviour is
correct even on a host that sleeps (free tier). A MySQL **advisory lock** (`GET_LOCK`) ensures
exactly one instance runs each job in a multi-instance deployment.

**Request observability:** an `X-Request-Id` on every response, latency histograms per *route
pattern*, status-class counters, structured JSON logs (method, route, status, ms, user id —
**never** bodies, queries, headers or tokens). Errors are classified (`api`, `ai`, `database`,
`external`, `image`, `job`) in a bounded ring buffer. Metrics are in-process (reset on restart);
durable history lives in `ai_usage`, `job_runs` and `audit_logs`.

---

## 28. Resilience & graceful degradation

| Failure | System behaviour |
|---|---|
| **AI outage / invalid JSON** | Complaint is **preserved**; fallback department (General Civic Services), rule-based priority and SLA; status `NEEDS_REVIEW`; the `ai_retry` job re-analyses automatically |
| **Embeddings unavailable** | Duplicate detection degrades to a stricter text + geo (≤150 m) path |
| **Optional step fails** (history, image similarity, suggestion persistence) | Logged and counted; never fails the complaint |
| **Audit or notification channel fails** | Never breaks the underlying operation |
| **Photo undecodable** | Marked "analysis unavailable"; complaint continues |
| **Insufficient data** (anomaly/forecast/trend/AI metrics) | Explicit "insufficient data" panel instead of a made-up number |
| **Frontend panel crashes** | `ErrorBoundary` shows a calm message with Retry instead of a blank page |
| **Table request fails** | Error state with Retry — never shown as an empty table |

---

## 29. Account security

| Feature | Details |
|---|---|
| **Passwords** | bcrypt hashing |
| **Auth** | JWT; user re-fetched per request so roles/deactivation apply immediately |
| **Login lockout** | 5 wrong passwords lock the account for 15 minutes (a correct password during the lock is also refused); a reset clears it; lock events audited; responses never expose lockout fields |
| **Password reset** | One-time, 1-hour email link; only a **SHA-256 hash** of the token is stored; a new link invalidates the old one; identical response for unknown emails (no account enumeration). Requires SMTP — without it the UI says so instead of offering a broken flow |
| **Email verification** | Banner + `/verify-email`; never blocks use |
| **Deactivated accounts** | Cannot log in (403); existing tokens stop working next request |
| **RBAC** | Enforced server-side on every route |
| **Transport / headers** | Helmet, strict CORS |
| **Rate limits** | 300 req / 15 min general; 20 / 15 min on login/register; 20 / min on AI-triggering endpoints |
| **Input** | Zod validation everywhere; parameterised SQL only |
| **Uploads** | Declared MIME **and** real signature, size/count limits, decompression-bomb guard, in-memory → Cloudinary |
| **Database TLS** | Encrypted; with `DB_SSL_CA` the server certificate is **verified** (pinned) |
| **Errors/logs** | No stack traces in production; `requestId` for support; credential-like keys redacted |
| **Secrets** | Environment variables only; `.env` git-ignored |

---

## 30. Languages (English / Hindi / Marathi)

A language picker (app bar, auth pages, mobile drawer) switches the **citizen-facing** UI —
navigation, footer and every status / priority / category label — between English, Hindi and
Marathi, falling back to English for any untranslated string. Complaint *input* in Hindi,
Hinglish and Marathi is also understood by the AI and the duplicate engine (character-trigram
similarity works on Devanagari). Staff/admin screens and the landing page remain English. A unit
test enforces that every English string has a Hindi and Marathi counterpart with placeholders
preserved.

---

## 31. Exports: CSV & PDF

### CSV
Available for complaints, audit log, SLA list, officer queue, recurring problems and departments.
UTF-8 **with BOM** (Devanagari opens correctly in Excel). Cells starting with `= + - @` are
neutralised to prevent **spreadsheet formula injection**.

### PDF
Generated **in the browser** (`jspdf` + `jspdf-autotable`, lazy-loaded on click) from data the
user can already see — no extra server load, no new permissions. Every report has a header, page
numbers, timestamp and data-scope footer.

| Where | Report |
|---|---|
| Complaint page (citizen) | Receipt |
| Complaint page (staff) | AI assessment, evidence, decision factors, internal timeline |
| Incident page | Overview, severity, trend, area, SLA, linked complaints |
| Command Center | Headline metrics, SLA, anomalies, hotspots, workload |
| SLA & escalations | Summary, targets, at-risk list |
| Complaints list / Audit log | Current filtered page |
| Public dashboard | Anonymous aggregate summary |

Limitation: built-in PDF fonts are Latin-only, so Hindi/Marathi text prints as
`[non-Latin text]` beside the English AI summary rather than garbled.

---

## 32. Shared data-table system

Every table is one component, `frontend/src/components/table/`. Pages own their data (TanStack
Query) and pass rows + columns; the table never fetches.

- **Columns:** widths, alignment, ellipsis with tooltip, header hint tooltips, responsive hiding,
  column-visibility menu and density (comfortable/compact) remembered per table.
- **Sorting:** click header to cycle direction (with `aria-sort`); **server-side** for large lists
  using a **whitelist** of sort keys, so hostile values never reach SQL.
- **Search & filters:** debounced search, selects, date ranges, removable chips, "Clear all".
- **Pagination:** "Showing 1–25 of 1,248", windowed pages, 25/50/100 per page; API clamps limit
  to 100.
- **Selection:** per-row and per-page, status bar, **Export selected (CSV)** (the only bulk
  action — no bulk mutations exist, so none are offered).
- **Row actions:** primary button plus an accessible overflow menu.
- **States:** skeleton rows, separate "no data yet" vs "no results" empties, error + Retry.
- **Small screens:** card layout below `md` where sensible; otherwise a focusable scroll region.
- **Consistency:** shared status/priority/SLA/severity badges (text, never colour alone), one
  date format and Indian number grouping.

---

## 33. Public transparency dashboard

`/public` — **no login**. Aggregate counts, category breakdown, resolution-time and
SLA-compliance figures, clearly labelled with data scope and containing **no citizen-identifying
information**. Downloadable as an anonymous PDF summary. Civic accountability without privacy
risk.

---

## 34. Testing & quality

- **240 backend tests** (Jest + Supertest, real DB, AI mocked): evidence scoring, decision
  engine (floors, gates, capped boosts), AI safety/parser hardening, anomaly scoring, Holt
  forecasting, DBSCAN, text similarity (incl. Devanagari), SLA snapshots, escalation
  **idempotency**, review flows, duplicate → incident → reject → confirm, **AI-outage fallback +
  retry recovery**, prompt-injection flagging, table sort whitelist, department/officer rules,
  lockout/reset/verification tokens, and more.
- **Production-parity test:** `ansiQuotes.test.js` forces `sql_mode=ANSI_QUOTES` (as on Aiven) —
  it exists because a double-quoted SQL literal once passed locally and failed in production.
- **22 frontend unit tests** (Vitest): completeness logic, geo helpers, translation completeness,
  pagination and formatters.
- **68 browser tests** (Playwright, desktop + phone viewport): login/logout, every admin page
  loading with no error panel or console errors, real PDF/CSV downloads, department and officer
  workflows, the full citizen report flow, access guards, table behaviours, mobile checks.
- **CI** runs the suites on push.

---

## 35. Deployment architecture

```
 React 18 · Vite · TypeScript · Tailwind · TanStack Query · Recharts · Leaflet   (Vercel)
                         │  HTTPS + JWT
 Express API · Helmet · CORS · rate limits · request-id/latency middleware       (Render)
   Controller → Service → Model (parameterised SQL, no ORM)
                         │
        MySQL (Aiven, TLS)     OpenAI (chat + embeddings)     Cloudinary (images)
```

- **Tech:** Node ≥ 18, Express 4, Zod, JWT, bcryptjs, multer, jimp, nodemailer, web-push;
  MySQL 8+ via `mysql2`; OpenAI Chat Completions (JSON mode) + Embeddings; embeddings stored in
  MySQL and compared with cosine similarity in Node (no vector DB).
- **Migrations** are ordered and tracked (`_migrations`), and **additive**; applied on boot when
  `AUTO_MIGRATE=true`.
- **Heavy admin pages are code-split** so citizens and officers never download charts or maps.
- **Live:** [ai-bmc-complaint-triage.vercel.app](https://ai-bmc-complaint-triage.vercel.app) ·
  API [ai-bmc-complaint-triage.onrender.com](https://ai-bmc-complaint-triage.onrender.com)
  (`/health`; first request after idle can take 30–60 s on Render's free tier).

---

## 36. Honest limitations

- Seed data, wards, SLAs and departments are synthetic.
- Forecasting is Holt linear (no seasonality); coarse with only weeks of data — the backtest is
  shown so you can judge it.
- Anomaly "location" is a ~1.1 km grid cell, not an administrative boundary.
- Photo hashing can miss heavily edited copies; what a photo *shows* is advisory model output.
- Text-only duplicate fallback is weaker than the embedding path (deliberately stricter).
- Metrics are per-instance and in-memory; costs are estimates, not billing data.
- Background jobs are in-process (advisory locks protect multi-instance runs).
- PDF cannot print Devanagari; CSV keeps the original text.
- Translations cover citizen screens; Hindi/Marathi strings should be reviewed by a native
  speaker.
- Password reset requires SMTP; Web Push requires VAPID keys.
- Resolution impact is an observed comparison, not causal analysis.
- Resolution verification and the officer copilot are advisory; staff can always override.
- Real-time updates use polling (30–120 s), not WebSockets.

---

## 37. Suggested demo order

1. **Citizen** — report a Hinglish complaint with a photo; show the completeness hint, the
   duplicate warning and the AI assistant.
2. **Complaint page** — AI assessment, evidence breakdown, **decision factors**, SLA countdown.
3. **Incident** — a second similar report clusters into one incident; show incident intelligence.
4. **Admin Command Center** — headline metrics, **GIS map** (heatmap + DBSCAN hotspots).
5. **Operations** — anomalies and forecast (point out the honest backtest/"insufficient data").
6. **SLA & escalations** — auto-escalated, acknowledgeable events; edit an SLA target.
7. **Human review** — correct a category; show the **audit log** before/after.
8. **AI & system** — run the offline evaluation, show usage/cost and system health.
9. **Departments / Officers** — 20 departments, ward-aware officer recommendation, deactivation
   guard.
10. **Close** — AI proposes, deterministic code decides, humans stay in control.
