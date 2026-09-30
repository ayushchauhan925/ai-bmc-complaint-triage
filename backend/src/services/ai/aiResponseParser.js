const { z } = require('zod');
const { CATEGORIES } = require('../../utils/constants');
const { cleanModelText } = require('./aiSafety');

const severitySignalsSchema = z.object({
  traffic_hazard: z.boolean().default(false),
  large_damage: z.boolean().default(false),
  water_accumulation: z.boolean().default(false),
  near_school: z.boolean().default(false),
  near_hospital: z.boolean().default(false),
  near_public_place: z.boolean().default(false),
  injury_reported: z.boolean().default(false),
  public_health_risk: z.boolean().default(false),
  environmental_risk: z.boolean().default(false),
  emergency_access_blocked: z.boolean().default(false),
  multiple_people_affected: z.boolean().default(false),
});

// Evidence Intelligence (Section 3): per-image quality/relevance/authenticity assessment,
// nested inside image_analysis so existing readers of issue_visible/image_supports_claim
// keep working unchanged.
const imageAnalysisSchema = z
  .object({
    issue_visible: z.boolean().default(false),
    issue_type: z.string().nullable().optional().default(null),
    image_supports_claim: z.boolean().default(false),
    image_quality_sufficient: z.boolean().default(false),
    is_blurry: z.boolean().default(false),
    likely_irrelevant: z.boolean().default(false),
    possible_duplicate_image: z.boolean().default(false),
    manipulated_or_suspicious: z.boolean().default(false),
    contextual_notes: z.string().nullable().optional().default(null),
    evidence_confidence: z.number().min(0).max(1).catch(0.5),
  })
  .default({});

// Bounded, markup-free text for every free-text field the model produces.
const cleanText = (max) => z.string().transform((v) => cleanModelText(v, max));

// Risk indicators the model may report. Anything outside this list is dropped (not trusted).
const RISK_INDICATORS = [
  'INJURY_RISK',
  'TRAFFIC_ACCIDENT_RISK',
  'HEALTH_HAZARD',
  'FLOOD_RISK',
  'STRUCTURAL_RISK',
  'ELECTRICAL_HAZARD',
  'FIRE_RISK',
  'ENVIRONMENTAL_HAZARD',
  'VULNERABLE_GROUPS_AFFECTED',
];

const analysisResponseSchema = z.object({
  title: cleanText(255).pipe(z.string().min(1)).catch('Civic complaint'),
  category: z.enum(CATEGORIES).catch('OTHER'),
  subcategory: z.string().nullable().optional().default(null).transform((v) => cleanModelText(v, 50)),
  language: z.enum(['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI', 'OTHER']).catch('OTHER'),
  summary: cleanText(1000).pipe(z.string().min(1)),
  normalized_description: z.string().nullable().optional().default(null).transform((v) => cleanModelText(v, 1000)),
  confidence: z.number().min(0).max(1).catch(0.5),
  missing_information: z.array(cleanText(160)).max(8).catch([]),
  severity_signals: severitySignalsSchema.default({}),
  // --- Extended structured output (all optional: older/partial responses still validate) ---
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'IMMEDIATE']).catch('NORMAL'),
  recommended_action: z.string().nullable().optional().default(null).transform((v) => cleanModelText(v, 300)),
  location_relevance: z.enum(['CLEAR', 'VAGUE', 'MISSING']).catch('VAGUE'),
  risk_indicators: z
    .array(z.string())
    .catch([])
    .transform((arr) => [...new Set(arr.map((x) => String(x).toUpperCase()))].filter((x) => RISK_INDICATORS.includes(x))),
  explanation_factors: z.array(cleanText(160)).max(5).catch([]),
  image_analysis: imageAnalysisSchema,
  moderation: z
    .object({
      is_spam_or_irrelevant: z.boolean().default(false),
      reason: z.string().nullable().optional().default(null).transform((v) => cleanModelText(v, 200)),
    })
    .default({}),
});

const beforeAfterResponseSchema = z.object({
  status: z.enum(['SUPPORTED', 'UNCERTAIN', 'NOT_SUPPORTED']).catch('UNCERTAIN'),
  likely_resolved: z.boolean(),
  confidence: z.number().min(0).max(1).catch(0.5),
  summary: z.string().min(1).max(500),
  signals: z
    .object({
      same_area_appears_addressed: z.boolean().default(false),
      image_quality_sufficient: z.boolean().default(false),
      after_image_appears_related_to_before: z.boolean().default(false),
      additional_review_recommended: z.boolean().default(false),
    })
    .default({}),
});

const guidedAssistResponseSchema = z.object({
  likely_category: z.enum(CATEGORIES).catch('OTHER'),
  follow_up_questions: z.array(z.string()).max(6).catch([]),
  suggested_description: z.string().nullable().optional().default(null),
  confidence: z.number().min(0).max(1).catch(0.5),
});

const situationReportResponseSchema = z.object({
  summary: z.string().min(1).max(3000),
  highlights: z.array(z.string()).catch([]),
  recommended_focus_areas: z.array(z.string()).catch([]),
});

// Admin NL-search: the model's raw output before allowlist validation (services/admin/adminSearch.service.js
// re-validates every field against ADMIN_SEARCH_ALLOWED_FIELDS - this schema only enforces shape/types).
const adminSearchFilterSchema = z
  .object({
    category: z.string().optional(),
    status: z.array(z.string()).optional(),
    priority_level: z.array(z.string()).optional(),
    department_code: z.string().optional(),
    ward_code: z.string().optional(),
    sla_status: z.array(z.string()).optional(),
    near_school: z.boolean().optional(),
    near_hospital: z.boolean().optional(),
    min_related_count: z.number().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    review_required: z.boolean().optional(),
    limit: z.number().optional(),
  })
  .partial();

const officerChecklistResponseSchema = z.object({
  inspection_checklist: z.array(z.string()).max(8).catch([]),
  evidence_to_collect: z.array(z.string()).max(8).catch([]),
  resolution_checklist: z.array(z.string()).max(8).catch([]),
});

function parseJsonSafely(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (err) {
    return null;
  }
}

function makeValidator(schema) {
  return (rawText) => {
    const json = parseJsonSafely(rawText);
    if (!json) return { success: false, error: 'AI response was not valid JSON.' };
    const result = schema.safeParse(json);
    if (!result.success) {
      return { success: false, error: result.error.message };
    }
    return { success: true, data: result.data };
  };
}

module.exports = {
  RISK_INDICATORS,
  validateAnalysisResponse: makeValidator(analysisResponseSchema),
  validateBeforeAfterResponse: makeValidator(beforeAfterResponseSchema),
  validateGuidedAssistResponse: makeValidator(guidedAssistResponseSchema),
  validateSituationReportResponse: makeValidator(situationReportResponseSchema),
  validateAdminSearchFilterResponse: makeValidator(adminSearchFilterSchema),
  validateOfficerChecklistResponse: makeValidator(officerChecklistResponseSchema),
};
