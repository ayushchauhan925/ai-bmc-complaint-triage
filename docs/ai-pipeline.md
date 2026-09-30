# AI Pipeline

Every AI call in this system: (1) uses a strict JSON-only system prompt, (2) has its
response validated against a Zod schema before anything is saved, (3) degrades gracefully
on failure — the app never breaks because OpenAI is slow, down, or returns something
unexpected. This document lists every AI call actually implemented, in the order a
complaint moves through them, plus the standalone AI features (situation reports, admin
search, officer copilot).

Model/API actually used: **OpenAI Chat Completions** (`gpt-4o-mini` by default, configurable
via `OPENAI_TEXT_MODEL` / `OPENAI_VISION_MODEL`) with `response_format: json_object`, and
**OpenAI Embeddings** (`text-embedding-3-small` by default, `OPENAI_EMBEDDING_MODEL`). No
other AI provider, no fine-tuning, no vector database — embeddings are stored as JSON text
in MySQL and compared with cosine similarity computed in Node.

## 1. Guided complaint assistant (Section 1)

**Where:** `POST /api/complaints/ai-assist` → `services/ai/guidedAssistant.service.js`

One-shot (not a multi-turn chatbot). Citizen types a short/incomplete draft; the model
returns a best-guess category, up to 4 follow-up questions, and an optional clearer
rewrite of the draft. It never decides the final category — that happens in step 2 when
the complaint is actually submitted.

```json
{
  "likely_category": "ROAD_DAMAGE",
  "follow_up_questions": ["Is the damage affecting traffic flow?", "..."],
  "suggested_description": "The road near the school is damaged and in poor condition.",
  "confidence": 0.8
}
```

## 2. Unified complaint analysis (Sections 2-4)

**Where:** `POST /api/complaints` (synchronous, on submission) → `services/complaint/analysisPipeline.service.js` → `services/ai/complaintAnalysis.service.js`

**One single OpenAI call** analyzes text + up to 5 photos together and returns everything
downstream logic needs: enrichment (title, category, subcategory, language, summary,
normalized description, missing information) *and* evidence intelligence (per-image
quality/relevance/authenticity assessment) *and* severity signals *and* a spam/irrelevance
moderation flag. There is no second "enrichment" call and no second "evidence analysis"
call — `POST /:id/ai-enrich` and `POST /:id/evidence-analysis` are thin projections of this
same result (they re-run the same pipeline and return a subset of fields), not separate AI
requests, to avoid doubling OpenAI usage for what is conceptually one analysis.

Full schema returned by the model (validated in `services/ai/aiResponseParser.js`):

```json
{
  "title": "Large pothole near school",
  "category": "POTHOLE",
  "subcategory": "flooded pothole",
  "language": "HINGLISH",
  "summary": "Large pothole with water accumulation near a school.",
  "normalized_description": "There is a large pothole outside the school...",
  "confidence": 0.9,
  "missing_information": ["Exact landmark not provided"],
  "severity_signals": {
    "traffic_hazard": true, "large_damage": true, "water_accumulation": true,
    "near_school": true, "near_hospital": false, "near_public_place": false,
    "injury_reported": false, "public_health_risk": false, "environmental_risk": false,
    "emergency_access_blocked": false, "multiple_people_affected": true
  },
  "image_analysis": {
    "issue_visible": true, "issue_type": "pothole", "image_supports_claim": true,
    "image_quality_sufficient": true, "is_blurry": false, "likely_irrelevant": false,
    "possible_duplicate_image": false, "manipulated_or_suspicious": false,
    "contextual_notes": null, "evidence_confidence": 0.92
  },
  "moderation": { "is_spam_or_irrelevant": false, "reason": null }
}
```

**Review, never rejection:** a low `evidence_confidence`, `image_supports_claim: false`,
`likely_irrelevant: true`, `manipulated_or_suspicious: true`, insufficient image quality, or
low overall `confidence` each set `review_required = true` with a human-readable
`review_reason` — the complaint is still created and tracked, just flagged for an admin
(`GET /api/admin/complaints?review_required=true`, the "Flagged" page in the UI).

**Failure handling:** if the OpenAI call fails or returns invalid JSON, the complaint is
marked `ai_analysis_failed = true`, `review_required = true`, and moved to
`NEEDS_REVIEW` — submission itself never fails.

## 3. Embeddings + duplicate detection (Section 11 pre-existing, extended in Section 16)

**Where:** `services/ai/embedding.service.js`, `services/duplicate/duplicateDetection.service.js`

The AI summary + description is embedded once per complaint and stored. Duplicate/related
complaints are found by: geo+time SQL prefilter → cosine similarity in Node → combined with
normalized distance and recency using configured weights (`DUPLICATE_DETECTION` in
`constants.js`).

**Pre-submission duplicate check (Section 16, `POST /api/complaints/duplicate-check`)**
reuses the exact same embedding + comparison logic, but against a **separate, lower
threshold** (`DUPLICATE_DETECTION.preSubmission`). This isn't a shortcut — stored embeddings
are computed from `AI summary + description`, but a pre-submission draft has no summary yet,
so raw-draft-vs-enriched-embedding similarity is systematically lower for the same
real-world match. This was discovered and fixed during testing (see `docs/demo-flow.md`
verification notes) — the original single threshold made the pre-submission check useless.

## 4. Incident escalation (Section 6)

No AI call. `services/duplicate/incidentGrouping.service.js` computes a deterministic bonus
on top of the complaint-level priority score: geographic concentration (how tightly the
linked complaints cluster around their centroid, relative to the duplicate-detection radius)
and duration (how long the incident has been open), both from `INCIDENT_ESCALATION` in
`constants.js`.

## 5. Hotspot detection (Section 7)

No AI call. `services/complaint/hotspot.service.js` is a pure greedy geo/time/category
clustering algorithm over recent unresolved complaints (`HOTSPOT_DETECTION` config:
radius, time window, minimum count). Explicitly not presented as official BMC analysis.

## 6. AI admin natural-language search (Section 9)

**Where:** `POST /api/admin/ai-search` → `services/admin/adminSearch.service.js`

The model converts a question into a constrained JSON filter object — **it never writes
SQL**. The raw output is then re-validated field-by-field against an explicit allowlist
(`ADMIN_SEARCH_ALLOWED_FIELDS`) before the backend builds a parameterized query from known
columns. See `architecture.md`'s dedicated diagram and
`tests/unit/adminSearch.service.test.js` for the security tests (SQL-injection-shaped
strings, unknown fields, out-of-range values are all dropped, never executed). Every query
is logged to `ai_admin_queries` (raw question + the filters actually applied + result
count) for auditability.

## 7. AI situation report (Section 11)

**Where:** `POST /api/admin/situation-report` → `services/admin/situationReport.service.js`

The backend first computes a `stats_snapshot` from **only verified aggregated
database queries** (total/critical/SLA-breach counts, category/department breakdowns,
hotspot summaries — no raw complaint text, no citizen PII). That snapshot is sent to the
model with an explicit instruction to use only the given numbers; the snapshot is stored
alongside the generated text (`ai_situation_reports` table) specifically so an admin can
always verify the summary against its source data. Generated only on explicit admin action
— never automatically — to avoid unnecessary OpenAI usage.

## 8. Officer AI Copilot (Section 12)

**Where:** `GET /api/officer/ai-assistance/:id` → `services/ai/officerCopilot.service.js`

Given the complaint's category/description/severity signals, returns an inspection
checklist, evidence-to-collect list, and pre-resolution checklist — explicitly advisory,
never presented as an official instruction. Cached on the complaint row
(`ai_officer_checklist`) after first generation so revisiting the page doesn't re-call
OpenAI.

## 9. Resolution quality verification (Sections 18/21)

**Where:** officer's resolve action → `services/ai/imageVerification.service.js`

Compares the original ("before") photo against the officer's resolution ("after") photo
plus the complaint description, and returns one of `SUPPORTED` / `UNCERTAIN` /
`NOT_SUPPORTED` with signals (`same_area_appears_addressed`, `image_quality_sufficient`,
`after_image_appears_related_to_before`, `additional_review_recommended`). Stored on the
complaint (`resolution_verification`, `resolution_verification_status`). **Always
advisory** — an admin approves or rejects the actual `RESOLVED` transition regardless of
what this says.

## Validation & failure handling, summarized

| Failure mode | What happens |
|---|---|
| OpenAI unreachable / rate-limited | One retry for the main analysis call, then the affected feature returns `available: false` / `ai_analysis_failed`; nothing crashes |
| Malformed / non-JSON response | Caught by `parseJsonSafely`, treated as a failure, never thrown |
| Response has valid JSON but wrong shape/enum values | Zod `.catch()` fallbacks substitute safe defaults (e.g. unknown category → `OTHER`, unknown before/after status → `UNCERTAIN`) rather than rejecting the whole response |
| AI proposes a field/value not on an explicit allowlist (admin search only) | Silently dropped, never reaches SQL |

Every one of these paths has a corresponding test — see `tests/unit/aiResponseParser.test.js`
and `tests/unit/adminSearch.service.test.js`.

---

> **Update:** the AI pipeline now includes evidence scoring, a hybrid decision engine, prompt-injection guards and fallback/retry behaviour. See [README > The complaint pipeline](../README.md#the-complaint-pipeline-step-by-step) and [Intelligence capabilities](../README.md#intelligence-capabilities-in-depth).
