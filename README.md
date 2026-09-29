# Civic Connect — AI BMC Complaint Triage

An AI-assisted civic complaint management platform: citizens report issues (potholes,
garbage, water leakage, streetlights, etc.) in English, Hindi, Hinglish or Marathi with a
photo and location; OpenAI classifies, summarizes and assesses evidence quality, then
**deterministic backend rules** — never the AI — decide priority, department routing, SLA,
duplicate/incident grouping, and incident escalation. Officers work assigned complaints to
resolution with an AI work-assistant checklist; citizens track status, get duplicate
warnings before submitting, and can reopen resolved complaints; admins get a full
dashboard, live map with hotspot detection, a natural-language search over complaints, an
AI-generated daily situation report, and a public transparency dashboard.

Built for a college hackathon, across two phases: a full working product first, then an
"advanced AI copilot / civic intelligence" upgrade. Demo data, ward boundaries and SLA
policy are **synthetic** and clearly labeled as such — see
[Limitations](#limitations--honesty-notes).

## Table of contents

- [Problem statement](#problem-statement)
- [Solution](#solution)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Features](#features)
- [User roles](#user-roles)
- [Complaint lifecycle](#complaint-lifecycle)
- [AI architecture at a glance](#ai-architecture-at-a-glance)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Running the app](#running-the-app)
- [API overview](#api-overview)
- [Testing](#testing)
- [Security](#security)
- [Production considerations](#production-considerations)
- [Limitations & honesty notes](#limitations--honesty-notes)
- [Future improvements](#future-improvements)
- [Demo walkthrough](#demo-walkthrough)

**Full documentation:** [`docs/architecture.md`](docs/architecture.md) ·
[`docs/ai-pipeline.md`](docs/ai-pipeline.md) · [`docs/api.md`](docs/api.md) ·
[`docs/database-schema.md`](docs/database-schema.md) ·
[`docs/demo-flow.md`](docs/demo-flow.md)

> **Disclaimer:** this is a hackathon/demo system. Configured SLA values, sample ward data,
> sample department names, and demo statistics are **not** official BMC operational data
> and must not be represented as such unless sourced from an official dataset.

## Problem statement

> Build an AI-powered system to classify, prioritize and route civic complaints
> (potholes, drainage, waste, water, streetlights, road damage, etc.) from text and images.

## Solution

A citizen describes a problem in their own language, optionally with a photo. One unified
OpenAI call extracts structured signals (category, severity, evidence quality) — but the
AI never decides the outcome. Deterministic, documented, testable backend engines turn
those signals into a priority score, a department assignment, an SLA deadline, and (via
semantic + geographic duplicate detection) grouping into a citywide incident. Admins get an
Intelligence Center that surfaces hotspots and lets them ask questions in plain English,
safely translated into a constrained, allowlisted database filter — never AI-generated SQL.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown with Mermaid
diagrams (system overview, AI pipeline sequence, the AI-admin-search security boundary).
Short version:

```
Citizen / Officer / Admin UI (React)
              |
     Express REST API (JWT + RBAC)
              |
  Controller → Service → Model (parameterized SQL)
              |
     ┌────────┴─────────┐
     v                   v
  MySQL              OpenAI (structured JSON only,
                      schema-validated before saving)
```

**Controller → Service → Model.** All business logic lives in `backend/src/services` and is
fully deterministic where it matters (priority, routing, SLA, incident escalation, hotspot
detection, admin-search filter sanitization) — AI is only ever asked for *signals*, never
for the operational decision.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, React Router, Tailwind CSS, Recharts, Leaflet / react-leaflet + leaflet.markercluster |
| Backend | Node.js + Express, JWT auth, bcryptjs, multer, Zod, Helmet, CORS, express-rate-limit |
| Database | MySQL (plain parameterized SQL via `mysql2`, no ORM) |
| AI | OpenAI Chat Completions (vision-capable model, JSON-mode) for unified complaint analysis, situation reports, admin search, officer copilot, guided assistant; OpenAI Embeddings for semantic duplicate detection |
| Maps | Leaflet + OpenStreetMap tiles (no Google Maps) |

## Features

### Core (phase 1)
- Multilingual complaint submission (English / Hindi / Hinglish / Marathi) with photo upload and map-based location picker
- One unified, schema-validated AI analysis call per complaint — never blocks submission if AI fails (flags `NEEDS_REVIEW` instead)
- Deterministic, explainable priority engine — the UI always shows *why*
- Deterministic category → department routing, configured in one place
- SLA deadlines per priority level with ON_TRACK/APPROACHING/BREACHED/COMPLETED_(WITHIN|AFTER)_SLA
- Semantic duplicate detection (embeddings + geo + recency) and automatic incident grouping
- Full lifecycle + status timeline; officer accept→start→resolve workflow with advisory AI before/after check; citizen feedback; in-app notifications
- Admin dashboard, filterable complaint table, clustered priority map, analytics, flagged-review queue
- Server-side RBAC (CITIZEN/OFFICER/ADMIN) — the frontend's claimed role is never trusted

### Advanced AI / civic intelligence (phase 2)
- **Guided complaint assistant** — one-shot AI follow-up questions + suggested rewrite while drafting, never a chatbot, never decides the final category
- **AI enrichment** — title, normalized description, missing-information list, stored alongside the existing summary/category/signals
- **Evidence Intelligence** — per-image quality/relevance/authenticity assessment (blurry, likely irrelevant, possible duplicate image, manipulated/suspicious, evidence confidence %) — flags for review, never auto-rejects
- **Pre-submission duplicate warning** — "N similar complaints found nearby" before the citizen even submits, with a separately calibrated similarity threshold (see `docs/ai-pipeline.md` for why that had to be distinct from the post-submission threshold)
- **Civic Intelligence Center** — one admin page combining verified deterministic stats, AI hotspot clusters, department/ward workload, recent incidents, and the latest AI situation report
- **AI hotspot detection** — deterministic geo/time/category clustering (no ML model) surfacing "17 drainage complaints within 450m in the last 12 hours"
- **AI admin natural-language search** — "Show unresolved potholes near schools" → AI proposes a constrained JSON filter → re-validated against an explicit allowlist → parameterized SQL. **The AI never produces or executes SQL.** Every query is audit-logged.
- **AI daily situation report** — generated on demand from *only* verified aggregated statistics (never invented figures), stored with its source snapshot for auditability
- **Officer AI Copilot** — advisory inspection/evidence/resolution checklist per complaint, cached after first generation
- **Smart officer assignment** — ranks officers by current workload, critical-assignment count, and proximity to the complaint; the actual assignment stays an authorized admin action
- **SLA escalation** — one-time notifications (officer on APPROACHING, officer+admin on BREACHED) with a durable escalation history table
- **Citizen reopen flow** — dedicated endpoint with reason + optional evidence photo, `RESOLVED → REOPENED → ASSIGNED`
- **Resolution quality verification upgrade** — SUPPORTED/UNCERTAIN/NOT_SUPPORTED + explicit signals, still fully admin-overridable
- **Incident graph upgrade** — event timeline per incident (created/linked/unlinked/status-changed/merged), and admin-initiated incident **merge**
- **Public transparency dashboard** — no-auth aggregate stats page with zero citizen-identifying data

## User roles

**Citizen** — submit (with guided AI assist + duplicate warning), track via timeline, give feedback, reopen. **Officer** — work their department's queue with an AI-assisted checklist, submit AI-verified resolutions. **Admin** — full visibility: dashboard, map, Intelligence Center, AI search, situation reports, incident management (including merge), review queue, analytics.

## Complaint lifecycle

```
SUBMITTED → AI_ANALYZED → ASSIGNED → IN_PROGRESS → RESOLUTION_SUBMITTED → RESOLVED
                                                                              │
                                                          citizen: not resolved / reopen
                                                                              ▼
                                                          REOPENED → ASSIGNED (back in queue)
```
Plus `NEEDS_REVIEW` (low AI confidence, evidence concerns, or AI failure) and `REJECTED`.

## AI architecture at a glance

Every AI call: strict JSON-only prompt → Zod schema validation → graceful degradation on
failure (never blocks the user). The AI **only** ever produces signals or a constrained
filter object — priority, routing, SLA, incident escalation, hotspot detection, and which
database rows an admin search returns are **all computed by deterministic backend code**.
Full detail, every prompt/schema, and the AI-admin-search security boundary diagram: see
[`docs/ai-pipeline.md`](docs/ai-pipeline.md) and [`docs/architecture.md`](docs/architecture.md).

## Setup

Prerequisites: Node.js 18+, MySQL 8+ (tested against MySQL 9.4), an OpenAI API key.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env   # then fill in DB credentials + OPENAI_API_KEY
npm run migrate        # creates the database + tables (both migrations, idempotent)
npm run seed            # departments, wards, demo users (admin/officers/citizens)
npm run seed:complaints # ~60 realistic demo complaints, incidents, SLA breaches, feedback
npm run dev              # http://localhost:5000

# 2. Frontend (in a second terminal)
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

Demo accounts (password for all: `Password123!`):

| Role | Email |
|---|---|
| Admin | `admin@civicconnect.demo` |
| Officer (Roads) | `officer.roads@civicconnect.demo` |
| Officer (any dept) | `officer.<dept_code>@civicconnect.demo` (e.g. `officer.solid_waste@...`) |
| Citizen | any of the seeded citizens, e.g. `aarav.sharma@example.demo` |

## Environment variables

**backend/.env**

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | server port / environment |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | auth token signing |
| `OPENAI_API_KEY` | **server-side only, never sent to the frontend** |
| `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBEDDING_MODEL` | model names, overridable without code changes |
| `UPLOAD_DIR` | local folder for uploaded images |
| `NOMINATIM_BASE_URL` | optional reverse-geocoding endpoint |
| `CORS_ORIGIN` | allowed frontend origin |

**frontend/.env**

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | backend API base URL (e.g. `http://localhost:5000/api`) |

No new environment variables were introduced in phase 2 — every new AI feature reuses the
same `OPENAI_*` configuration.

## Database

Full schema + ER diagram: [`docs/database-schema.md`](docs/database-schema.md). Two
migrations, both idempotent (`backend/database/migrate.js` tracks what's applied):
`001_init.sql` (core tables) and `002_intelligence.sql` (AI-enrichment columns on
`complaints`, plus `incident_events`, `sla_escalations`, `complaint_reopenings`,
`ai_situation_reports`, `ai_admin_queries`).

- `npm run migrate` — apply schema
- `npm run seed` — departments, demo wards (labeled `(DEMO)`), 1 admin, 1 officer/department, 15 citizens
- `npm run seed:complaints` — ~60 synthetic complaints across every category, several
  incident clusters (2-12 complaints, spanning every duplicate-count priority bracket),
  forced SLA breaches, resolved complaints with feedback — uses the real deterministic
  priority/routing/SLA services, does not call OpenAI repeatedly (see Limitations)

## Running the app

Backend: `npm run dev` (nodemon) or `npm start`. Frontend: `npm run dev` (Vite) or
`npm run build && npm run preview`.

## API overview

Full reference with request/response shapes: [`docs/api.md`](docs/api.md). Highlights of
what's new in phase 2:

```
POST /api/complaints/ai-assist            POST /api/complaints/duplicate-check
POST /api/complaints/:id/reopen            GET  /api/complaints/:id/similar
POST /api/complaints/:id/ai-enrich         POST /api/complaints/:id/evidence-analysis

POST /api/incidents/:id/merge

GET  /api/admin/intelligence               GET  /api/admin/hotspots
POST /api/admin/ai-search                  POST /api/admin/situation-report
GET  /api/admin/situation-reports          GET  /api/admin/complaints/:id/recommend-officer
POST /api/admin/sla/check                  GET  /api/admin/sla/escalations

GET  /api/officer/ai-assistance/:id

GET  /api/public/statistics   (no auth)
```

## Testing

Backend: `npm test` (Jest + Supertest) — **61 tests across 9 suites, all passing** as of
this build. Unit tests cover every deterministic engine (priority, routing, duplicate
detection, hotspot clustering) plus AI response schema validation (malformed/malicious
input handling) and — most importantly — the AI-admin-search allowlist sanitizer
(`tests/unit/adminSearch.service.test.js`, which specifically tests that SQL-injection-
shaped strings and out-of-allowlist fields never reach the database). API tests cover auth,
complaint creation, RBAC on every admin/officer/intelligence endpoint, the full reopen
flow, and incident merge (with the AI service mocked for determinism/no cost).

Frontend: `npx tsc --noEmit` (0 errors) and `npm run build` both pass.

## Security

Password hashing (bcrypt), JWT auth, server-side RBAC on every route, Helmet, CORS,
rate limiting, Zod input validation, MIME-validated file uploads (never trusts the client
extension), centralized error handling (no stack traces in production responses), no
secrets in logs (`utils/logger.js` redacts known-sensitive keys) or in this README. **The
AI never generates or executes SQL** — admin search output is validated field-by-field
against an explicit allowlist before any query is built; see
[`docs/architecture.md`](docs/architecture.md#ai-admin-search--security-boundary).

## Production considerations

This build runs the AI pipeline synchronously on the request and has no real job scheduler
(SLA escalation runs lazily on Intelligence Center load / an explicit endpoint) — both
documented tradeoffs appropriate for a demo, with upgrade paths noted in
[Future improvements](#future-improvements). See also `docs/architecture.md`'s
[Performance & observability](docs/architecture.md#performance--observability) section.

## Limitations & honesty notes

- **Ward data is synthetic demo data**, explicitly labeled `(DEMO)` — not official BMC ward
  boundary data. GPS-to-ward mapping isn't implemented; wards are assigned manually/via seed.
- **SLA hours and escalation thresholds are application-level demo rules**, not a claim
  about actual BMC SLA policy.
- **There is no real background job scheduler.** SLA escalation runs lazily (Intelligence
  Center load, or `POST /admin/sla/check`) rather than on a cron/queue — documented, not
  hidden. Same for the AI pipeline itself, which runs inline on complaint submission rather
  than async (see Future improvements).
- Uploaded images are stored on local disk (`backend/uploads/`), not S3/Cloudinary.
- `seed:complaints` synthesizes severity signals and does not call OpenAI repeatedly (to
  avoid ~60 paid calls on every fresh seed) — it reuses the real deterministic priority/
  routing/SLA code, but its text is templated, not model-generated. Every complaint created
  *through the actual app* calls the real OpenAI pipeline, and that path — including all
  phase-2 features — was exercised repeatedly against the live API during development.
- **The pre-submission duplicate-check threshold had to be separately calibrated** from the
  post-submission one, because stored embeddings include the AI summary while a draft
  doesn't — found and fixed during testing, documented in `docs/ai-pipeline.md`.
- **The UI was never opened in an actual browser during either build phase** — no browser
  automation tool was available in this environment. What *was* verified: extensive live
  HTTP-API and direct-database testing of every feature (see `docs/demo-flow.md`'s
  verification notes for the full list, including two real bugs found and fixed live), a
  clean TypeScript build, and a clean production bundle. Please click through the app
  yourself before a live demo.
- Before/after resolution verification and the officer AI copilot are advisory only; an
  admin/officer can always override.
- Spam/irrelevance moderation and evidence-quality concerns are soft `review_required`
  flags, never automatic deletion or rejection.

## Future improvements

- Real GPS→ward polygon lookup once official ward boundary data is available
- S3/Cloudinary storage + CDN for uploaded images
- A real job queue (e.g. BullMQ) for the AI pipeline and SLA escalation sweep, instead of inline/lazy execution
- WebSocket/SSE push for notifications instead of polling
- SMS notifications (explicitly out of scope for this build)
- Officer availability/home-base data to make smart assignment's proximity ranking more precise
- Historical dataset import pipeline (`data/raw` → `data/processed`, scaffolded but not built)

## Demo walkthrough

Full 5-10 minute script: [`docs/demo-flow.md`](docs/demo-flow.md).
