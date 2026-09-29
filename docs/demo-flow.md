# Demo Flow (5-10 minutes)

Prerequisites: both servers running (`npm run dev` in `backend/` and `frontend/`), database
migrated and seeded (`npm run migrate && npm run seed && npm run seed:complaints`).
Everything below was actually run against the live app during development — see the
verification notes at the end for exactly what was tested and how.

## 1. Citizen: report an issue (~90s)

1. Open `http://localhost:5173`, click **Get started**, register a new citizen account (or
   sign in as a seeded one, e.g. `aarav.sharma@example.demo` / `Password123!`).
2. Click **Report a Civic Problem**.
3. Type: `"School ke bahar bahut bada gaddha hai, baarish ke time pani bhar jata hai."`
4. Optionally click **Get AI suggestions** — shows the likely category and a couple of
   follow-up questions (Section 1 guided assistant).
5. Add a photo (optional), click **Use current location** or click the map near an existing
   seeded pothole cluster (e.g. `19.076, 72.878`).
6. Click **Check for similar complaints nearby** — with a location near the seeded pothole
   cluster this shows several matches (Section 16 duplicate warning). Submission is never
   blocked by this.
7. Submit. The AI pipeline runs synchronously (a few seconds) and the complaint detail page
   shows: AI title/summary, category, severity signals, **Evidence Intelligence** panel (if
   a photo was attached), a fully explained priority score, auto-assigned department, and
   (if duplicates were found) an incident link.

## 2. Admin: Civic Intelligence Center (~2 min)

1. Log out, sign in as `admin@civicconnect.demo`.
2. Open **Intelligence** in the sidebar.
3. Point out the summary cards, then click **Generate report** under AI Situation Report —
   the narrative it produces cites the exact numbers shown in the cards (it was given only
   those verified numbers, nothing invented).
4. Scroll to **Emerging hotspots** — the seeded pothole/water-leakage clusters show up with
   complaint counts, dominant priority, and time range.
5. Try the **AI admin search** box with one of the example chips, e.g. *"Show unresolved
   potholes near schools"* — point out the "Applied filters" line showing the exact
   allowlisted JSON the backend actually executed (never raw SQL from the AI).

## 3. Admin: map, incidents, assignment (~90s)

1. Open **Map** — priority-colored clustered markers, filterable by category/priority/status/department.
2. Open **Incidents**, click into one with several linked complaints — shows the map
   location, linked complaint cards, and the event timeline. Demonstrate merging one small
   incident into another via the merge box.
3. Open **Complaints**, click into an unassigned one, and in the admin action panel click
   **Recommend officer** — shows officers ranked by current workload/critical count/proximity,
   click one to select it, save the assignment.

## 4. Officer: work the queue (~90s)

1. Sign in as the matching department officer (e.g. `officer.roads@civicconnect.demo`).
2. On the dashboard, open the newly assigned complaint, click **Accept**, then **Start work**.
3. Click **Get AI suggestions** under AI Work Assistant — an inspection checklist, evidence
   to collect, and a pre-resolution checklist (explicitly labeled advisory).
4. Upload an "after" photo, add a note, click **Mark resolution submitted** — the AI
   before/after comparison result (SUPPORTED/UNCERTAIN/NOT_SUPPORTED) appears.

## 5. Admin: approve, citizen: feedback & reopen (~90s)

1. As admin, open the complaint, approve the resolution (status → `RESOLVED`).
2. Sign back in as the citizen who filed it. The complaint page shows a feedback form.
   Answer "Not resolved" with a comment — the complaint reopens automatically (`RESOLVED →
   REOPENED → ASSIGNED`), and it's back in the officer's queue.
3. Alternatively, use the standalone **Report issue not actually resolved** button, which
   also accepts an evidence photo.

## 6. Public transparency dashboard (~30s)

Open `http://localhost:5173/public` in a fresh/incognito tab (no login) — aggregate counts,
category breakdown, resolution-time and SLA-compliance figures, explicitly labeled with its
data scope and that no citizen-identifying information is shown.

---

## What was actually verified during development (not just written)

Every feature above was exercised against the **live OpenAI API and a real MySQL database**
via direct HTTP requests during implementation, including:
- Hinglish, Marathi, and English text correctly classified, prioritized, and routed
- A real generated test image analyzed end-to-end (evidence intelligence fields populated,
  `image_verified` set correctly)
- Duplicate detection and automatic incident grouping across multiple near-identical
  complaints, including a bug found and fixed live (a missing transaction parameter in
  incident linking, and a MySQL-9-reserved-keyword collision in an analytics query)
- The pre-submission duplicate-check threshold mismatch (raw draft vs. summary-enriched
  embeddings) found and fixed with a separate calibrated threshold
- Full officer accept → start → upload photo → resolve flow, with a real AI before/after
  verification returning `likely_resolved: true`
- Admin approval, citizen feedback, and the dedicated reopen endpoint, confirmed via the
  actual status history rows in the database
- AI admin search converting real natural-language questions into constrained filters and
  returning correct, safely-queried results
- AI situation report generation referencing only the exact numbers supplied to it
- Incident merge closing the source incident and recording both timeline events
- The full backend test suite (61 tests across 9 suites) passing, and a clean TypeScript
  build of the frontend

**Not verified:** the UI was never opened in an actual browser during this build — there is
no browser automation tool in this environment. Everything above was confirmed via the real
HTTP API and direct database queries. Please click through this flow yourself before a live
demo.
