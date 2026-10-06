# Civic Connect — Features by Role

A complete, role-by-role list of what each kind of user can do in Civic Connect: **Citizen**,
**Officer** and **Admin**, plus the public and automatic (system) features that apply to everyone.

> For the *why* and *how* behind each capability see [`explain.md`](explain.md). For accounts to
> sign in with see [`passwords.md`](passwords.md). API details are in [`api.md`](api.md).
>
> Demo data, wards, SLA targets and department names are synthetic, not official BMC data.

## Contents

1. [Roles at a glance](#1-roles-at-a-glance)
2. [Public (no sign-in)](#2-public-no-sign-in)
3. [Account features (all roles)](#3-account-features-all-roles)
4. [Citizen features](#4-citizen-features)
5. [Officer features](#5-officer-features)
6. [Admin features](#6-admin-features)
7. [Automatic system features](#7-automatic-system-features)
8. [Permission matrix](#8-permission-matrix)

---

## 1. Roles at a glance

| Role | Who | Scope | Lands on | Navigation |
|---|---|---|---|---|
| **Citizen** | Resident reporting civic issues | Own complaints only | `/` (Home) | Home · Report · My complaints · Profile |
| **Officer** | Department staff (one department, optional ward) | Their department's complaints | `/officer` | Assigned · Field view · All complaints · Profile |
| **Admin** | System administrator | Everything | `/admin` | Command · Complaints · GIS map · Incidents · Departments · Officers · Approvals · Review queue · Anomalies & forecast · SLA & escalations · Recurring & impact · Analytics · Intelligence · AI & system · Audit log |

Authorisation is enforced on the **server** for every route; the frontend only hides what a role
can't use. The user record is re-checked on each request, so deactivating an account or changing
a role takes effect immediately.

---

## 2. Public (no sign-in)

| Feature | Route | Details |
|---|---|---|
| **Landing page** | `/` (signed out) | Product overview: report-to-resolution flow, "intelligence you can inspect", command-center summary, calls to action (Get started / Staff sign in). |
| **Public transparency dashboard** | `/public` | Aggregate counts, category breakdown, resolution-time and SLA-compliance figures. Clearly labelled data scope; **no citizen-identifying information**. Sortable table, **Download summary (PDF)**. |
| **Sign in / Register** | `/login`, `/register` | Email + password; registration validates input. |
| **Forgot / reset password** | `/forgot-password`, `/reset-password` | Email link (needs SMTP). The UI says so when email is not enabled. |
| **Verify email** | `/verify-email` | One-time link from the verification email. |
| **Language switch** | app bar / auth pages / mobile drawer | English · Hindi · Marathi. |
| **Health check** | API `/health` | Confirms the API process is up. |

---

## 3. Account features (all roles)

| Feature | Details |
|---|---|
| **Profile page** (`/profile`) | Shows name, email, role badge and a plain "What you can do" list for that role. |
| **Device (push) notifications** | Opt in/out under Profile → Device notifications (Web Push). Only available when the server has VAPID keys. |
| **Email verification banner** | Shown only when the server can send email; never blocks use of the app. |
| **Login lockout** | 5 wrong passwords lock the account for 15 minutes; a password reset clears it. |
| **Password reset by email** | One-time, 1-hour link; only a hash of the token is stored; same response for unknown emails. |
| **Notifications** | In-app notifications for status changes, assignments and escalations. |
| **Crash containment** | If one panel fails, it shows a calm message with **Retry** instead of blanking the page. |
| **Responsive layout** | Mobile drawer, scrollable nav, table → card layout on small screens, keyboard-operable controls. |

---

## 4. Citizen features

### 4.1 Home (`/`)
- Greeting and **summary counts** of the citizen's complaints (active, resolved, etc.).
- **Active complaints** list with status.
- **Recent updates** feed (status changes on their complaints).
- **Tips** for writing a useful report.
- Shortcut to **Report a Civic Problem**.

### 4.2 Report a problem (`/complaints/new`)
| Capability | Details |
|---|---|
| **Multilingual input** | English, Hindi, Hinglish or Marathi; the AI detects the language. |
| **Description** | Free text describing the issue. |
| **Photos** | Up to 5 images. Real file type is verified (not just the extension); oversized/forged files are rejected. |
| **Location** | Click on the map (OpenStreetMap), **Use current location**, and/or type an address or landmark. |
| **Guided AI assistant** | **Get AI suggestions** → likely category, up to 4 follow-up questions, and a clearer rewrite of the draft. One-shot, advisory; never decides the final category. |
| **Completeness hint** | Live, rule-based checklist (detail, impact, pinned location, landmark, photo) with supportive tips. Not AI; never blocks submission. |
| **Duplicate warning** | **Check for similar complaints nearby** shows existing nearby reports of the same problem before submitting. Never blocks submission. |
| **Submit** | Runs the full pipeline (AI understanding → evidence score → duplicates → priority → department → SLA) and opens the complaint page. |
| **Resilient submit** | Even if the AI is unavailable the complaint is saved, routed by rules and retried automatically. |

### 4.3 My complaints (`/my-complaints`)
- List of all the citizen's complaints with status, category, priority and dates.
- Open any complaint for full details.

### 4.4 Complaint page (`/complaints/:id`) — citizen view
| Panel | What the citizen sees |
|---|---|
| **Header** | Complaint number (e.g. `CMP-2026-00044`), status, AI-generated title/summary, category, priority. |
| **Progress tracker & timeline** | Submitted → analysed → assigned → in progress → resolved, as a **public-safe timeline** (internal AI/staff details removed). |
| **SLA countdown** | Target date and time remaining / overdue state. |
| **Photos** | Image gallery of submitted photos (and resolution photo when present). |
| **Related-complaint notice** | Tells the citizen if other people reported the same problem / it is part of an incident. |
| **Department** | Which department is handling it. |
| **Download receipt** | PDF with ID, status, category, location, target date, description and public timeline. |
| **Notifications** | In-app (and optional push/email) when status changes. |

> Citizens do **not** see AI decision internals, evidence scores, decision factors, review notes or
> other people's data.

### 4.5 After resolution
| Feature | Details |
|---|---|
| **Feedback form** | Answer whether the issue was really fixed, give a rating and comment. |
| **Automatic reopen** | Answering **"Not resolved"** reopens the complaint (`RESOLVED → REOPENED → ASSIGNED`) and returns it to the officer queue. |
| **Report issue not actually resolved** | Standalone reopen button with a reason and optional **evidence photo**. Only available from `RESOLVED`. |

### 4.6 Language and accessibility
- Hindi / Marathi interface for all citizen screens, navigation, footer and every status, priority
  and category label (English fallback for anything untranslated).
- Text labels beside colour for status/priority; keyboard-operable controls.

---

## 5. Officer features

An officer belongs to **one department** (and optionally one **ward**) and only works that
department's complaints.

### 5.1 Assigned dashboard (`/officer`)
- Queue of complaints **assigned to this officer** and the department's open work, with counts by
  status.
- Priority accent stripes, SLA state badges and quick filters.

### 5.2 Department complaints (`/officer/all`)
| Capability | Details |
|---|---|
| **Search** | Debounced text search. |
| **Filters** | Status, priority; removable filter chips, **Clear all**. |
| **Sorting** | **Server-side** by priority, SLA deadline, status, category, department, created/updated, complaint number. |
| **Pagination** | 25 / 50 / 100 rows, "Showing 1–25 of N". |
| **Columns** | Show/hide columns and comfortable/compact density, remembered per table. |
| **Export** | CSV of the list (UTF-8 with BOM so Devanagari opens correctly; formula-injection safe); **Export selected** rows. |

### 5.3 Field view (`/officer/field`) — mobile-first
- Open tasks **sorted nearest-first** using the device's geolocation (location is never sent to the
  server).
- Task **map** with markers.
- One-tap **Accept** / **Start work**.
- Turn-by-turn **Navigate** hand-off to the maps app.

### 5.4 Complaint page (`/complaints/:id`) — staff view
Everything the citizen sees, plus:

| Panel | Details |
|---|---|
| **SLA panel** | Start, deadline, target hours, status (on track / approaching / breached / completed), remaining time. |
| **AI assessment** | Category, subcategory, language, summary, urgency, recommended action, confidence, evidence strength, review reasons. |
| **Severity signals** | Which of the severity signals fired (near school/hospital, injury reported, traffic hazard, water accumulation, etc.). |
| **Priority reasons / decision factors** | Every step of the priority decision as a named factor with a source tag (rules / AI / history / evidence / duplicates). |
| **Evidence breakdown** | 0–100 score from nine signals, red-flag penalties, plain-language details. |
| **Image evidence** | Per-photo AI assessment (issue visible, supports claim, blurry, irrelevant, suspicious) and local blur/hash measurements. |
| **Related complaints** | Duplicate/related suggestions with probability and indicators; **link** or **not related** actions. |
| **Incident link** | The incident this complaint belongs to, if any. |
| **Unified timeline** | Status history plus AI, evidence, priority, department, duplicate, incident, review, SLA and escalation events, with icons. |
| **Staff review panel** | Approve / correct / false-positive / confirm or reject duplicate (own department only). |
| **Export PDF** | AI assessment, evidence score, decision factors and internal timeline. |

### 5.5 Working a complaint
| Step | Details |
|---|---|
| **Accept** | Take ownership of an assigned complaint. |
| **Start work** | Moves it to in progress. |
| **Add note** | Progress notes recorded on the timeline. |
| **Upload resolution ("after") photo** | Evidence that the fix was done. |
| **Mark resolution submitted** | Sends it for admin approval. |
| **AI before/after verification** | Compares the original and "after" photos and shows `SUPPORTED / UNCERTAIN / NOT_SUPPORTED` with signals. Advisory only — an admin decides. |

### 5.6 AI Work Assistant (copilot)
**Get AI suggestions** returns an **inspection checklist**, **evidence to collect** and a
**pre-resolution checklist**. Labelled advisory, cached after first generation.

### 5.7 Review of AI decisions
Officers can review complaints in **their own department**: approve the AI decision, correct
category/priority/department (re-routes and recomputes the SLA), mark false positive, confirm or
reject duplicates. Each review stores the AI value beside the human value and is audited.

### 5.8 Notifications
Assignment notifications, SLA warnings and status updates (in-app, optionally push/email).

---

## 6. Admin features

Admins have global scope. The sidebar groups these pages:

### 6.1 Command Center (`/admin`)
- **8 headline metrics**, each linking to its detail view.
- **Review-queue banner** when complaints await human review.
- Demand trend, SLA state, open hotspots, anomalies.
- **Department workload** (pending vs overdue), **AI confidence distribution**, **duplicate rate**.
- **Critical** and **SLA-breached** lists.
- Auto-refreshes every 60 s; **Export PDF**.

### 6.2 Complaints (`/admin/complaints`)
| Capability | Details |
|---|---|
| **Filters** | Text, category, status, priority, **SLA status**, department, officer, **incident**, **citizen** (name/email), complaint id, date range. |
| **Semantic search** | Ranks recent complaints by meaning; falls back to keyword search and says so. |
| **AI natural-language search** | e.g. "Show unresolved potholes near schools" → validated filters only (the AI never writes SQL); the applied filters are shown. |
| **Server-side sort & pagination** | Up to 100 per page. |
| **Export** | CSV (all / selected) and PDF of the current page. |
| **Row actions** | Open complaint, quick actions. |

### 6.3 Complaint page — admin actions
| Action | Details |
|---|---|
| **Recommend officer** | Ranked, explained shortlist of **active officers in the complaint's department**: same ward first, then fewest open assignments, fewest critical, fewest SLA breaches, proximity. Recommendation only. |
| **Assign officer** (**Save assignment**) | Final assignment; server checks the officer is active and belongs to the department. |
| **Change status** | Admin status transitions, including approving a submitted resolution (→ `RESOLVED`) and rejecting. |
| **Change priority / category / department** | Via the review panel; re-routing and SLA recomputation are automatic. |
| **Review** | Approve · Correct · False positive · Confirm/Reject duplicate (any department). |
| **All staff panels** | SLA, AI assessment, evidence, factors, related complaints, timeline, PDF export. |

### 6.4 GIS map (`/admin/map`)
- Clustered complaint **markers** coloured by priority.
- **Heatmap** (severity-weighted; resolved counts half).
- **DBSCAN hotspot** zones per category.
- **Incident zones** and **anomaly areas**.
- Filters: category, severity, status (including *unresolved*), department, date range.
- Side panel with **ranked hotspots** and drill-down; deep link `?focus=lat,lng`.

### 6.5 Incidents (`/admin/incidents`, `/admin/incidents/:id`)
- List with Open / Active / Resolved-closed / All tabs.
- **Incident page:** map location, linked complaints, event timeline.
- **Incident intelligence:** complaint/open counts, categories, worst severity, first/latest report,
  trend (rising/stable/falling/insufficient data), extent (centroid, radius, bounds), worst SLA state,
  breached count, next deadline, escalations.
- **Merge** one incident into another; **Export PDF**.

### 6.6 Resolution approvals (`/admin/approvals`)
- Lists every complaint whose officer has **submitted a resolution** and is waiting for an admin decision (oldest first).
- Each card shows the complaint, who submitted the fix and when (with their note), the **before and after photos**, and the **AI before/after check** (`SUPPORTED` / `UNCERTAIN` / `NOT_SUPPORTED`, advisory only).
- **Approve resolution** sets the status to *Resolved*; the citizen is then asked for feedback.
- **Send back to officer** sets the status back to *In progress* and requires a short reason.
- Confirmation message after each decision; **Open full complaint** for the complete record. The same change is still possible from the complaint page under *Change status*.

### 6.6b Review queue (`/admin/review`)
- Every complaint flagged for human review, with **why** it was flagged.
- Quick **Approve**; inspect-and-decide for corrections, false positives and duplicates.

### 6.7 Departments (`/admin/departments`)
| Capability | Details |
|---|---|
| **Catalog** | 20 departments with code, handled categories, active/total officers, open and critical complaints. |
| **Search & tabs** | Search name/code/description/category; Active / Inactive tabs. |
| **Details dialog** | Primary and "also involved" categories, contacts. |
| **Edit** | Description, contact email and phone. |
| **Deactivate / reactivate** | Deactivating with open complaints requires choosing a **reassignment department**; the move is one transaction and audited. The fallback department can't be deactivated. |
| **Export** | CSV. |

### 6.8 Officers (`/admin/officers`)
| Capability | Details |
|---|---|
| **Table** | Officer, department, ward, active assignments, critical assignments, SLA breaches, status. |
| **Search & filters** | Search, department filter, All / Active / Inactive tabs. |
| **Add officer** | Name, email, temporary password (min 8), phone, department, ward. |
| **Edit officer** | Name, phone, department, ward, active flag. Moving department or deactivating an officer with open work requires **releasing assignments** back to the queue. |
| **Reset password** | **New:** admin sets a new password for any officer (Edit dialog → *Reset password*, the row's ⋯ menu, or the mobile card). Needs confirmation, min 8 characters, clears lockout, audited without the password. Existing passwords can't be viewed (hash only). |
| **Deactivate** | Inactive officers can't sign in and never receive assignments; existing sessions stop working. |
| **Export** | CSV. |

### 6.9 Anomalies & forecast (`/admin/operations`)
- **Anomalies:** volume, per category, per department, geographic cell, severity, resolution-time
  slowdown — each with score, baseline, observed value and plain explanation. "Insufficient data"
  when history is too short.
- **Forecast & expected demand:** Holt linear forecasts with uncertainty band and a visible
  **backtest vs naive baseline** (overall, top categories, departments, unresolved backlog).
- **Department workload** with drill-down (30-day incoming vs resolved).

### 6.10 SLA & escalations (`/admin/sla`)
- **SLA monitor:** sortable at-risk list (approaching / breached).
- **Escalations:** filter, **acknowledge**, **Evaluate now**; events auto-resolve when the complaint
  or incident closes.
- **Targets:** edit SLA hours per priority and per category; every change audited.
- CSV and PDF export.

### 6.11 Recurring & impact (`/admin/recurring`)
- **Recurring problems:** places where a fix was followed by a new report within ~150 m.
- **Resolution impact:** same-kind complaints 30 days before vs after each fix (observed
  comparison, not proof of cause).
- CSV export.

### 6.12 Analytics (`/admin/analytics`)
Charts for complaints by department, priority, ward and status, plus trends and week-over-week
change.

### 6.13 Intelligence (`/admin/intelligence`)
- Summary cards, department/ward stats, emerging hotspots, recent incidents.
- **AI Situation Report** — narrative generated only from verified aggregate numbers, with the
  snapshot stored beside it; generated only when the admin clicks.
- **AI admin search** box with example chips.

### 6.14 AI & system (`/admin/ai`)
| Tab | Details |
|---|---|
| **AI quality** | AI-vs-staff metrics (classification accuracy, priority/routing agreement, correction and approval rates, false positives, duplicate precision, confidence calibration) and the **evaluation suite** (offline or live). |
| **Usage & cost** | Tokens, estimated cost, latency, failure rate, per use case and per model, daily cost. |
| **System health** | DB round-trip, uptime, slowest endpoints (p50/p95), errors, background-job status with **run now**, AI and notification-channel status. |

### 6.15 Audit log (`/admin/audit`)
- Who did what, when, with **before / after** values; credentials redacted.
- Filters, search, server-side sort and pagination, **CSV / PDF** export.

---

## 7. Automatic system features

These run without anyone clicking anything:

| Feature | Behaviour |
|---|---|
| **AI understanding** | One validated structured analysis of text + photos on every submission. |
| **Safety checks** | Output validation, sanitising, **prompt-injection detection** → human-review flag. |
| **Evidence scoring** | 0–100 score from nine signals. |
| **Hybrid priority decision** | Rules + AI signals + duplicates + history + evidence, with safety floors and review gates. |
| **Duplicate detection** | Semantic + text + geo + time + category + photo similarity; persisted, reviewable suggestions. |
| **Incident grouping** | Strong, category-compatible matches join an incident `INC-YYYY-NNNN`; priority re-escalated. |
| **Deterministic routing** | Category → primary department, with secondary departments and a General Civic Services fallback. |
| **SLA snapshot** | Target hours frozen on the complaint at creation. |
| **Escalation rules** | SLA approaching/breached, unassigned high-severity, repeated complaints, major incidents, surges — idempotent. |
| **Background jobs** | `sla_check` (5 min), `escalation_rules` (10 min), `anomaly_scan` (15 min), `ai_retry` (10 min); one instance per job via an advisory lock. |
| **AI outage fallback** | Complaint preserved, rule-based routing/priority/SLA, `NEEDS_REVIEW`, automatic retry (max 4). |
| **Image analysis** | Local perceptual hash, blur, brightness and dimensions; forged-file and decompression-bomb guards. |
| **Timeline & audit** | Events and audit entries written for every significant action. |
| **Notifications** | In-app always; email and push when configured. |
| **Observability** | `X-Request-Id`, latency and error metrics, secret-free structured logs. |

---

## 8. Permission matrix

| Capability | Public | Citizen | Officer | Admin |
|---|:--:|:--:|:--:|:--:|
| View landing page and public dashboard | ✅ | ✅ | ✅ | ✅ |
| Register / sign in / reset password | ✅ | ✅ | ✅ | ✅ |
| Submit complaints (photos, map, AI assist, duplicate check) | — | ✅ | — | — |
| Track own complaints, timeline, SLA, receipt | — | ✅ | — | view |
| Give feedback / reopen own complaint | — | ✅ | — | — |
| See decision factors, evidence, related complaints | — | ❌ | ✅ | ✅ |
| Accept / start / resolve assigned complaints | — | — | ✅ | ✅ |
| AI Work Assistant and before/after verification | — | — | ✅ | ✅ |
| Field view | — | — | ✅ | — |
| Review AI decisions (approve / correct / duplicates) | — | ❌ | own department | all |
| Assign officers, recommend officer, change status | — | — | ❌ | ✅ |
| Command Center, GIS, analytics, anomalies, forecast | — | ❌ | ❌ | ✅ |
| SLA targets, escalations | — | ❌ | ❌ | ✅ |
| Manage departments and officers (incl. reset officer password) | — | ❌ | ❌ | ✅ |
| Audit log, AI quality / usage / health, jobs | — | ❌ | ❌ | ✅ |
| Export CSV / PDF | public PDF | own receipt | own queue / complaint | all |
