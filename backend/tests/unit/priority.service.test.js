const priorityService = require('../../src/services/complaint/priority.service');

describe('priority.service.calculatePriority', () => {
  test('base severity only, no signals, no duplicates -> score matches base tier, level from thresholds', () => {
    const result = priorityService.calculatePriority({
      category: 'STREETLIGHT',
      severitySignals: {},
      relatedComplaintCount: 0,
      createdAt: new Date(),
    });
    // STREETLIGHT has MEDIUM base severity (20 points), which falls in the LOW priority
    // band (0-39) per PRIORITY_LEVEL_THRESHOLDS - severity tier and priority level are
    // separate scales.
    expect(result.score).toBe(20);
    expect(result.level).toBe('LOW');
  });

  test('critical category with multiple severity signals reaches CRITICAL band', () => {
    const result = priorityService.calculatePriority({
      category: 'FLOODING',
      severitySignals: {
        traffic_hazard: true,
        near_school: true,
        injury_reported: true,
      },
      relatedComplaintCount: 0,
      createdAt: new Date(),
    });
    // base 40 + traffic_hazard 20 + near_school 15 + injury_reported 30 = 105, capped at 100
    expect(result.score).toBe(100);
    expect(result.level).toBe('CRITICAL');
  });

  test('score is capped at 100 even with many stacked signals', () => {
    const result = priorityService.calculatePriority({
      category: 'SEWERAGE',
      severitySignals: {
        traffic_hazard: true,
        near_school: true,
        near_hospital: true,
        injury_reported: true,
        emergency_access_blocked: true,
        public_health_risk: true,
      },
      relatedComplaintCount: 20,
      createdAt: new Date(),
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe('CRITICAL');
  });

  test('duplicate count increases score according to configured brackets', () => {
    const base = priorityService.calculatePriority({
      category: 'GARBAGE',
      severitySignals: {},
      relatedComplaintCount: 0,
      createdAt: new Date(),
    });
    const withDuplicates = priorityService.calculatePriority({
      category: 'GARBAGE',
      severitySignals: {},
      relatedComplaintCount: 8,
      createdAt: new Date(),
    });
    expect(withDuplicates.score).toBeGreaterThan(base.score);
  });

  test('reasons array explains the score (for UI "why this priority" display)', () => {
    const result = priorityService.calculatePriority({
      category: 'POTHOLE',
      severitySignals: { traffic_hazard: true },
      relatedComplaintCount: 2,
      createdAt: new Date(),
    });
    expect(result.reasons.length).toBeGreaterThan(1);
    expect(result.reasons.some((r) => r.label.toLowerCase().includes('traffic'))).toBe(true);
  });
});
