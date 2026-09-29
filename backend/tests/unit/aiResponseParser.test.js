const {
  validateAnalysisResponse,
  validateBeforeAfterResponse,
  validateGuidedAssistResponse,
  validateSituationReportResponse,
  validateAdminSearchFilterResponse,
  validateOfficerChecklistResponse,
} = require('../../src/services/ai/aiResponseParser');

describe('aiResponseParser (validates/rejects AI output before it is ever saved)', () => {
  test('validateAnalysisResponse rejects non-JSON text instead of throwing', () => {
    const result = validateAnalysisResponse('Sorry, I cannot help with that.');
    expect(result.success).toBe(false);
  });

  test('validateAnalysisResponse falls back to OTHER for an invalid category rather than failing outright', () => {
    const result = validateAnalysisResponse(
      JSON.stringify({
        title: 'Test',
        category: 'NOT_A_REAL_CATEGORY',
        language: 'ENGLISH',
        summary: 'A test complaint.',
        confidence: 0.9,
        missing_information: [],
        severity_signals: {},
        image_analysis: {},
        moderation: {},
      })
    );
    expect(result.success).toBe(true);
    expect(result.data.category).toBe('OTHER');
  });

  test('validateAnalysisResponse defaults missing evidence fields to safe conservative values', () => {
    const result = validateAnalysisResponse(
      JSON.stringify({
        title: 'Test',
        category: 'POTHOLE',
        language: 'ENGLISH',
        summary: 'A pothole.',
        confidence: 0.9,
        missing_information: [],
        severity_signals: {},
        image_analysis: {},
        moderation: {},
      })
    );
    expect(result.success).toBe(true);
    expect(result.data.image_analysis.image_supports_claim).toBe(false);
    expect(result.data.image_analysis.manipulated_or_suspicious).toBe(false);
  });

  test('validateBeforeAfterResponse defaults an invalid status enum to UNCERTAIN, never crashes', () => {
    const result = validateBeforeAfterResponse(
      JSON.stringify({ status: 'DEFINITELY_FIXED', likely_resolved: true, confidence: 0.9, summary: 'Looks fixed.' })
    );
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('UNCERTAIN');
  });

  test('validateGuidedAssistResponse caps follow_up_questions and never lets category escape the enum', () => {
    const result = validateGuidedAssistResponse(
      JSON.stringify({
        likely_category: 'MADE_UP_CATEGORY',
        follow_up_questions: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'],
        suggested_description: 'test',
        confidence: 0.7,
      })
    );
    expect(result.success).toBe(true);
    expect(result.data.likely_category).toBe('OTHER');
    expect(result.data.follow_up_questions.length).toBeLessThanOrEqual(6);
  });

  test('validateSituationReportResponse rejects a response missing the required summary field', () => {
    const result = validateSituationReportResponse(JSON.stringify({ highlights: [], recommended_focus_areas: [] }));
    expect(result.success).toBe(false);
  });

  test('validateAdminSearchFilterResponse accepts a well-formed constrained filter object', () => {
    const result = validateAdminSearchFilterResponse(
      JSON.stringify({ category: 'POTHOLE', status: ['ASSIGNED'], near_school: true })
    );
    expect(result.success).toBe(true);
  });

  test('validateAdminSearchFilterResponse ignores extraneous fields rather than erroring (still re-validated downstream)', () => {
    const result = validateAdminSearchFilterResponse(
      JSON.stringify({ category: 'POTHOLE', sql: 'DROP TABLE complaints;' })
    );
    expect(result.success).toBe(true);
    expect(result.data.sql).toBeUndefined();
  });

  test('validateOfficerChecklistResponse caps each list at 8 items', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item ${i}`);
    const result = validateOfficerChecklistResponse(
      JSON.stringify({ inspection_checklist: items, evidence_to_collect: items, resolution_checklist: items })
    );
    expect(result.success).toBe(true);
    expect(result.data.inspection_checklist.length).toBeLessThanOrEqual(8);
  });
});
