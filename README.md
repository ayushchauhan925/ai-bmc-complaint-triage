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
- [Image storage (Cloudinary)](#image-storage-cloudinary)
- [Database](#database)
- [Running the app](#running-the-app)
- [API overview](#api-overview)
- [Testing](#testing)
- [Security](#security)
- [Production considerations](#production-considerations)
- [Render deployment](#render-deployment)
- [Vercel deployment (frontend)](#vercel-deployment-frontend)
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

Prerequisites: Node.js 18+, MySQL 8+, an OpenAI API key. Tested against both a local
MySQL 9.4 install and a managed cloud MySQL instance (Aiven) over TLS (`DB_SSL_MODE=REQUIRED`).

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
| `DB_SSL_MODE` | set to `REQUIRED` for a managed/cloud MySQL host (Aiven, PlanetScale, etc.) that mandates TLS; leave unset for local MySQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | auth token signing |
| `OPENAI_API_KEY` | **server-side only, never sent to the frontend** |
| `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBEDDING_MODEL` | model names, overridable without code changes |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | image storage - **server-side only**, see [Image storage](#image-storage-cloudinary) |
| `NOMINATIM_BASE_URL` | optional reverse-geocoding endpoint |
| `CORS_ORIGIN` | allowed frontend origin |

**frontend/.env**

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | backend API base URL (e.g. `http://localhost:5000/api`) |

## Image storage (Cloudinary)

Uploaded photos (complaint evidence, officer before/after, citizen reopen evidence) are
stored on [Cloudinary](https://cloudinary.com), not local disk — this is what makes the
backend deployable to a serverless/read-only-filesystem host like Vercel, and it also means
photo URLs are already publicly reachable HTTPS URLs, so the OpenAI vision calls pass them
straight through with no base64 round-trip.

**Getting credentials** (free tier is plenty for this): sign up at
[cloudinary.com/users/register/free](https://cloudinary.com/users/register/free), then on
your [Console dashboard](https://console.cloudinary.com/) copy the **Cloud Name**, **API
Key** and **API Secret** shown at the top into `backend/.env`:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret
```

Uploads land in Cloudinary under `civic-connect/original`, `civic-connect/resolution` and
`civic-connect/reopen` folders (see `services/upload/cloudinary.service.js`). No code
changes needed beyond setting those three variables — multer already uses in-memory
storage (`middleware/upload.middleware.js`) and streams the buffer straight to Cloudinary.

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
secrets in logs (`utils/logger.js` redacts known-sensitive keys) or in this README.
Uploaded files never touch local disk — they're validated in memory and streamed straight
to Cloudinary — and `CLOUDINARY_API_SECRET`/`OPENAI_API_KEY`/`JWT_SECRET`/DB credentials are
all backend-only, never sent to or readable by the frontend. **The AI never generates or
executes SQL** — admin search output is validated field-by-field against an explicit
allowlist before any query is built; see
[`docs/architecture.md`](docs/architecture.md#ai-admin-search--security-boundary).

**Secrets handling rules — read before deploying:**
- **`.env` must never be committed.** It's git-ignored (`.gitignore`: `.env`, `.env.*`,
  `!.env.example`) — only `.env.example` (no real values) is tracked.
- **API keys must never be placed in frontend code.** The frontend only ever reads
  `VITE_API_BASE_URL`; `OPENAI_API_KEY`, `CLOUDINARY_API_SECRET`, `JWT_SECRET` and the
  Aiven DB credentials exist only in the backend's environment.
- **Production secrets go into Render's Environment Variables tab**, not into any file in
  this repo — see [Render deployment](#render-deployment) step 9.
- **Credentials must never appear in this README, any other doc, or a commit message.**
  If you ever paste a real key while asking for help (in an issue, a chat, a commit), treat
  it as compromised and rotate it immediately.
- Before every commit, double-check `git status`/`git diff` for anything that looks like a
  credential, even in a file that "shouldn't" have one.

## Production considerations

When `DB_SSL_MODE` is set, the MySQL connection uses `ssl: { rejectUnauthorized: false }` —
encrypted in transit, but not verified against the provider's CA certificate. That's enough
to satisfy a managed host like Aiven that mandates TLS, but for production hardening pin
the provider's CA bundle instead (`ca: fs.readFileSync('path/to/ca.pem')`) rather than
trusting any certificate.

This build runs the AI pipeline synchronously on the request and has no real job scheduler
(SLA escalation runs lazily on Intelligence Center load / an explicit endpoint) — both
documented tradeoffs appropriate for a demo, with upgrade paths noted in
[Future improvements](#future-improvements). See also `docs/architecture.md`'s
[Performance & observability](docs/architecture.md#performance--observability) section.

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

## Limitations & honesty notes

- **Ward data is synthetic demo data**, explicitly labeled `(DEMO)` — not official BMC ward
  boundary data. GPS-to-ward mapping isn't implemented; wards are assigned manually/via seed.
- **SLA hours and escalation thresholds are application-level demo rules**, not a claim
  about actual BMC SLA policy.
- **There is no real background job scheduler.** SLA escalation runs lazily (Intelligence
  Center load, or `POST /admin/sla/check`) rather than on a cron/queue — documented, not
  hidden. Same for the AI pipeline itself, which runs inline on complaint submission rather
  than async (see Future improvements).
- **Image storage uses Cloudinary** (see [Image storage](#image-storage-cloudinary)) rather
  than local disk, which is what makes the backend deployable to a serverless/read-only-
  filesystem host. The code path was written and the server starts cleanly with it, but it
  was **not end-to-end tested against a live Cloudinary account** in this session — that
  requires your own API credentials, which I don't have. Please add your keys to
  `backend/.env` and submit one test complaint with a photo to confirm before deploying.
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
- A real job queue (e.g. BullMQ) for the AI pipeline and SLA escalation sweep, instead of inline/lazy execution
- WebSocket/SSE push for notifications instead of polling
- SMS notifications (explicitly out of scope for this build)
- Officer availability/home-base data to make smart assignment's proximity ranking more precise
- Historical dataset import pipeline (`data/raw` → `data/processed`, scaffolded but not built)

## Demo walkthrough

Full 5-10 minute script: [`docs/demo-flow.md`](docs/demo-flow.md).
