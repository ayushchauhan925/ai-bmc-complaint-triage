// Integration tests for the Civic AI Intelligence platform layer. They run against the
// configured test database (use a local/throwaway MySQL - see README "Testing"), with the
// OpenAI-backed services mocked so results are deterministic and cost nothing.

const mockAnalyses = {
  default: {
    category: 'POTHOLE',
    confidence: 0.9,
    signals: { traffic_hazard: true },
  },
};
let mockAiDown = false;

jest.mock('../../src/services/ai/complaintAnalysis.service', () => ({
  analyzeComplaint: jest.fn(async ({ description }) => {
    if (mockAiDown || /AIDOWN/.test(description)) return { success: false, failureReason: 'mocked outage' };
    const critical = /TREEFALL/.test(description);
    const cfg = critical
      ? { category: 'TREE_HAZARD', confidence: 0.95, signals: { traffic_hazard: true, emergency_access_blocked: true } }
      : mockAnalyses.default;
    return {
      success: true,
      safety: { injectionSuspected: /IGNOREPREVIOUS/.test(description), truncated: false },
      analysis: {
        title: 'Mock complaint',
        category: cfg.category,
        subcategory: null,
        language: 'ENGLISH',
        summary: 'Mocked AI summary.',
        normalized_description: description,
        confidence: cfg.confidence,
        missing_information: [],
        severity_signals: cfg.signals,
        urgency: 'NORMAL',
        recommended_action: null,
        location_relevance: 'CLEAR',
        risk_indicators: [],
        explanation_factors: ['mock'],
        image_analysis: {
          issue_visible: false, issue_type: null, image_supports_claim: false, image_quality_sufficient: false,
          is_blurry: false, likely_irrelevant: false, possible_duplicate_image: false, manipulated_or_suspicious: false,
          contextual_notes: null, evidence_confidence: 0,
        },
        moderation: { is_spam_or_irrelevant: false, reason: null },
      },
    };
  }),
}));
jest.mock('../../src/services/ai/embedding.service', () => ({
  generateAndStoreEmbedding: jest.fn().mockResolvedValue({ success: false, failureReason: 'mocked-off' }),
  generateEmbedding: jest.fn().mockResolvedValue({ success: false, failureReason: 'mocked-off' }),
}));

const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const scheduler = require('../../src/services/jobs/scheduler');

jest.setTimeout(30000);

const PW = 'Password123!';
async function loginAs(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PW });
  return res.body.data.token;
}
async function registerCitizen(prefix) {
  const email = `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e5)}@example.demo`;
  await request(app).post('/api/auth/register').send({ name: prefix, email, password: PW });
  return loginAs(email);
}
async function submit(token, description, lat = '19.10', lng = '72.85', address) {
  const req = request(app)
    .post('/api/complaints')
    .set('Authorization', `Bearer ${token}`)
    .field('description', description)
    .field('latitude', lat)
    .field('longitude', lng);
  if (address) req.field('address', address);
  const res = await req;
  expect(res.status).toBe(201);
  return res.body.data.complaint;
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let adminToken;
let citizenToken;
let otherCitizenToken;
let roadsOfficerToken;
let waterOfficerToken;

beforeAll(async () => {
  adminToken = await loginAs('admin@civicconnect.demo');
  roadsOfficerToken = await loginAs('officer.roads@civicconnect.demo');
  waterOfficerToken = await loginAs('officer.water@civicconnect.demo');
  citizenToken = await registerCitizen('platform.citizen');
  otherCitizenToken = await registerCitizen('platform.other');
});

describe('decision pipeline persistence', () => {
  let complaint;
  beforeAll(async () => {
    complaint = await submit(citizenToken, 'Large pothole on the road outside the school gate causing accidents.', '19.11', '72.86', 'Outside school gate, Andheri West');
  });

  test('stores a decision trace with factors, evidence and engine version (staff only)', async () => {
    const res = await request(app).get(`/api/complaints/${complaint.id}/decision-trace`).set(auth(adminToken));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.available).toBe(true);
    expect(d.engineVersion).toBeTruthy();
    expect(d.factors.length).toBeGreaterThan(0);
    expect(d.factors.every((f) => f.label && f.source)).toBe(true);
    expect(d.evidence.score).toBeGreaterThanOrEqual(0);
    expect(d.ai.category).toBe('POTHOLE');
  });

  test('citizens cannot read the decision trace or evidence internals', async () => {
    const a = await request(app).get(`/api/complaints/${complaint.id}/decision-trace`).set(auth(citizenToken));
    const b = await request(app).get(`/api/complaints/${complaint.id}/evidence`).set(auth(citizenToken));
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
  });

  test('evidence endpoint exposes auditable signals, not free-form reasoning', async () => {
    const res = await request(app).get(`/api/complaints/${complaint.id}/evidence`).set(auth(adminToken));
    expect(res.body.data.signals.length).toBeGreaterThan(0);
    expect(res.body.data.signals[0]).toEqual(expect.objectContaining({ key: expect.any(String), points: expect.any(Number), max: expect.any(Number) }));
  });

  test('SLA snapshot is derived from the stored deadline and policy', async () => {
    const res = await request(app).get(`/api/complaints/${complaint.id}/sla`).set(auth(citizenToken));
    expect(res.status).toBe(200);
    expect(res.body.data.sla.deadline).toBeTruthy();
    expect(res.body.data.sla.targetHours).toBeGreaterThan(0);
    expect(res.body.data.sla.status).toBe('ON_TRACK');
  });

  test('audit log recorded creation and AI analysis', async () => {
    const res = await request(app).get(`/api/admin/audit-logs?entity_type=complaint&entity_id=${complaint.id}`).set(auth(adminToken));
    const actions = res.body.data.rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['COMPLAINT_CREATED', 'AI_ANALYSIS_COMPLETED']));
  });
});

describe('complaint timeline visibility', () => {
  let complaint;
  beforeAll(async () => {
    complaint = await submit(citizenToken, 'Broken pavement slab near the bus stop, elderly people are tripping.', '19.12', '72.87');
  });

  test('staff see internal events; the citizen only sees public ones without internal detail', async () => {
    const staff = await request(app).get(`/api/complaints/${complaint.id}/timeline`).set(auth(adminToken));
    const citizen = await request(app).get(`/api/complaints/${complaint.id}/timeline`).set(auth(citizenToken));
    expect(staff.status).toBe(200);
    expect(citizen.status).toBe(200);
    expect(staff.body.data.timeline.some((e) => e.type === 'EVIDENCE_SCORED')).toBe(true);
    expect(citizen.body.data.timeline.some((e) => e.type === 'EVIDENCE_SCORED')).toBe(false);
    expect(citizen.body.data.timeline.every((e) => e.detail === null)).toBe(true);
    expect(citizen.body.data.timeline[0].type).toBe('SUBMITTED');
  });

  test('another citizen cannot read the timeline', async () => {
    const res = await request(app).get(`/api/complaints/${complaint.id}/timeline`).set(auth(otherCitizenToken));
    expect(res.status).toBe(403);
  });
});

describe('human-in-the-loop review', () => {
  let complaint;
  beforeEach(async () => {
    complaint = await submit(citizenToken, `Overflowing garbage bin near the park entrance ${Date.now()}`, '19.13', '72.88');
  });

  test('correction changes category/priority, re-routes, recomputes SLA and stores AI-vs-human values', async () => {
    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/review`)
      .set(auth(adminToken))
      .send({ action: 'CORRECT', category: 'GARBAGE', priority_level: 'LOW', notes: 'Wrong category' });
    expect(res.status).toBe(200);
    const c = res.body.data.complaint;
    expect(c.category).toBe('GARBAGE');
    expect(c.priority_level).toBe('LOW');
    expect(c.review_status).toBe('CORRECTED');
    expect(c.sla_hours).toBeGreaterThan(0);

    const [[dept]] = await pool.query('SELECT code FROM departments WHERE id = ?', [c.department_id]);
    expect(dept.code).toBe('SOLID_WASTE');

    const reviews = await request(app).get(`/api/complaints/${complaint.id}/reviews`).set(auth(adminToken));
    expect(reviews.body.data.reviews[0]).toEqual(
      expect.objectContaining({ action: 'CORRECT', ai_category: 'POTHOLE', human_category: 'GARBAGE', human_priority_level: 'LOW' })
    );

    const audit = await request(app).get(`/api/admin/audit-logs?entity_type=complaint&entity_id=${complaint.id}&action=HUMAN_REVIEW_CORRECT`).set(auth(adminToken));
    expect(audit.body.data.rows[0].previous_value.category).toBe('POTHOLE');
    expect(audit.body.data.rows[0].new_value.category).toBe('GARBAGE');
  });

  test('a corrected complaint is not overwritten by an automatic re-analysis', async () => {
    await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(adminToken)).send({ action: 'CORRECT', category: 'GARBAGE' });
    const { runAnalysisPipeline } = require('../../src/services/complaint/analysisPipeline.service');
    await runAnalysisPipeline(complaint.id); // mocked AI would say POTHOLE again
    const [[row]] = await pool.query('SELECT category FROM complaints WHERE id = ?', [complaint.id]);
    expect(row.category).toBe('GARBAGE');
  });

  test('approve marks the AI decision as confirmed', async () => {
    const res = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(adminToken)).send({ action: 'APPROVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.complaint.review_status).toBe('APPROVED');
  });

  test('false positive closes the complaint but preserves it', async () => {
    const res = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(adminToken)).send({ action: 'FALSE_POSITIVE', notes: 'Spam' });
    expect(res.status).toBe(200);
    expect(res.body.data.complaint.status).toBe('REJECTED');
    const still = await request(app).get(`/api/complaints/${complaint.id}`).set(auth(adminToken));
    expect(still.status).toBe(200);
  });

  test('correction requires at least one corrected value', async () => {
    const res = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(adminToken)).send({ action: 'CORRECT' });
    expect(res.status).toBe(400);
  });

  test('invalid category is rejected by validation', async () => {
    const res = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(adminToken)).send({ action: 'CORRECT', category: 'MADE_UP' });
    expect(res.status).toBe(400);
  });

  test('citizens cannot review; officers can only review their own department', async () => {
    const asCitizen = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(citizenToken)).send({ action: 'APPROVE' });
    expect(asCitizen.status).toBe(403);
    // Pothole -> ROADS. The water officer must be refused, the roads officer allowed.
    const wrongDept = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(waterOfficerToken)).send({ action: 'APPROVE' });
    expect(wrongDept.status).toBe(403);
    const rightDept = await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(roadsOfficerToken)).send({ action: 'APPROVE' });
    expect(rightDept.status).toBe(200);
  });

  test('AI feedback metrics compare AI with human decisions and never fabricate rates', async () => {
    await request(app).post(`/api/complaints/${complaint.id}/review`).set(auth(adminToken)).send({ action: 'CORRECT', category: 'GARBAGE' });
    const res = await request(app).get('/api/admin/ai-performance').set(auth(adminToken));
    expect(res.status).toBe(200);
    const f = res.body.data.feedback;
    expect(f.reviewedDecisions).toBeGreaterThan(0);
    expect(f.classificationAccuracy).toBeGreaterThanOrEqual(0);
    expect(f.classificationAccuracy).toBeLessThanOrEqual(1);
    expect(typeof f.sufficientData).toBe('boolean');
  });
});

describe('duplicate detection + incident linking (text fallback while embeddings are down)', () => {
  test('near-identical reports at one spot are suggested, linked to an incident, and reviewable', async () => {
    const text = `Huge water pipe leakage flooding the road near the temple gate ${Date.now()}`;
    mockAnalyses.default = { category: 'WATER_LEAKAGE', confidence: 0.9, signals: { water_accumulation: true } };
    const first = await submit(citizenToken, text, '19.20', '72.90');
    const second = await submit(otherCitizenToken, text, '19.20005', '72.90005');
    mockAnalyses.default = { category: 'POTHOLE', confidence: 0.9, signals: { traffic_hazard: true } };

    const dup = await request(app).get(`/api/complaints/${second.id}/duplicates`).set(auth(adminToken));
    expect(dup.status).toBe(200);
    const match = dup.body.data.duplicates.find((d) => d.relatedComplaintId === first.id);
    expect(match).toBeTruthy();
    expect(match.duplicateProbability).toBeGreaterThan(0.6);
    expect(match.indicators.length).toBeGreaterThan(0);
    expect(match.shouldLinkToIncident).toBe(true);
    expect(dup.body.data.incidentId).toBeTruthy();

    // Both original reports still exist.
    const a = await request(app).get(`/api/complaints/${first.id}`).set(auth(adminToken));
    expect(a.status).toBe(200);

    // Staff can reject the suggestion: the complaint is detached from the shared incident, not deleted.
    const rej = await request(app).post(`/api/complaints/${second.id}/review`).set(auth(adminToken)).send({ action: 'REJECT_DUPLICATE', related_complaint_id: first.id });
    expect(rej.status).toBe(200);
    expect(rej.body.data.complaint.incident_id).toBeNull();
    const after = await request(app).get(`/api/complaints/${second.id}/duplicates`).set(auth(adminToken));
    expect(after.body.data.duplicates.find((d) => d.relatedComplaintId === first.id).reviewStatus).toBe('REJECTED');

    // ... and confirm it again -> re-linked.
    const conf = await request(app).post(`/api/complaints/${second.id}/review`).set(auth(adminToken)).send({ action: 'CONFIRM_DUPLICATE', related_complaint_id: first.id });
    expect(conf.status).toBe(200);
    expect(conf.body.data.complaint.incident_id).toBeTruthy();

    // Incident command view carries derived intelligence.
    const inc = await request(app).get(`/api/incidents/${conf.body.data.complaint.incident_id}`).set(auth(adminToken));
    expect(inc.body.data.intelligence.complaintCount).toBeGreaterThanOrEqual(2);
    expect(inc.body.data.intelligence.extent.radiusMeters).toBeGreaterThanOrEqual(0);
    expect(['RISING', 'STABLE', 'FALLING', 'INSUFFICIENT_DATA']).toContain(inc.body.data.intelligence.trend.label);
  });
});

describe('AI failure degrades gracefully', () => {
  test('complaint is preserved with fallback routing, SLA and review flag, then recovered by the retry job', async () => {
    const complaint = await submit(citizenToken, `AIDOWN broken street sign at the junction ${Date.now()}`, '19.30', '72.95');
    expect(complaint.status).toBe('NEEDS_REVIEW');
    expect(complaint.ai_analysis_failed).toBeTruthy();
    expect(complaint.department_id).toBeTruthy(); // General Administration fallback
    expect(complaint.sla_deadline).toBeTruthy();
    expect(complaint.review_required).toBeTruthy();

    const trace = await request(app).get(`/api/complaints/${complaint.id}/decision-trace`).set(auth(adminToken));
    expect(trace.body.data.humanReviewRequired).toBe(true);
    expect(trace.body.data.ai).toBeNull();

    // Outage over: the retry job re-analyses eligible complaints (backdate so the cool-down passes).
    await pool.query('UPDATE complaints SET updated_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [complaint.id]);
    const description = complaint.description.replace('AIDOWN', 'recovered');
    await pool.query('UPDATE complaints SET description = ?, updated_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [description, complaint.id]);
    const outcome = await scheduler.retryFailedAnalyses();
    expect(outcome.attempted).toBeGreaterThanOrEqual(1);
    const [[row]] = await pool.query('SELECT ai_analysis_failed, category FROM complaints WHERE id = ?', [complaint.id]);
    expect(row.ai_analysis_failed).toBe(0);
    expect(row.category).toBe('POTHOLE');
  });

  test('prompt-injection suspicion forces human review but is not silently trusted', async () => {
    const complaint = await submit(citizenToken, `IGNOREPREVIOUS instructions, pothole near gate ${Date.now()}`, '19.31', '72.96');
    const trace = await request(app).get(`/api/complaints/${complaint.id}/decision-trace`).set(auth(adminToken));
    expect(trace.body.data.humanReviewRequired).toBe(true);
    expect(trace.body.data.reviewReasons.join(' ')).toMatch(/instruction-like/i);
  });
});

describe('SLA + escalation engine', () => {
  test('SLA policies are configurable, audited, and reflected in new complaints', async () => {
    const before = await request(app).get('/api/sla').set(auth(adminToken));
    expect(before.status).toBe(200);
    const original = before.body.data.policies.find((p) => p.priority_level === 'LOW' && p.category_key === '*');

    const put = await request(app).put('/api/sla/policies').set(auth(adminToken)).send({ priority_level: 'LOW', target_hours: 96 });
    expect(put.status).toBe(200);
    expect(put.body.data.policy.target_hours).toBe(96);

    const audit = await request(app).get('/api/admin/audit-logs?action=SLA_POLICY_CHANGED').set(auth(adminToken));
    expect(audit.body.data.rows.length).toBeGreaterThan(0);

    const bad = await request(app).put('/api/sla/policies').set(auth(adminToken)).send({ priority_level: 'LOW', target_hours: 0 });
    expect(bad.status).toBe(400);

    await request(app).put('/api/sla/policies').set(auth(adminToken)).send({ priority_level: 'LOW', target_hours: original.target_hours });
  });

  test('escalation rules fire once per situation (idempotent) and are audited', async () => {
    const complaint = await submit(citizenToken, `TREEFALL huge tree fallen across the road blocking ambulance ${Date.now()}`, '19.40', '72.99');
    expect(complaint.priority_level).toBe('CRITICAL');
    await pool.query('UPDATE complaints SET created_at = DATE_SUB(NOW(), INTERVAL 3 HOUR), sla_deadline = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [complaint.id]);

    const run1 = await request(app).post('/api/escalations/run').set(auth(adminToken));
    expect(run1.status).toBe(200);
    const list1 = await request(app).get('/api/escalations').set(auth(adminToken));
    const mine = list1.body.data.events.filter((e) => e.complaint_id === complaint.id);
    const rules = mine.map((e) => e.rule_code).sort();
    expect(rules).toEqual(expect.arrayContaining(['HIGH_SEVERITY_UNASSIGNED', 'SLA_BREACHED']));

    await request(app).post('/api/escalations/run').set(auth(adminToken));
    const list2 = await request(app).get('/api/escalations').set(auth(adminToken));
    expect(list2.body.data.events.filter((e) => e.complaint_id === complaint.id)).toHaveLength(mine.length);

    const tl = await request(app).get(`/api/complaints/${complaint.id}/timeline`).set(auth(adminToken));
    expect(tl.body.data.timeline.some((e) => e.type === 'ESCALATED' || e.type === 'SLA_BREACHED')).toBe(true);

    const ack = await request(app).patch(`/api/escalations/${mine[0].id}/acknowledge`).set(auth(adminToken));
    expect(ack.status).toBe(200);
  });

  test('citizens and officers cannot use SLA/escalation admin APIs', async () => {
    for (const t of [citizenToken, roadsOfficerToken]) {
      expect((await request(app).get('/api/sla').set(auth(t))).status).toBe(403);
      expect((await request(app).get('/api/escalations').set(auth(t))).status).toBe(403);
      expect((await request(app).put('/api/sla/policies').set(auth(t)).send({ priority_level: 'LOW', target_hours: 5 })).status).toBe(403);
    }
  });
});

describe('analytics APIs', () => {
  test('all analytics endpoints require an admin', async () => {
    for (const path of ['overview', 'trends', 'heatmap', 'hotspots', 'anomalies', 'forecast', 'department-workload']) {
      expect((await request(app).get(`/api/analytics/${path}`)).status).toBe(401);
      expect((await request(app).get(`/api/analytics/${path}`).set(auth(citizenToken))).status).toBe(403);
    }
  });

  test('overview returns real aggregates in the documented shape', async () => {
    const res = await request(app).get('/api/analytics/overview').set(auth(adminToken));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totals.total).toBeGreaterThan(0);
    expect(d.totals.open + d.totals.resolved).toBeLessThanOrEqual(d.totals.total);
    expect(d.aiConfidence.buckets).toHaveLength(10);
    expect(Array.isArray(d.departmentWorkload)).toBe(true);
    expect(d.anomalies).toHaveProperty('sufficientData');
  });

  test('anomaly detection and forecasting say "insufficient data" instead of inventing results', async () => {
    const anomalies = await request(app).get('/api/analytics/anomalies').set(auth(adminToken));
    expect(anomalies.status).toBe(200);
    if (!anomalies.body.data.sufficientData) {
      expect(anomalies.body.data.anomalies).toEqual([]);
      expect(anomalies.body.data.notes[0]).toMatch(/days of complaint history/);
    }
    const forecast = await request(app).get('/api/analytics/forecast').set(auth(adminToken));
    expect(forecast.status).toBe(200);
    const overall = forecast.body.data.overall;
    if (!overall.available) {
      expect(overall.reason).toMatch(/days/);
      expect(overall.forecast).toBeUndefined();
    }
  });

  test('hotspots + heatmap validate filters and never pass raw input to SQL', async () => {
    const bad = await request(app).get('/api/analytics/hotspots?category=DROP_TABLE').set(auth(adminToken));
    expect(bad.status).toBe(400);
    const badPriority = await request(app).get('/api/analytics/heatmap?priority=EXTREME').set(auth(adminToken));
    expect(badPriority.status).toBe(400);
    const ok = await request(app).get('/api/analytics/hotspots?category=POTHOLE&days=30&status=open').set(auth(adminToken));
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.data.hotspots)).toBe(true);
    const heat = await request(app).get('/api/analytics/heatmap?days=30').set(auth(adminToken));
    expect(heat.body.data.points.every((p) => p.length === 3 && p[2] >= 0 && p[2] <= 1)).toBe(true);
  });

  test('department workload reports null (not 100%) SLA compliance when nothing has been judged', async () => {
    const res = await request(app).get('/api/analytics/department-workload').set(auth(adminToken));
    expect(res.status).toBe(200);
    for (const d of res.body.data.departments) {
      if (d.slaCompliance !== null) {
        expect(d.slaCompliance).toBeGreaterThanOrEqual(0);
        expect(d.slaCompliance).toBeLessThanOrEqual(1);
      }
      expect(d.pending).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('AI evaluation, usage and observability APIs', () => {
  test('deterministic evaluation run is stored and reports skipped live tasks honestly', async () => {
    const res = await request(app).post('/api/admin/evaluations/run').set(auth(adminToken)).send({});
    expect(res.status).toBe(201);
    const routing = res.body.data.summary.find((s) => s.task === 'routing');
    expect(routing.accuracy).toBe(1);
    const cls = res.body.data.summary.find((s) => s.task === 'classification');
    expect(cls.status).toBe('skipped');

    const perf = await request(app).get('/api/admin/ai-performance').set(auth(adminToken));
    expect(perf.body.data.evaluations[0].runId).toBe(res.body.data.runId);
    const run = await request(app).get(`/api/admin/evaluations/${res.body.data.runId}`).set(auth(adminToken));
    expect(run.body.data.cases.length).toBeGreaterThan(20);
  });

  test('AI usage summary and observability snapshot are admin-only and free of secrets', async () => {
    const usage = await request(app).get('/api/admin/ai-usage?days=7').set(auth(adminToken));
    expect(usage.status).toBe(200);
    expect(usage.body.data.totals).toHaveProperty('requests');
    const obs = await request(app).get('/api/admin/observability').set(auth(adminToken));
    expect(obs.status).toBe(200);
    expect(obs.body.data.database.ok).toBe(true);
    expect(obs.body.data.metrics.latency).toBeDefined();
    const serialized = JSON.stringify(obs.body);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toMatch(/JWT_SECRET|DB_PASSWORD|api_key/i);
    expect((await request(app).get('/api/admin/observability').set(auth(citizenToken))).status).toBe(403);
    expect((await request(app).get('/api/admin/audit-logs').set(auth(roadsOfficerToken))).status).toBe(403);
  });

  test('every response carries a request id header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('upload hardening', () => {
  test('a file that claims to be a PNG but is not is rejected before storage', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set(auth(citizenToken))
      .field('description', 'Pothole with a fake image attached for testing.')
      .field('latitude', '19.5')
      .field('longitude', '72.9')
      .attach('images', Buffer.from('this is definitely not an image, just text'), { filename: 'evil.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid/i);
  });
});
