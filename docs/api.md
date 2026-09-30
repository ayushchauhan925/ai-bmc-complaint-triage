# API Reference

Base URL: `http://localhost:5000/api` (or `VITE_API_BASE_URL`). All authenticated endpoints
take `Authorization: Bearer <token>`. The frontend's claimed role is never trusted — every
role check happens server-side against the database, and ownership checks (e.g. "is this
your complaint") are enforced in the service/controller layer, not just the UI.

Response envelope: `{ "success": true, "data": {...} }` or `{ "success": false, "message": "...", "details"?: [...] }`.

## Auth

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | none | `name, email, password, phone?` | Always creates a `CITIZEN` — role is never accepted from the client |
| POST | `/auth/login` | none | `email, password` | Returns `{ user, token }` |
| GET | `/auth/me` | any | - | Current user profile |

## Complaints

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/complaints` | CITIZEN | multipart: `description, latitude, longitude, address?, images[]` | Runs the full AI pipeline synchronously before responding |
| POST | `/complaints/ai-assist` | CITIZEN | `draft` | Guided assistant (Section 1) - follow-up questions + suggested rewrite |
| POST | `/complaints/duplicate-check` | CITIZEN | `description, latitude, longitude` | Pre-submission duplicate warning (Section 16), never blocks submission |
| GET | `/complaints` | any | query: `page, limit, status, category, priority_level, department_id, ward_id, search` | CITIZEN forced to own complaints, OFFICER forced to own assignments |
| GET | `/complaints/:id` | owner/staff | - | 403 if a citizen requests someone else's complaint |
| PATCH | `/complaints/:id` | ADMIN | `category?, subcategory?, department_id?, ward_id?, address?, review_required?` | Manual reclassification fallback |
| PATCH | `/complaints/:id/status` | ADMIN/OFFICER | `status, notes?` | Validated against the lifecycle graph in `status.service.js`; OFFICER restricted to their own assigned complaint |
| POST | `/complaints/:id/analyze` | ADMIN | - | Re-runs the full AI pipeline |
| POST | `/complaints/:id/verify-image` | ADMIN | - | Re-runs the same pipeline (image_analysis is part of the unified result) |
| POST | `/complaints/:id/ai-enrich` | ADMIN | - | Re-runs the pipeline, returns the enrichment projection (title/summary/category/.../missing_information) |
| POST | `/complaints/:id/evidence-analysis` | ADMIN | - | Re-runs the pipeline, returns the evidence-intelligence projection |
| POST | `/complaints/:id/duplicates` | owner/staff | - | Related complaints for this complaint (POST, legacy shape) |
| GET | `/complaints/:id/similar` | owner/staff | - | Same as above, GET alias |
| POST | `/complaints/:id/reopen` | CITIZEN (owner) | multipart: `reason?, image?` | Only from `RESOLVED`; walks `RESOLVED → REOPENED → ASSIGNED` |
| POST | `/complaints/:id/feedback` | CITIZEN (owner) | `resolved, rating?, comment?` | `resolved: false` internally calls the same reopen service |

## Incidents

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/incidents` | ADMIN/OFFICER | query: `page, limit, status, department_id` | |
| GET | `/incidents/:id` | ADMIN/OFFICER | - | Includes linked complaints (with images) and the event timeline |
| POST | `/incidents` | ADMIN | `title, category, latitude, longitude, department_id?` | Manual incident creation |
| PATCH | `/incidents/:id` | ADMIN | `status?` | Logged to the incident timeline |
| POST | `/incidents/:id/complaints` | ADMIN | `complaint_id` | Link an existing complaint into this incident |
| DELETE | `/incidents/:id/complaints/:complaintId` | ADMIN | - | Unlink (does not delete the complaint) |
| POST | `/incidents/:id/merge` | ADMIN | `source_incident_id` | Moves every complaint from the source into `:id`, closes the source (`status = CLOSED`), logs `MERGED`/`MERGE_RECEIVED` on both timelines |

## Admin

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/complaints` | ADMIN | Unrestricted list + filters, incl. `review_required` |
| PATCH | `/admin/complaints/:id/assign` | ADMIN | `department_id, officer_id?` |
| GET | `/admin/complaints/:id/recommend-officer` | ADMIN | Smart assignment recommendation (Section 13) - ranked by workload, critical count, proximity |
| GET | `/admin/statistics` | ADMIN | Dashboard summary cards + quick charts |
| GET | `/admin/map-data` | ADMIN | Filtered marker points for the map |
| GET | `/admin/analytics` | ADMIN | Full analytics page data |
| GET | `/admin/departments` / `/wards` / `/officers` | ADMIN | Reference data |
| GET | `/admin/intelligence` | ADMIN | **Civic Intelligence Center** (Section 10): summary, department/ward stats, hotspots, recent incidents, latest situation report (if <24h old), and triggers the SLA escalation check |
| GET | `/admin/hotspots` | ADMIN | Hotspot clusters only |
| POST | `/admin/ai-search` | ADMIN | `query` → AI-proposed filter, sanitized against an allowlist, executed, logged to `ai_admin_queries` |
| POST | `/admin/situation-report` | ADMIN | Generates and stores a new AI situation report from live verified stats |
| GET | `/admin/situation-reports` | ADMIN | History of generated reports |
| POST | `/admin/sla/check` | ADMIN | Manually triggers the SLA escalation sweep |
| GET | `/admin/sla/escalations` | ADMIN | Recent escalation notifications |

## Officer

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/officer/complaints` | OFFICER | query: `page, limit, status` | Own department's queue |
| PATCH | `/officer/complaints/:id/accept` | OFFICER | - | Claims an unassigned department complaint |
| PATCH | `/officer/complaints/:id/start` | OFFICER | `notes?` | `ASSIGNED → IN_PROGRESS` |
| POST | `/officer/complaints/:id/resolution-image` | OFFICER | multipart: `image` | Stores as `image_type=RESOLUTION` |
| PATCH | `/officer/complaints/:id/resolve` | OFFICER | `notes?` | `IN_PROGRESS → RESOLUTION_SUBMITTED`; runs before/after AI verification if both photos exist |
| GET | `/officer/ai-assistance/:id` | OFFICER | - | AI Work Assistant checklist (Section 12), cached after first call |

## Notifications

| Method | Path | Auth |
|---|---|---|
| GET | `/notifications` | any (own) |
| PATCH | `/notifications/:id/read` | any (own) |

## Public (no authentication)

| Method | Path | Notes |
|---|---|---|
| GET | `/public/statistics` | Aggregated counts only - no citizen names, contact details, or precise addresses. Explicitly labels its data scope in the response. |

## Errors

Standard HTTP status codes: `400` validation, `401` missing/invalid token, `403`
authenticated but not permitted, `404` not found, `409` conflict (e.g. duplicate email,
complaint already accepted by another officer), `500` unexpected (stack trace only in
non-production, never sent to the client in production).

---

> **Update:** the platform layer added many endpoints (analytics, SLA policies, escalations, human review, timeline, decision trace, audit, AI usage/performance/evaluation, observability, semantic search). They are documented in the root [README API reference](../README.md#api-reference).
