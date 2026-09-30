# Civic Connect — Civic AI Intelligence & Response Platform

An AI-assisted municipal (BMC-style) complaint management platform that goes well beyond
"CRUD + an LLM". Citizens report civic issues in English, Hindi, Hinglish or Marathi, with
photos and a map location. The system **understands** the report with a validated,
structured AI analysis, **scores the evidence**, **finds duplicates and clusters them into
incidents**, **decides** priority / routing / SLA with an explainable rule engine,
**escalates** what needs attention, puts a **human in the loop** for uncertain decisions,
and gives operators a **command center** with GIS, hotspots, anomaly detection,
forecasting, department workload, an audit trail, and AI quality / cost / health
monitoring.

> **Design principle — AI proposes, deterministic code decides.**
> The LLM only produces *signals* (category, severity signals, risk indicators, urgency,
> confidence). Priority, routing, SLA, escalation, duplicate linking, hotspots, anomalies and
> forecasts are computed by deterministic, tested, auditable code. The LLM's output is
> schema-validated, sanitised and never trusted to drive a sensitive operation.

- **Live app:** [ai-bmc-complaint-triage.vercel.app](https://ai-bmc-complaint-triage.vercel.app) (Vercel)
- **API:** [ai-bmc-complaint-triage.onrender.com](https://ai-bmc-complaint-triage.onrender.com) — [`/health`](https://ai-bmc-complaint-triage.onrender.com/health) (Render free tier: the first request after idle can take 30–60 s to cold-start)

> **Disclaimer:** demo/seed data, ward names, SLA targets and department names are
> **synthetic application rules**, not official BMC operational data or policy.

---

## Table of contents

1. [What's in the platform](#whats-in-the-platform)
2. [System architecture](#system-architecture)
3. [Tech stack](#tech-stack)
4. [Repository layout](#repository-layout)
5. [The complaint pipeline, step by step](#the-complaint-pipeline-step-by-step)
6. [Intelligence capabilities in depth](#intelligence-capabilities-in-depth)
   - [Structured AI output & safety](#61-structured-ai-output--ai-safety)
   - [Evidence intelligence](#62-evidence-intelligence)
   - [Hybrid decision engine](#63-hybrid-decision-engine)
   - [Duplicate detection](#64-duplicate-detection)
   - [Incident clustering & command view](#65-incident-clustering--incident-command-view)
   - [Hotspots, heatmap & GIS](#66-hotspots-heatmap--gis)
   - [Anomaly detection](#67-anomaly-detection)
   - [Forecasting](#68-forecasting)
   - [Department workload](#69-department-workload)
   - [SLA engine](#610-sla-engine)
   - [Escalation engine](#611-escalation-engine)
   - [Human-in-the-loop & AI feedback](#612-human-in-the-loop--ai-feedback-loop)
   - [Image intelligence](#613-image-intelligence)
   - [Timeline & audit log](#614-complaint-timeline--audit-log)
   - [Notifications](#615-notification-architecture)
   - [Search](#616-search)
   - [AI evaluation framework](#617-ai-evaluation-framework)
   - [AI usage & cost monitoring](#618-ai-usage--cost-monitoring)
   - [Observability & background jobs](#619-observability--background-jobs)
7. [Frontend](#frontend)
8. [Roles & permissions](#roles--permissions)
9. [Setup](#setup)
10. [Environment variables](#environment-variables)
11. [Database & migrations](#database--migrations)
12. [API reference](#api-reference)
13. [Testing](#testing)
14. [Security](#security)
15. [Render deployment](#render-deployment) · [Vercel deployment](#vercel-deployment-frontend)
16. [Troubleshooting](#troubleshooting)
17. [Limitations & honesty notes](#limitations--honesty-notes)
18. [Future improvements](#future-improvements)

Deeper reference docs: [`docs/architecture.md`](docs/architecture.md) ·
[`docs/ai-pipeline.md`](docs/ai-pipeline.md) · [`docs/api.md`](docs/api.md) ·
[`docs/database-schema.md`](docs/database-schema.md) · [`docs/demo-flow.md`](docs/demo-flow.md)

---

## What's in the platform

| Area | What it does |
|---|---|
| **Citizen experience** | Multilingual submission with photos + map picker, guided AI assist, pre-submission duplicate warning, status tracking with a public-safe timeline and SLA countdown, feedback, reopen, in-app notifications |
| **AI understanding** | One unified, Zod-validated structured analysis: category, subcategory, language, summary, severity signals, urgency, risk indicators, location relevance, recommended action, explanation factors, image assessment |
| **Evidence intelligence** | Deterministic 0–100 evidence score from 9 auditable signals (+ red-flag penalties) |
| **Decision engine** | Explainable priority: rules + AI signals + duplicate volume + history + evidence, with safety floors and human-review gates |
| **Duplicates & incidents** | Semantic + lexical + geo + time + category + photo similarity; calibrated duplicate probability; persisted, reviewable suggestions; automatic incident grouping |
| **GIS** | Markers, heatmap, DBSCAN hotspots, incident zones, anomaly areas, filters (category, severity, status, department, date) |
| **Analytics** | Trends, week-over-week, department workload, SLA performance, AI confidence distribution, duplicate rate |
| **Anomalies** | Robust statistical surge detection (volume / category / department / location / severity / resolution time) |
| **Forecasting** | Holt linear-trend forecasts with prediction intervals and honest backtests — or an explicit "insufficient data" |
| **SLA & escalation** | Configurable SLA policies, per-complaint snapshots, rule-based escalation events (SLA, unassigned high-severity, recurring problems, major incidents, surges) |
| **Human review** | Approve / correct / false-positive / confirm or reject duplicates; every review stored beside the AI value for measurement |
| **Governance** | Audit log, complaint timelines, AI evaluation suite, AI usage & cost tracking, request/latency/error metrics, background job history |
| **Resilience** | AI outage ⇒ complaint preserved, rule-based fallback routing/priority/SLA, review flag, automatic retry job |

---

## System architecture

```
 Citizen / Officer / Admin UI  (React 18 · Vite · TypeScript · Tailwind · TanStack Query · Recharts · Leaflet)
                         │  HTTPS + JWT
                         ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Express API  (Helmet · CORS · rate limits · request-id/latency middleware) │
 │   Controller  →  Service  →  Model (parameterised SQL, no ORM)             │
 └───────────────────────────────────────────────────────────────────────────┘
        │                     │                          │
        ▼                     ▼                          ▼
  Complaint pipeline    Analytics engines        Governance layer
  (AI + rules)          (hotspot/anomaly/        (audit, timeline, jobs,
                         forecast/workload)       metrics, AI usage, eval)
        │                     │                          │
        └───────────────┬─────┴──────────────────────────┘
                        ▼
                MySQL (Aiven in production)     OpenAI (chat + embeddings)     Cloudinary (images)
```

### Decision flow

```
Complaint submitted
   │  validation · image signature check · perceptual hash + blur (local) · Cloudinary upload
   ▼
AI understanding ── validated, sanitised, injection-guarded ──▶ (fails? → rule-based fallback)
   ▼
Embedding → duplicate/related search (semantic + text + geo + time + category + photo)
   ▼
Evidence score  ──┐
Historical repeat ─┼─▶ Hybrid decision engine ─▶ priority · review gates · decision factors
Duplicate volume ──┘
   ▼
Deterministic routing (category → department) · SLA snapshot from policy
   ▼
Incident grouping (strong, category-compatible matches only)
   ▼
Timeline events · audit log · notifications  →  Staff review / SLA / escalation / analytics
```

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, React Router 6, Tailwind CSS, jsPDF (PDF export) | Existing design system (`card`, `btn`, `badge`, `input` classes) extended, not replaced |
| Server state | **TanStack Query** | Caching, polling, retries and loading/error states for the many dashboards |
| Charts / maps | Recharts; React-Leaflet + `leaflet.markercluster` + `leaflet.heat` | OpenStreetMap tiles (no Google Maps) |
| Backend | Node ≥ 18, Express 4, Zod, JWT, bcryptjs, Helmet, express-rate-limit, multer | Controller → Service → Model |
| Database | MySQL 8+ (`mysql2`, parameterised SQL) | Aiven in production (TLS) |
| AI | OpenAI Chat Completions (JSON mode) + Embeddings | Every call goes through one instrumented client (usage/latency/cost) |
| Image analysis | `jimp` (pure JS) | dHash perceptual hash + Laplacian sharpness; no native binaries |
| Email (optional) | `nodemailer` | Only active when `SMTP_HOST` is set |
| Storage | Cloudinary | Server-side credentials only |

---

## Repository layout

```
backend/
  database/
    migrate.js                 migration runner (also used by AUTO_MIGRATE)
    migrations/001_init.sql            core schema
    migrations/002_intelligence.sql    AI-enrichment tables
    migrations/003_civic_platform.sql  platform layer (additive)
    seed.js · seed-complaints.js       demo data
  evals/dataset.json           labelled AI evaluation cases
  src/
    app.js · server.js         wiring, middleware, jobs & auto-migrate on boot
    config/                    env, db, openai (instrumented client), cloudinary
    middleware/                auth/RBAC, upload (+ signature check), validate, error, requestLogger
    routes/ · controllers/     thin HTTP layer
    models/                    all SQL lives here
    services/
      ai/            analysis, prompts, response parser (Zod), aiSafety, aiUsage, embeddings, copilot…
      decision/      evidence.service, decisionEngine.service
      complaint/     analysisPipeline, priority, routing, sla, slaPolicy, escalation(+Engine),
                     hotspot, timeline, incidentIntelligence, status, reopen…
      duplicate/     duplicateDetection, incidentGrouping
      analytics/     analytics, anomaly, forecast, departmentWorkload
      review/        humanReview, feedbackMetrics
      image/         imageIntelligence
      evaluation/    evaluation
      audit/ · notification/(+channels) · observability/ · jobs/ · admin/
    utils/             constants (ALL tunables), geo (DBSCAN), textSimilarity, imageFormat, vectorMath, logger
  tests/               unit/ + api/  (140 tests)
frontend/
  src/
    pages/             citizen/ · officer/ · admin/ (Dashboard, MapView, Operations, SlaEscalations, AiSystem, AuditLog…)
    components/        ui/kit (PageHeader, QueryBoundary, Tabs, Meter…), complaint/, layout/, map/, common/
    services/          api.ts (axios) · platform.service.ts (typed client for the intelligence APIs)
docs/                  architecture, AI pipeline, API, schema, demo flow
render.yaml            Render blueprint (backend)
```

---

## The complaint pipeline, step by step

Implemented in `backend/src/services/complaint/analysisPipeline.service.js`.

1. **Intake** — `POST /api/complaints` validates the body (Zod), checks each image's **real file signature** (magic bytes, not the client MIME), computes a perceptual hash + sharpness locally, uploads to Cloudinary, stores the complaint and images in one transaction, and writes a `CREATED` timeline event + audit entry.
2. **AI understanding** — complaint text is sanitised (control characters stripped, prompt delimiters neutralised, length bounded, injection phrases detected) and sent with the photos. The response is parsed with Zod (enums coerced to safe values, markup stripped, lengths bounded). Any failure yields `success: false`, never an exception.
3. **Embedding + related search** — the summary+description embedding is stored; candidates are pre-filtered by radius/time in SQL and scored in Node. **If embeddings are unavailable, detection degrades to a stricter text+geo path** instead of switching off.
4. **Image similarity** — photo hashes are compared with related complaints and with recent photos elsewhere. Same picture at the same spot ⇒ duplicate candidate; same picture at a different location ⇒ a human-review reason.
5. **Evidence score** and **historical repeat count** are computed.
6. **Hybrid decision** — priority, factors and review gates (see §6.3).
7. **Routing + SLA** — category → department (deterministic map); SLA hours resolved from `sla_policies` and **snapshotted** on the complaint.
8. **Persistence** — `complaints` updated, `complaint_decisions` upserted (AI output, evidence signals, factors, engine version).
9. **Status transitions** — `AI_ANALYZED`, then `ASSIGNED` unless a review is required (`NEEDS_REVIEW` on AI failure).
10. **Incident grouping** — only *strong, category-compatible* matches join an incident; the incident's priority is re-escalated.
11. **Notifications** to department officers; **audit** entry.

**Graceful degradation:** every optional step (embedding, duplicates, image similarity, history, persistence of suggestions) is wrapped so a failure is logged and counted but never fails the complaint. If the AI call itself fails, the complaint still gets a fallback department (General Administration), a rule-based priority, an SLA, `NEEDS_REVIEW` status, and is retried by the `ai_retry` job (max 4 attempts). A **human-corrected complaint is never overwritten** by automatic re-analysis.

---

## Intelligence capabilities in depth

### 6.1 Structured AI output & AI safety

`services/ai/aiResponseParser.js`, `aiSafety.js`, `prompt.service.js`

The model must return one JSON object with: `title`, `category` (enum), `subcategory`, `language`, `summary`, `normalized_description`, `confidence`, `missing_information`, `severity_signals` (11 booleans), **`urgency`** (`LOW/NORMAL/HIGH/IMMEDIATE`), **`recommended_action`**, **`location_relevance`** (`CLEAR/VAGUE/MISSING`), **`risk_indicators`** (allow-listed enum list), **`explanation_factors`** (≤5 short factual phrases — *no chain-of-thought is requested or stored*), `image_analysis`, `moderation`.

Protections:

| Threat | Defence |
|---|---|
| Malformed / non-JSON output | Parser returns failure → fallback path (never trusted) |
| Hallucinated category / urgency / location relevance | `z.enum(...).catch(safeDefault)` (e.g. unknown category → `OTHER`) |
| Invented risk indicators | Filtered against `RISK_INDICATORS` allow-list |
| Excess output / markup / XSS in model text | `cleanModelText`: tags stripped, control chars removed, hard length caps |
| Prompt injection via complaint text | Delimiter neutralisation, length cap, **pattern detection** (`ignore previous instructions`, `system:`, `set the priority to …`, etc.) ⇒ complaint still accepted but flagged for human review; system prompt tells the model the text is untrusted data |
| AI controlling sensitive operations | It cannot: only signals reach the decision engine; priority/routing/SLA are code |

Older/partial responses still validate (all extended fields have defaults), so upgrades are backward-compatible.

### 6.2 Evidence intelligence

`services/decision/evidence.service.js` — pure function, fully unit-tested.

Nine signals, each with `points`, `max`, `status` (`positive/neutral/negative`) and a plain-language `detail`:

| Signal | Max | Source |
|---|---:|---|
| Description detail | 15 | word count (spam ⇒ 0) |
| Location detail | 15 | typed address + AI `location_relevance` |
| Photo attached | 10 | image count |
| Photo quality | 10 | AI verdict, **downgraded by locally measured blur** |
| Photo matches complaint | 10 | AI `image_supports_claim` × evidence confidence |
| AI classification confidence | 15 | model confidence |
| Corroborating reports | 15 | strong, category-compatible related complaints |
| Recurring location | 5 | earlier same-category reports within 150 m / 60 days |
| Recent corroboration | 5 | related reports within 72 h |

Signals that **do not apply** (e.g. photo quality with no photo, AI confidence when AI failed) are excluded from the denominator instead of counted as zero. Red flags subtract points: manipulated image (−15), unrelated image (−10), instruction-like text (−10). Bands: **STRONG ≥ 75**, **MODERATE ≥ 50**, **WEAK ≥ 30**, else **INSUFFICIENT** (shown in the UI as *Strong / Moderate / Limited / Very limited*).

### 6.3 Hybrid decision engine

`services/decision/decisionEngine.service.js` — pure, versioned (`DECISION_ENGINE.version`), every step emitted as a named **decision factor** `{source, label, points}`.

```
base priority (category tier + AI severity signals + duplicate volume + age)     ← priority.service (unchanged)
 + AI risk indicators not already covered by a signal          (capped at +10)
 + recurring-location history                                  (+8)
 ± evidence adjustment                                         (STRONG +4 · INSUFFICIENT −5)
 → safety floors:    injury_reported / emergency_access_blocked  ⇒ at least HIGH
 → AI "IMMEDIATE" urgency honoured only if confidence ≥ 0.6 AND evidence ≠ INSUFFICIENT
 → human-review gates
```

It is deliberately **not an average**. Floors and gates are hard rules. Review gates: low AI confidence, `OTHER` with weak confidence, spam/irrelevance, unverified "immediate" urgency, instruction-like text, image concerns, **HIGH/CRITICAL priority resting on weak, uncorroborated evidence** ("verify before dispatch" — priority is *not* silently downgraded), and AI unavailable.

All weights and thresholds live in `backend/src/utils/constants.js`.

### 6.4 Duplicate detection

`services/duplicate/duplicateDetection.service.js`, `models/duplicate.model.js`

Signals: embedding cosine similarity, lexical similarity (word Jaccard + character-trigram Dice, works for Devanagari), distance, recency, category-family match, photo perceptual similarity.

- **Duplicate probability** (0–1) is a calibrated blend used for ranking/explanation. With embeddings: `0.45·semantic + 0.20·text + 0.15·distance + 0.10·time + 0.10·category`; text-only: `0.55·text + 0.20·distance + 0.10·time + 0.15·category`; photo similarity blends in at 20 %.
- **Linking rule** (`isLinkable`): probability ≥ 0.6, category-compatible, and — for text-only evidence — within 150 m (wording alone doesn't prove the same physical spot). Different-category neighbours stay "related", not "same incident".
- Suggestions are **persisted** in `complaint_duplicates` with indicators (`Very similar meaning`, `Same spot (<50 m)`, `Visually similar photo`, …) and review state `SUGGESTED / CONFIRMED / REJECTED`.
- **Nothing is ever deleted or silently merged.** Staff can confirm (link into an incident) or reject (detach from the incident; both reports remain).

### 6.5 Incident clustering & incident command view

Complaints that describe one real-world problem are grouped into an **incident** (`INC-YYYY-NNNN`) with escalated priority (geographic concentration + duration bonuses). `GET /api/incidents/:id` now also returns `intelligence`:

complaint / open counts · categories affected · worst severity · first & latest report · **trend** (`RISING/STABLE/FALLING`, or `INSUFFICIENT_DATA` under 3 reports — never guessed) · **extent** (centroid, containing radius, bounds) · worst SLA state, breached count, next deadline · escalation events.

### 6.6 Hotspots, heatmap & GIS

`services/complaint/hotspot.service.js`, `utils/geo.js`

- **Hotspot v2** uses **DBSCAN** (grid-indexed) per category — so an elongated problem (potholes along a road) becomes *one* hotspot rather than arbitrary circles. Defaults: 350 m radius, min 3 complaints.
- Each hotspot reports count, radius, area, density/km², severity-weighted density, unresolved count & share, last-48 h count & share, incident count, dominant priority, and a transparent score:
  `score = severityWeightedCount × (1 + recentShare) × (0.5 + 0.5 × unresolvedShare)`.
- Filters (validated, parameterised): category, severity list, status (`open`/`closed`/exact), department, days or date range, radius, min complaints.
- **Heatmap** returns severity-weighted `[lat, lng, weight]` points (resolved complaints count half).
- The original greedy `detectHotspots` remains for the Intelligence Center.

### 6.7 Anomaly detection

`services/analytics/anomaly.service.js` — no LLM involved.

The latest 24 h bucket is compared with up to 28 preceding daily buckets using a **robust z-score**: `(observed − median) / max(1.4826·MAD, √mean, 1)`. An anomaly must also have **score ≥ 3**, **≥ 5 events**, and **≥ 1.5× the baseline mean**, so "0 → 3" is never a surge and earlier spikes don't desensitise the detector.

Dimensions: overall volume · per category · per department (incoming workload) · geographic (~1.1 km grid cells) · high/critical severity · resolution-time slowdown. Each anomaly carries score, baseline (median/mean/MAD/days), observed value, window, location, and a plain explanation. With fewer than 7 observable days it returns `sufficientData: false` and **no anomalies**.

### 6.8 Forecasting

`services/analytics/forecast.service.js`

**Holt's linear trend** (double exponential smoothing) with ~80 % prediction intervals from in-sample errors and a **7-day hold-out backtest against a naive baseline** (shown in the UI, including when the model is *no better than a simple average*). Forecast series: overall daily volume, top-5 categories, top departments' incoming workload, and the **unresolved backlog**. Requires ≥ 14 days of history and ≥ 5 active days — otherwise `{available:false, reason}`. The current, incomplete day is excluded; negatives are floored at 0.

### 6.9 Department workload

`services/analytics/departmentWorkload.service.js` — per department: assigned, pending, in-progress, resolved, overdue, pending high-priority, average resolution hours, incoming 7 d vs previous 7 d (trend), category distribution, and
`slaCompliance = withinSla / (withinSla + afterSla + openBreached)` — `null` (shown as "no data") until something has actually been judged, never a fake 100 %. Drill-down returns a 30-day incoming-vs-resolved series.

### 6.10 SLA engine

`services/complaint/sla.service.js`, `slaPolicy.service.js`, table `sla_policies`

- Targets are **configurable per priority and optionally per category** (`category_key '*'` = default) and edited in the UI; every change is audited. Built-in constants are the fallback (defaults: Critical 12 h, High 24 h, Medium 48 h, Low 72 h, warn at 80 %).
- The applicable hours are **snapshotted** in `complaints.sla_hours`, so a later policy edit doesn't rewrite history.
- `slaSnapshot()` gives start, deadline, target hours, status (`ON_TRACK / APPROACHING / BREACHED / COMPLETED_*`), remaining time, breach/warning flags and resolution time.
- A human priority correction recomputes the deadline from the original creation time.

### 6.11 Escalation engine

`services/complaint/escalation.service.js`, `escalationEngine.service.js`, table `escalation_events`

Deterministic, idempotent (unique `dedupe_key`), each traceable to the rule and numbers that fired it:

| Rule | Fires when |
|---|---|
| `SLA_APPROACHING` / `SLA_BREACHED` | complaint crosses its warning ratio / deadline (once per complaint per state) |
| `HIGH_SEVERITY_UNASSIGNED` | CRITICAL still has no officer after 2 h / HIGH after 8 h |
| `REPEATED_COMPLAINTS` | ≥ 3 same-category reports within 150 m / 30 days, at least one resolved and one open again |
| `MAJOR_INCIDENT` | open incident reaches 5 (HIGH) or 10 (CRITICAL) complaints |
| `SURGE_*` | anomaly score ≥ 4 (derivative department/severity surges are suppressed when a volume/category surge already explains them) |

Events auto-resolve when their complaint/incident closes, notify admins, add complaint timeline entries and audit records, and can be **acknowledged** in the UI.

### 6.12 Human-in-the-loop & AI feedback loop

`services/review/humanReview.service.js`, `feedbackMetrics.service.js`

Actions (`POST /api/complaints/:id/review`): **APPROVE**, **CORRECT** (category / priority / department; a category change re-routes deterministically unless a department is chosen; SLA recomputed), **FALSE_POSITIVE** (closes, preserves), **CONFIRM_DUPLICATE**, **REJECT_DUPLICATE**. Admins may review anything; officers only their own department's complaints. Each review stores the AI/system value next to the human value (`human_reviews`), an audit entry, and a timeline event.

`GET /api/admin/ai-performance` reports (only from *staff-reviewed* complaints, with sample sizes): classification accuracy, priority agreement, routing agreement, correction/approval rate, false positives, duplicate precision, confidence calibration (avg confidence when right vs corrected), confidence distribution. Below 5 reviews it says **insufficient data**. **Nothing retrains a model from this data** — it is evaluation only.

### 6.13 Image intelligence

`services/image/imageIntelligence.service.js`, `utils/imageFormat.js`

Computed **locally** at upload: 64-bit **dHash** perceptual hash, **Laplacian-variance sharpness**, brightness, dimensions. Magic-byte validation rejects forged files; header-parsed dimensions refuse decompression bombs (> 40 MP skip analysis). Used for blur downgrade in evidence, duplicate-photo detection, and reuse-at-another-location flags. These are *measurements*; what the photo *shows* comes only from the vision model and is presented as advisory. If a photo can't be decoded, analysis is reported as unavailable and the complaint continues.

### 6.14 Complaint timeline & audit log

- **Timeline** (`GET /complaints/:id/timeline`) merges the authoritative status history with `complaint_events` (AI analysed, evidence scored, priority set, department assigned, duplicates found, incident linked, human review, SLA warning/breach, escalated). Citizens receive **only public events with internal detail removed**.
- **Audit log** (`audit_logs`, `GET /api/admin/audit-logs`): actor, role, action, entity, **before / after**, timestamp. Values are sanitised (credential-like keys redacted at any depth, strings truncated). Audit failures never break the audited operation. Covers creation, AI analysis/fallback, status changes, assignments, admin edits, reviews, incident merges/status, SLA policy changes, escalations, evaluation runs and job triggers.

### 6.15 Notification architecture

`services/notification/` — `notify()` is the single entry point; delivery goes through **channels** (`{name, isEnabled(), send()}`): `in_app` (always on, system of record) and `email` (nodemailer, only when `SMTP_HOST` is set, limited to `EMAIL_NOTIFY_TYPES`). Adding SMS/push = one new file in `channels/` + one registry line. A failing channel never throws into business logic.

### 6.16 Search

- Admin complaint list filters: text (description, address, AI title, complaint number), category, status, priority, **SLA status**, department, officer, **incident**, **citizen (name/email)**, **complaint id**, **date range**.
- **Semantic search** (`GET /api/admin/search/semantic`): embeds the query and ranks recent complaints by meaning; automatically falls back to keyword search and *says so* (`mode: "keyword"`).
- **AI natural-language search** (existing) still produces only a JSON filter validated against an allow-list — the model never writes SQL.

### 6.17 AI evaluation framework

`backend/evals/dataset.json`, `services/evaluation/evaluation.service.js`

~60 hand-labelled cases (plus 15 summary-relevance checks in live mode): classification (English/Hindi/Hinglish/Marathi), summary relevance, routing, priority, duplicate scoring, prompt-injection detection, AI-output validation, and image checks (synthetic images for blur and perceptual similarity).

- **Offline mode** (no OpenAI needed) runs everything deterministic and is used as a regression guard.
- **Live mode** additionally calls the model for classification/summaries (small cost).
- Tasks that can't run are reported **skipped with a reason** — never counted as agreement. Results are stored in `ai_evaluations`; run from the UI (AI & system → AI quality) or `POST /api/admin/evaluations/run`.

### 6.18 AI usage & cost monitoring

All OpenAI calls pass through one instrumented client (`config/openai.js`). Each call records use case, model, tokens, **estimated** cost (list-price table in `aiUsage.service.js`; unknown models report `null`), latency and success in `ai_usage`. `GET /api/admin/ai-usage` shows totals, failure rate, per-use-case and per-model breakdown, and daily cost, and flags the most expensive workflow.

### 6.19 Observability & background jobs

- **Request middleware**: `X-Request-Id` on every response, latency histograms per *route pattern*, status-class counters, structured JSON logs (method, route, status, ms, user id — never bodies, queries, headers or tokens). Errors are classified (`api`, `ai`, `database`, `external`, `image`, `job`) and kept in a bounded ring buffer.
- `GET /api/admin/observability`: DB round-trip, uptime, slowest endpoints (p50/p95), error counts, recent errors, job definitions & history, AI status, active notification channels. Metrics are **in-process and reset on restart** (durable history lives in `ai_usage`, `job_runs`, `audit_logs`).
- **Background jobs** (in-process, overlap-guarded, recorded in `job_runs`; no Redis/queue): `sla_check` 5 min · `escalation_rules` 10 min · `anomaly_scan` 15 min · `ai_retry` 10 min. Disable with `ENABLE_BACKGROUND_JOBS=false`; trigger manually from the UI. SLA checks also run lazily when an admin opens the SLA/intelligence views, so behaviour is correct even on a host that sleeps.

---

## Frontend

Kept the existing stack and design system (Tailwind, Recharts, React-Leaflet, custom icon set) and extended it — a full migration to shadcn/Radix was not justified because the existing component vocabulary is already consistent. **TanStack Query** was added for server state; **`leaflet.heat`** for the heatmap layer. Heavy admin pages are **code-split** (`React.lazy`), so citizens and officers never download charts/maps.

### Screens

| Role | Route | Screen |
|---|---|---|
| Admin | `/admin` | **Command Center** — 8 headline metrics (each links to its detail view), review-queue banner, demand trend, SLA state, open hotspots, anomalies, department workload (pending vs overdue), AI confidence distribution, duplicate rate, critical & breached lists. Auto-refreshes every 60 s |
| Admin | `/admin/map` | **GIS command center** — complaint markers (clustered), heatmap, DBSCAN hotspot zones, incident zones, anomaly areas; filters (category, severity, status incl. *unresolved*, department, date range); side panel with ranked hotspots and drill-down; deep-link `?focus=lat,lng` |
| Admin | `/admin/complaints` | Search & filters (SLA, incident, citizen, department, dates), **semantic search** with keyword-fallback notice, responsive table → cards |
| Admin | `/admin/incidents/:id` | Incident command view + **Incident intelligence** panel |
| Admin | `/admin/review` | **Review queue** — why each complaint was flagged, quick approve, inspect & decide |
| Admin | `/admin/operations` | **Anomalies** · **Forecast & expected demand** (with uncertainty band + backtest) · **Department workload** with drill-down |
| Admin | `/admin/sla` | **SLA monitor** (sortable at-risk list) · **Escalations** (filter, acknowledge, evaluate now) · **Targets** (edit SLA policy) |
| Admin | `/admin/ai` | **AI quality** (AI-vs-staff metrics, evaluation suite) · **Usage & cost** · **System health** (DB, latency, errors, jobs with run-now) |
| Admin | `/admin/audit` | Audit log with filters, pagination and before/after diff |
| Staff & Admin | `/complaints/:id` | Complaint page: SLA panel, **AI assessment** (category, priority, confidence, evidence strength, review reasons), **decision factors** with source tags, evidence signal breakdown, **related complaints** with link / "not related" actions, **staff review panel**, unified **timeline** with icons |
| Citizen | `/complaints/:id` | Same page with a **public-safe timeline**, SLA countdown and related-complaint notice; no internal insights |
| All | — | Existing citizen submit/track/feedback/reopen, officer queue + copilot, Intelligence Center, Analytics, public transparency dashboard |

### PDF reports

Generated **in the browser** (`jspdf` + `jspdf-autotable`, loaded only when a button is clicked, so they add nothing to the initial bundle) from data the signed-in user can already see - no extra server load and no new permissions. Every report has the Civic Connect header, page numbers, a generation timestamp and a data-scope footer.

| Where | Button | Contents |
|---|---|---|
| Complaint page (citizen) | **Download receipt** | ID, status, category, location, target date, description, public timeline |
| Complaint page (staff) | **Export PDF** | Above plus AI assessment, evidence score, decision factors, internal timeline |
| Incident page | **Export PDF** | Overview, severity, trend, affected area, SLA state, linked complaints |
| Command Center | **Export PDF** | Headline metrics, SLA state, anomalies, hotspots, department workload |
| SLA & escalations | **Export PDF** | Summary, targets, at-risk complaints |
| Admin complaints list | **Export page (PDF)** | The current filtered page as a table |
| Audit log | **Export page (PDF)** | The current filtered page with before/after values |
| Public dashboard | **Download summary (PDF)** | Anonymous aggregates only |

Charts are not embedded - reports contain the underlying figures as tables. **Limitation:** the standard PDF fonts cover Latin text only, so Hindi/Marathi text is replaced by `[non-Latin text]` (the English AI summary is included alongside) rather than printed garbled.

Cross-cutting UX: skeleton loading on every data page, explicit error panel with **Try again**, empty states, **"Insufficient data"** panels wherever the backend declines to produce a number, text labels alongside colour for priority/status/SLA, keyboard-operable tabs/tables with `aria-*` roles, `role="img"` chart labels, mobile scrollable nav (all links reachable), table→card layouts on small screens.

---

### Account security, languages, field work and more

| Feature | Where | Notes |
|---|---|---|
| **Password reset** | `/forgot-password` -> email link -> `/reset-password` | One-time, 1-hour link. Only a SHA-256 hash of the token is stored; issuing a new link invalidates the old one; the endpoint answers identically for unknown emails. **Requires SMTP** (`SMTP_HOST`); without it the UI says reset by email is not enabled instead of offering a broken flow |
| **Email verification** | banner in the app + `/verify-email` | Never blocks use of the app; shown only when the server can send email |
| **Login lockout** | `POST /api/auth/login` | 5 wrong passwords lock the account for 15 minutes (a correct password during the lock is also refused); a reset clears it; lock events are audited. Responses never expose lockout fields |
| **Hindi / Marathi interface** | language picker (app bar, auth pages, mobile drawer) | Citizen-facing screens, navigation, footer, and every status / priority / category label. English is the fallback for any untranslated string. Switching language re-renders the page, so an unsent draft is not preserved. Staff/admin screens and the landing page remain English |
| **Complaint completeness hint** | report form | A transparent checklist (description detail, impact, pinned location, landmark, photo) with supportive suggestions. Explicitly **not AI** and never blocks submission |
| **Field view** | `/officer/field` | Mobile-first: open tasks nearest-first (browser geolocation, never sent to the server), task map, one-tap Accept / Start, turn-by-turn Navigate |
| **Recurring problems** | `/admin/recurring` | Places where a problem was fixed and then reported again within ~150 m (fixes, reopenings, status) |
| **Resolution impact** | `/admin/recurring?tab=impact` | Complaints of the same kind 30 days before vs after each fix. Labelled an *observed comparison, not proof of cause* |
| **CSV export** | complaints, audit log, SLA list, officer queue, recurring problems | UTF-8 with BOM (Devanagari opens correctly in Excel). Cells starting with `= + - @` are neutralised to prevent spreadsheet formula injection |
| **Browser push notifications** | Profile -> Device notifications | Web Push (VAPID). Enabled only when `VAPID_*` keys are set; dead subscriptions are pruned automatically |
| **DB certificate pinning** | `DB_SSL_CA` | When set, the database server certificate is verified, not merely encrypted |
| **Multi-instance safe jobs** | scheduler | A MySQL advisory lock (`GET_LOCK`) ensures one instance runs each background job |
| **Crash containment** | `ErrorBoundary` | A failing panel shows a calm message with retry instead of blanking the page |

## Roles & permissions

Roles are `CITIZEN`, `OFFICER` (staff, department-scoped) and `ADMIN` (system administrator). A separate "department admin" role was deliberately not added: officers are scoped to their department and admins have global scope, which covers the needs without a schema/JWT change. **Backend authorisation is authoritative**; frontend role checks are only UX.

| Capability | Citizen | Officer | Admin |
|---|:--:|:--:|:--:|
| Submit / track own complaints, own timeline & SLA | ✅ | — | ✅ (view) |
| Decision trace, evidence, related complaints | ❌ | ✅ | ✅ |
| Review (approve/correct/duplicates) | ❌ | own department | ✅ all |
| Analytics, hotspots, anomalies, forecast, SLA, escalations | ❌ | ❌ | ✅ |
| Audit log, AI performance/usage/evaluation, observability, jobs | ❌ | ❌ | ✅ |
| Edit SLA policy, run escalation rules | ❌ | ❌ | ✅ |

---

## Setup

Prerequisites: Node.js 18+, MySQL 8+ (tested on 9.4 locally and Aiven over TLS), an OpenAI key (optional for local work — the app degrades gracefully without one), Cloudinary credentials (for photo uploads).

```bash
# Backend
cd backend
npm install
cp .env.example .env            # fill DB credentials, JWT_SECRET, keys
npm run migrate                 # applies 001 → 003 (also auto-applied on server start)
npm run seed                    # departments, demo wards, admin, officers, citizens
npm run seed:complaints         # ~60 synthetic complaints, incidents, SLA breaches, feedback
npm run dev                     # http://localhost:5000

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env            # VITE_API_BASE_URL=http://localhost:5000/api
npm run dev                     # http://localhost:5173
```

Demo accounts (password `Password123!`): `admin@civicconnect.demo`, `officer.roads@civicconnect.demo` (also `officer.<dept_code>@…`, e.g. `officer.water@…`), and seeded citizens such as `aarav.sharma@example.demo`. **Seed data is synthetic and labelled as such.**

> **Use a throwaway database for tests and experiments.** The API tests create users/complaints in whatever database `.env` points at. Never point them at production.

---

## Environment variables

**`backend/.env`** (see `.env.example`; never commit `.env`)

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | Port (Render injects `PORT`); `production` enables prod behaviour |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL connection |
| `DB_SSL_MODE` | `REQUIRED` for managed MySQL (Aiven); unset locally |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth signing (use a long random secret) |
| `OPENAI_API_KEY` | Server-side only. Without it AI features degrade to fallbacks |
| `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBEDDING_MODEL` | Model names |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Image storage (server-side only) |
| `NOMINATIM_BASE_URL` | Optional geocoding |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `FRONTEND_URL` | Public URL of the deployed frontend; used to build the links in password-reset / verification emails |
| `DB_SSL_CA` | Optional. Database provider's CA certificate (PEM text or file path) - enables certificate **verification** |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional Web Push keys. Generate once with `npx web-push generate-vapid-keys`; push is disabled if unset |
| `AUTO_MIGRATE` | **Default `true`**: pending migrations are applied at server start (tracked in `_migrations`). Set `false` to migrate manually |
| `ENABLE_BACKGROUND_JOBS` | Default `true`; `false` disables the scheduler (e.g. multiple instances) |
| `SMTP_HOST/PORT/USER/PASS/FROM`, `EMAIL_NOTIFY_TYPES` | Optional email channel; empty `SMTP_HOST` disables it |

**`frontend/.env`**: `VITE_API_BASE_URL` only — no secrets ever belong in frontend variables.

---

## Database & migrations

Three ordered, tracked migrations in `backend/database/migrations/`:

| Migration | Contents |
|---|---|
| `001_init.sql` | users, departments, wards, complaints, images, status history, embeddings, incidents, feedback, notifications |
| `002_intelligence.sql` | AI enrichment columns, incident events, SLA escalations, reopenings, situation reports, admin-query log |
| `003_civic_platform.sql` | **Additive only** — see below |
| `004_auth_push.sql` | Additive: `users.{email_verified_at, failed_login_attempts, locked_until}`, tables `auth_tokens` (hashed one-time tokens) and `push_subscriptions` |

**003 adds** tables `audit_logs`, `complaint_events`, `complaint_decisions`, `complaint_duplicates`, `human_reviews`, `sla_policies` (seeded with the four defaults), `escalation_events`, `ai_usage`, `ai_evaluations`, `job_runs`; columns `complaint_images.{phash, blur_score, brightness, width, height}` and `complaints.{sla_hours, review_status, ai_attempts}`; and composite indexes `(status, created_at)`, `(category, created_at)`, `(department_id, status)`, `(sla_status)`, `(review_required, review_status)`, plus an index on `phash`. **No existing data is modified or dropped.**

Migration safety notes: the runner applies files in order and records each in `_migrations`. MySQL DDL is not transactional, so if a migration is interrupted part-way, fix the cause and inspect before re-running. Validated: from an empty database (all three), and on top of a database holding seeded data.

---

## API reference

All routes are under `/api`, JSON, `Authorization: Bearer <jwt>`. Full request/response shapes for the original endpoints are in [`docs/api.md`](docs/api.md). New/changed endpoints:

**Complaint intelligence** (`/api/complaints/:id/…`)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/timeline` | owner (public-only view) / staff (full) | unified timeline |
| GET | `/sla` | owner / staff | SLA snapshot |
| GET | `/duplicates` | owner / staff | persisted duplicate suggestions with probability & indicators |
| GET | `/evidence` | staff | evidence score + signal breakdown |
| GET | `/decision-trace` | staff | AI signals, factors, evidence, review reasons, review history |
| POST | `/review` | admin, officer (own dept) | approve / correct / false-positive / confirm or reject duplicate |
| GET | `/reviews` | staff | review history |

**Analytics** (`/api/analytics/…`, admin) — `overview` · `trends?days&category&department_id` · `heatmap` · `hotspots` (alias `clusters`) with `category, priority, department_id, status, days, date_from, date_to, radius, min_complaints` · `anomalies[?refresh=true]` · `forecast?horizon` · `department-workload[?department_id]`

**Operations (admin)** — `GET /sla` · `PUT /sla/policies` · `GET /escalations` · `PATCH /escalations/:id/acknowledge` · `POST /escalations/run` · `GET /admin/audit-logs` · `GET /admin/ai-usage` · `GET /admin/ai-performance` · `POST /admin/evaluations/run` · `GET /admin/evaluations/:runId` · `GET /admin/observability` · `POST /admin/jobs/:name/run` · `GET /admin/search/semantic?q=` · `GET /admin/map-data?…&days=`

**Account security & push** - `GET /auth/config` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `POST /auth/verify-email` · `POST /auth/resend-verification` (auth) · `GET /notifications/push` · `POST /notifications/push/subscribe` · `POST /notifications/push/unsubscribe`

**Analytics (admin)** - `GET /analytics/recurring?days&radius` · `GET /analytics/effectiveness?window`

**Extended existing** — `GET /incidents/:id` now includes `intelligence`; `GET /admin/complaints` accepts `sla_status, incident_id, officer_id, citizen, complaint_id, date_from, date_to`; `PATCH /complaints/:id` now validates `category` against the enum; every response carries `X-Request-Id`.

Rate limits: 300 req / 15 min general; 20 / 15 min on login/register; **20 / min on AI-triggering endpoints** (`ai-assist`, `duplicate-check`, AI/semantic search, situation report, evaluations).

---

## Testing

```bash
cd backend && npm test          # Jest + Supertest, --runInBand
cd frontend && npx tsc --noEmit && npm run build
```

**178 backend tests, all passing** (61 pre-existing + 117 new), plus **14 frontend unit tests** and **37 browser tests**, including:

- *Unit:* evidence scoring, decision engine (safety floors, factor reconciliation, review gates, capped AI boosts), AI safety & parser hardening, robust-z anomaly scoring (surge / normal / sparse / robust-to-past-spike / insufficient data), Holt forecasting (unavailable cases, intervals, non-negative, backtest), DBSCAN, text similarity (incl. Devanagari), incident trend/extent, audit sanitisation, SLA snapshots, image sniffing, notification-channel failure isolation.
- *Integration (real DB, AI mocked):* decision-trace persistence, citizen vs staff timeline visibility, review flows (correct → re-route + SLA + audit, approve, false-positive, department scoping, invalid input), corrected complaints not overwritten, duplicate suggestion → incident link → reject → confirm, **AI outage fallback + retry-job recovery**, prompt-injection review flag, SLA policy edit + audit, **escalation idempotency**, analytics authorisation and honest "insufficient data", filter injection rejection, evaluation storage, observability free of secrets, forged-image upload rejection.

- *Production-parity:* `ansiQuotes.test.js` forces `sql_mode=ANSI_QUOTES` (as on Aiven) on every database connection and calls the admin/analytics endpoints - it exists because a double-quoted SQL literal once passed locally and failed in production.
- *Security:* lockout, single-use / expiring / hashed reset and verification tokens, identical responses for known and unknown emails, push channel pruning, TLS options, safe error defaults, recurring/effectiveness analytics with constructed data, job advisory locks.

**Frontend unit tests** (`cd frontend && npm test`, Vitest): completeness logic, geo helpers, and translation completeness (every English string exists in Hindi and Marathi; all enums translated; placeholders preserved).

**Browser tests** (`cd frontend && npm run e2e`, Playwright - first time only: `npm run e2e:install`): run against a live frontend + API with a seeded database. They cover login/logout and errors, password toggle, forgot/reset pages, registration validation, language switching, **every admin page loading with no error panel and no console errors**, the SLA tabs, sidebar collapse, complaint detail panels, real **PDF and CSV downloads**, officer queue and field view, the full citizen report flow (quality hint, location, submit), citizen/officer access guards, and mobile checks (drawer, reaching the last menu link, no horizontal overflow). Point them at a deployment with `E2E_BASE_URL=https://your-app.vercel.app npm run e2e` (demo accounts via `E2E_ADMIN` / `E2E_OFFICER` / `E2E_CITIZEN`). To run locally: start the backend with a migrated + seeded database (use `NODE_ENV=test` so the rate limiters do not throttle the suite) and `npm run dev` in `frontend`.

Tests need a MySQL database and the seeded demo users. **Run them against a local/throwaway database**, e.g. `DB_HOST=127.0.0.1 DB_NAME=bmc_test npm test` after `npm run migrate && npm run seed`.

---

## Security

Bcrypt password hashing · JWT with per-request user re-fetch (roles never trusted from the token) · server-side RBAC on every route · Helmet · strict CORS · layered rate limits · Zod validation everywhere · parameterised SQL only (analytics filters are validated/allow-listed; **AI never writes SQL**) · upload hardening (declared MIME **and** real file signature, size/count limits, decompression-bomb guard, in-memory only → Cloudinary) · prompt-injection defences (§6.1) · errors never leak stack traces in production and include a `requestId` for support · logs and audit records redact credential-like keys and never include request bodies · secrets only in environment variables (`.env` is git-ignored; `.env.example` has no real values).

**Rules:** never commit `.env`; never put keys in frontend code (only `VITE_API_BASE_URL`); rotate any credential that is ever pasted into a chat/issue/commit; use a throwaway DB for tests.

Database TLS: with `DB_SSL_MODE` set the connection is encrypted; set `DB_SSL_CA` to the provider's CA certificate to also **verify** the server certificate. Login lockout (5 attempts / 15 min), hashed single-use reset tokens, and JSON rate-limit responses are described above. **Set `NODE_ENV=production` on the server**: stack traces are only ever returned when `NODE_ENV` is explicitly `development` or `test`.

---

## Render deployment

The backend is a standard stateless Express API — no local disk writes (images go to
Cloudinary), the database is already hosted externally on Aiven, so it deploys to Render's
free Node **Web Service** tier with no special infrastructure. This repo is a monorepo
(`backend/` + `frontend/`); Render deploys the backend only — the frontend deploys
separately (e.g. to Vercel/Netlify) and just points its `VITE_API_BASE_URL` at the Render URL.

### 1. Prerequisites

- This repository pushed to GitHub, with your latest changes on `main`
- A Render account ([render.com](https://render.com)) — free tier is enough
- Your Aiven MySQL connection details (already in use locally: `DB_HOST`, `DB_PORT`,
  `DB_USER`, `DB_PASSWORD`, `DB_NAME`) and `DB_SSL_MODE=REQUIRED`
- Your `OPENAI_API_KEY` and Cloudinary credentials
- A long random `JWT_SECRET` (reuse your local one, or generate a new one — see
  [Security](#security) for why this must never appear in the repo or this README)

### 2. GitHub repository requirements

Nothing special beyond what's already true: `backend/package.json` has a working
`npm start` script (`node src/server.js`), `.env` is git-ignored, and `.env.example` lists
every variable with no real values. Render builds straight from the branch you point it at
— no CI config required.

### 3. Render account setup

Sign in at [dashboard.render.com](https://dashboard.render.com) (GitHub OAuth is the
easiest option, since you'll be connecting a GitHub repo next).

### 4. Create the Web Service

**Option A — by hand (no file needed):** Dashboard → **New** → **Web Service** → connect
this GitHub repository → configure the fields below → **Create Web Service**.

**Option B — via the committed `render.yaml`:** Dashboard → **New** → **Blueprint** → select
this repository. Render reads `render.yaml` at the repo root and pre-fills everything except
the variables marked `sync: false` (all the secrets) — it'll prompt you for each of those
once during setup. Either option produces the same service; the Blueprint just saves you
from typing the field values below by hand.

### 5. Repository selection

Pick this repo from the list Render shows after connecting your GitHub account. If it
doesn't appear, use "Configure account" in that picker to grant Render access to it.

### 6. Root directory

**`backend`** — this is a monorepo with `backend/` and `frontend/` as siblings at the repo
root; Render needs to `cd` into `backend` before running install/build/start, exactly what
the **Root Directory** field is for. (In `render.yaml` this is the `rootDir: backend` key.)

### 7. Build command

```
npm install
```

### 8. Start command

```
npm start
```

This runs `node src/server.js` (see `backend/package.json`) — the app's real entry point;
nothing was assumed here, it's the same script used for local development's non-watch mode.

### 9. Environment variables

Add each of these in the Web Service's **Environment** tab (Dashboard → your service →
Environment). **Do not add `PORT`** — Render injects it automatically and the app already
reads `process.env.PORT` with a local fallback (see `src/config/env.js`).

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | your Aiven host, e.g. `mysql-xxxxx.aivencloud.com` |
| `DB_PORT` | your Aiven port, e.g. `28040` |
| `DB_USER` | your Aiven user, e.g. `avnadmin` |
| `DB_PASSWORD` | your Aiven password |
| `DB_NAME` | your Aiven database name, e.g. `defaultdb` |
| `DB_SSL_MODE` | `REQUIRED` |
| `JWT_SECRET` | a long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `OPENAI_API_KEY` | your OpenAI key |
| `OPENAI_TEXT_MODEL` | `gpt-4o-mini` (or your preferred model) |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `CLOUDINARY_CLOUD_NAME` | your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | your Cloudinary API secret |
| `AUTO_MIGRATE` | `true` — applies pending additive migrations on boot (required for the schema to match this release) |
| `NOMINATIM_BASE_URL` | `https://nominatim.openstreetmap.org` |
| `CORS_ORIGIN` | your deployed frontend's URL, e.g. `https://your-app.vercel.app` (comma-separate multiple, e.g. add a preview-deployment domain) |

### 10. Aiven MySQL configuration

No changes needed on the Aiven side — the same credentials you use locally work from
Render, since Aiven MySQL is reachable over the public internet (not restricted to your
local IP) as long as your Aiven service doesn't have an IP allowlist configured. If it
does, add `0.0.0.0/0` (or Render's published outbound IP ranges, if your Aiven plan
supports stricter allowlisting) to Aiven's allowed-IPs list.

### 11. SSL configuration

Already handled in code (`src/config/db.js`, `database/migrate.js`) — when `DB_SSL_MODE`
is set to any truthy value, the MySQL connection is created with `ssl: {
rejectUnauthorized: false }`. This encrypts the connection (satisfying Aiven's requirement)
without pinning Aiven's CA certificate; see the note in
[Production considerations](#production-considerations) about hardening this further.
**Do not unset `DB_SSL_MODE` on Render** — Aiven will refuse a non-TLS connection outright.

### 12. Deploying

Click **Create Web Service** (or, for a Blueprint, finish the prompted secret entry then
**Apply**). Render clones the repo, runs the build command in `backend/`, then the start
command. Watch the **Logs** tab — a successful boot looks like the same two lines you see
locally:

```
{"level":"info","message":"Database connection established.", ...}
{"level":"info","message":"Server listening on port 10000 (production)", ...}
```

(The port number will be whatever Render assigned via `PORT` — that's expected and correct.)

### 13. Finding the Render URL

Render shows it at the top of the service's dashboard page, in the form
`https://bmc-triage-backend-xxxx.onrender.com` (or whatever you named the service — see
`name: bmc-triage-backend` in `render.yaml` if you used the Blueprint).

### 14. Testing `/health`

```bash
curl https://<your-render-service>.onrender.com/health
# {"status":"ok","service":"BMC Complaint Triage API"}
```

This endpoint deliberately does not touch the database or OpenAI, so a 200 here confirms
the process is up even if you haven't verified the database yet. To confirm the database
too, hit `/api/health` or try logging in against a seeded account (see
[Demo accounts](#setup)).

### 15. Connecting the frontend

Set the deployed frontend's `VITE_API_BASE_URL` to
`https://<your-render-service>.onrender.com/api` (note the `/api` suffix — the frontend
always calls through that prefix, see `frontend/src/services/api.ts`), and set the
backend's `CORS_ORIGIN` (step 9) to that frontend's exact origin. Local development is
unaffected either way — `localhost:5173` is always allowed by the backend outside of
`NODE_ENV=production`, and the frontend's local `.env` keeps pointing at
`http://localhost:5000/api`.

### 16. Viewing Render logs

Dashboard → your service → **Logs** tab (live tail), or **Events** tab for
deploy/restart history. The app logs structured JSON lines (see `utils/logger.js`) with
known secret-shaped keys redacted — but see [Security](#security) below regardless.

### 17. Troubleshooting common deployment failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails immediately | Wrong Root Directory | Must be `backend`, not the repo root |
| `Error: Missing required environment variable: JWT_SECRET` (or `DB_HOST`/`DB_USER`/`DB_NAME`) at boot | A required env var wasn't set | Add it in the Environment tab (step 9) |
| `Failed to connect to database` in logs | Wrong Aiven credentials, or Aiven's IP allowlist is blocking Render | Double-check `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`; check Aiven's allowlist (step 10) |
| Database connects locally but not on Render, with a TLS/handshake error | `DB_SSL_MODE` not set on Render | Add `DB_SSL_MODE=REQUIRED` |
| Frontend gets a CORS error in the browser console | `CORS_ORIGIN` doesn't match the frontend's exact deployed origin | Set it to the exact `https://...` origin (no trailing slash); comma-separate if you have more than one |
| `403 Forbidden` with `"This origin is not permitted to access the API."` | Same as above | Same fix |
| Random 500s under any real traffic, or a rate-limit-related crash in logs | `trust proxy` misconfigured | Already handled (`app.set('trust proxy', 1)` in `src/app.js`) - if you forked/modified this, don't remove it |
| Service boots then immediately restarts in a loop | An uncaught startup error, or the port isn't bound correctly | Check Logs for the actual error; confirm you didn't override the start command |
| First request after idle is very slow | Render's free tier spins down an inactive service and cold-starts it | Expected on the free plan; upgrade to a paid plan for always-on, or accept the cold-start delay for a demo |

### 18. Redeployment after pushing to GitHub

Render auto-deploys on every push to the connected branch (`main`) by default — no action
needed. To trigger a redeploy without a new commit (e.g. after only changing an environment
variable), use **Manual Deploy → Deploy latest commit** on the service dashboard.

## Vercel deployment (frontend)

The frontend is a static Vite build (no server-side rendering, no API routes of its own) —
Vercel's default static/Vite preset handles it with almost no configuration. Two things
were fixed specifically for this: a `vercel.json` SPA rewrite (without it, refreshing or
directly linking to any non-root route like `/admin/complaints` 404s, since Vercel serves
static files and doesn't know React Router owns that path), and a broken favicon reference
(`index.html` pointed at a `/vite.svg` that didn't actually exist in `public/`).

### 1. Prerequisites

- This repository pushed to GitHub (same repo as the backend - it's a monorepo)
- A Vercel account ([vercel.com](https://vercel.com)) — free tier is enough
- Your backend already deployed (e.g. to Render — see [Render deployment](#render-deployment))
  and its `/health` endpoint returning 200, so you have a real API URL to point at

### 2. Import the project

Vercel Dashboard → **Add New** → **Project** → import this GitHub repository.

### 3. Root Directory

Set **Root Directory** to **`frontend`** (this is a monorepo — `backend/` and `frontend/`
are siblings at the repo root). Vercel auto-detects the Vite framework preset once you set
this and pre-fills the build settings below; you shouldn't need to override them, but for
reference:

- **Framework Preset**: Vite
- **Build Command**: `npm run build` (runs `vite build`)
- **Output Directory**: `dist`
- **Install Command**: `npm install` (default)

### 4. Environment variables

Add exactly one, in the project's **Settings → Environment Variables**:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-render-service>.onrender.com/api` (your deployed backend's URL, with the `/api` suffix) |

**Important Vite gotcha**: `VITE_*` variables are baked into the JS bundle at **build
time**, not read at runtime. If you change `VITE_API_BASE_URL` later, you must trigger a
new deployment (Vercel does this automatically if you edit it in the dashboard and hit
redeploy) — restarting won't pick it up, because there's no running server, just static
files.

### 5. Deploy

Click **Deploy**. Vercel builds `frontend/` and serves `dist/` from its CDN. First deploy
typically finishes in under a minute for this project.

### 6. Finding the Vercel URL

Shown on the project's dashboard after deploy, in the form
`https://<project-name>.vercel.app` (Vercel also gives you a unique preview URL per branch/PR
if you want one for testing before promoting to production).

### 7. Connect it back to the backend

Once you have the real Vercel URL, go back to Render (or wherever the backend runs) and set
`CORS_ORIGIN` to that exact origin — see [Render deployment](#render-deployment) step 9 and
step 15. Without this, the deployed frontend's API calls will fail with a CORS error in the
browser console even though the backend itself is healthy (that failure mode is in the
Render section's troubleshooting table too).

### 8. Verifying it works

Open the Vercel URL, register or log in with a seeded account (see
[Demo accounts](#setup)), and confirm a page load actually reaches the backend (e.g. the
citizen dashboard's stat cards populate, or login succeeds at all — login itself is the
simplest end-to-end proof both the URL and CORS are wired correctly). Also try navigating
directly to a nested route or refreshing on one (e.g. `/admin/complaints` if you're an
admin) to confirm the `vercel.json` rewrite is working — a 404 there means Root Directory
wasn't set to `frontend`, or `vercel.json` didn't ship (it must live at `frontend/vercel.json`,
which is where it already is in this repo).

### 9. Redeployment

Vercel auto-deploys on every push to the connected branch, same as Render. Changing an
environment variable requires a manual redeploy (Vercel's dashboard prompts for this) since
it's baked in at build time, not read live.



---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Server exits at start with *AUTO_MIGRATE failed* | The DB user lacks `CREATE/ALTER` privileges, or a migration was interrupted. Read the logged error; fix; if a migration half-applied, inspect the schema before re-running. Set `AUTO_MIGRATE=false` to run `npm run migrate` manually |
| Photo upload returns *not a valid JPEG, PNG or WEBP image* | The file's real signature doesn't match its declared type (renamed/corrupt file). Re-export the image |
| Complaints land in **Needs review** with "AI analysis unavailable" | `OPENAI_API_KEY` missing/invalid or OpenAI outage. Complaint is preserved with fallback routing; the `ai_retry` job re-analyses automatically (max 4 attempts); or use *Re-analyze* |
| Anomalies / forecasts show **Insufficient data** | Working as designed: needs ≥ 7 days of history for anomalies, ≥ 14 days (and ≥ 5 active days) for forecasts. `npm run seed:complaints` creates backdated demo history |
| SLA compliance shows "no data" | No complaint has yet been resolved/breached; it never shows a fake 100 % |
| Admin pages 403 after login as officer | By design — analytics, SLA, audit, AI pages are admin-only |
| Heatmap doesn't show | Toggle *Heatmap* in the map toolbar; check the date range/filters return complaints |
| Metrics reset / look empty after a deploy | Request/error metrics are in-process and reset on restart; durable data is in `ai_usage`, `job_runs`, `audit_logs` |
| Background jobs not running | `ENABLE_BACKGROUND_JOBS=false` or `NODE_ENV=test`. On Render free tier the instance sleeps when idle, so jobs only run while it is awake (SLA checks also run when an admin opens SLA views) |
| CORS error from the frontend | `CORS_ORIGIN` on the backend must include the exact frontend origin (no trailing slash) |
| First request very slow on Render | Free-tier cold start (30–60 s) |
| Tests create data in the wrong database | Tests use whatever `.env` points to — point them at a throwaway DB |

---

## Limitations & honesty notes

- **Seed/demo data, wards and SLA values are synthetic** application rules, not official BMC data or policy.
- **Browser coverage:** the UI is exercised by automated Chromium tests (desktop and a phone viewport) and was visually inspected via screenshots, but not in Safari or Firefox, and not on a physical device. Still worth a manual click-through of the map layers and new admin pages before a live demo.
- **Frontend scope.** Delivered: the command center, GIS command center, hotspot/anomaly/forecast/workload views, SLA & escalation center, AI performance/cost/health, audit log, review queue, complaint intelligence panels & timeline, incident intelligence, and richer complaint search. **Not built:** a redesigned citizen home page, a field-worker mobile view, TanStack Table (existing tables are simple and server-paginated), a command-palette global search, dedicated resource-intelligence / recurring-problem / resolution-effectiveness / infrastructure-health pages (their inputs exist — demand forecast table, `REPEATED_COMPLAINTS` escalations, hotspots — but there is no dedicated UI or backend model for intervention tracking), and an extended public dashboard. Real-time uses polling (30–120 s), not WebSockets.
- **PDF export uses built-in Latin fonts**: Devanagari complaint text appears as a placeholder in PDFs (the English AI summary is included). Embedding a Devanagari font would fix this at the cost of a larger download.
- **Metrics are per-instance and in-memory** (reset on restart); durable history is in MySQL.
- **Costs are estimates** from a static list-price table and reported token counts — not billing data.
- **Forecasting is statistical extrapolation** (Holt linear) without seasonality; with only weeks of data it is a coarse aid. The backtest is shown so you can judge it.
- **Anomaly "location" is a ~1.1 km grid cell**, not an administrative boundary; ward mapping is not implemented (wards are demo data).
- **Photo analysis:** dHash/sharpness are simple, honest measurements; they can miss heavily edited copies. Anything about *what a photo shows* comes from the vision model and is advisory.
- **Text-only duplicate fallback** is weaker than the embedding path; it is deliberately stricter (must be within 150 m).
- **Background jobs are in-process.** With multiple backend instances each would run them; set `ENABLE_BACKGROUND_JOBS=false` on all but one, or move to a real queue.
- **Migrations on boot** are convenient for a single-instance deployment; for multi-instance production run `npm run migrate` as a release step and set `AUTO_MIGRATE=false`.
- **Password reset needs email.** Without SMTP configured there is no self-service reset (the UI says so). There is no admin-issued reset link yet.
- **PDF and Devanagari:** embedding a Devanagari font is not enough - the PDF library cannot shape Indic conjuncts and vowel signs, so the text would render incorrectly. Complaint text in those scripts therefore appears as a placeholder in PDFs, with the English AI summary beside it. CSV exports keep the original text.
- **Translations** cover the citizen-facing screens; staff/admin screens and the landing page are English. Hindi and Marathi strings were written for this project and should be reviewed by a native speaker before wide release.
- **Web Push** depends on browser support and on you generating VAPID keys; it was unit-tested with the push service mocked, not against a real push service.
- **Resolution impact** is an observed before/after count comparison, not causal analysis.
- **Cloudinary** uploads require your credentials and were not end-to-end verified against a live account in this session.
- Before/after resolution verification and the officer copilot remain advisory; staff can always override. Moderation and evidence concerns are soft review flags, never automatic rejection.
- `seed:complaints` uses templated text and bypasses the AI pipeline (so seeded complaints have no decision trace until re-analysed).

## Future improvements

- Dedicated UI for resource intelligence, recurring-problem tracking with interventions, and before/after resolution effectiveness (observed comparison, no causal claims)
- Field-operations mobile view with nearby-issue map and one-tap status updates
- Command-palette global search; TanStack Table for column visibility / bulk actions
- Real GPS→ward polygon lookup; seasonality-aware forecasting once months of data exist
- A real job queue and push/SSE notifications; SMS/push notification channels (the channel interface is ready)
- Pin the DB provider CA certificate; per-department admin role if org structure requires it
- Feed staff corrections into a *reviewed, versioned* evaluation set (never auto-retraining)

## Demo walkthrough

See [`docs/demo-flow.md`](docs/demo-flow.md) for the original script. Suggested tour of the new platform: submit a complaint as a citizen (watch the timeline/SLA) → as admin open the **Command Center** → **GIS map** (toggle heatmap/hotspots) → open the complaint to see **AI assessment, evidence and decision factors** → correct the category in **Staff review** and check the **Audit log** → **Anomalies & forecast** (shows "insufficient data" on a fresh DB) → **SLA & escalations** → **AI & system** (run the offline evaluation suite).
