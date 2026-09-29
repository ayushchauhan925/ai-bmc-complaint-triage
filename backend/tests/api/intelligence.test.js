jest.mock('../../src/services/ai/complaintAnalysis.service', () => ({
  analyzeComplaint: jest.fn().mockResolvedValue({
    success: true,
    analysis: {
      title: 'Pothole near market',
      category: 'POTHOLE',
      subcategory: 'test',
      language: 'ENGLISH',
      summary: 'Mocked AI summary for reopen-flow testing.',
      normalized_description: 'A pothole near the market.',
      confidence: 0.9,
      missing_information: [],
      severity_signals: { traffic_hazard: true },
      image_analysis: {
        issue_visible: false,
        issue_type: null,
        image_supports_claim: false,
        image_quality_sufficient: false,
        is_blurry: false,
        likely_irrelevant: false,
        possible_duplicate_image: false,
        manipulated_or_suspicious: false,
        contextual_notes: null,
        evidence_confidence: 0,
      },
      moderation: { is_spam_or_irrelevant: false, reason: null },
    },
  }),
}));
jest.mock('../../src/services/ai/embedding.service', () => ({
  generateAndStoreEmbedding: jest.fn().mockResolvedValue({ success: false, failureReason: 'mocked-off' }),
  generateEmbedding: jest.fn().mockResolvedValue({ success: false, failureReason: 'mocked-off' }),
}));

const request = require('supertest');
const app = require('../../src/app');

async function loginAs(email, password = 'Password123!') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

describe('Public transparency dashboard', () => {
  test('GET /api/public/statistics requires no authentication', async () => {
    const res = await request(app).get('/api/public/statistics');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total_complaints');
    expect(res.body.data).toHaveProperty('data_scope');
  });

  test('public statistics never include citizen-identifying fields', async () => {
    const res = await request(app).get('/api/public/statistics');
    const serialized = JSON.stringify(res.body.data);
    expect(serialized).not.toMatch(/email/i);
    expect(serialized).not.toMatch(/phone/i);
  });
});

describe('Civic Intelligence Center authorization', () => {
  let citizenToken;

  beforeAll(async () => {
    const email = `intel.citizen.${Date.now()}@example.demo`;
    await request(app).post('/api/auth/register').send({ name: 'Intel Citizen', email, password: 'Password123!' });
    citizenToken = await loginAs(email);
  });

  test('a citizen cannot access the intelligence center', async () => {
    const res = await request(app).get('/api/admin/intelligence').set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(403);
  });

  test('a citizen cannot trigger the AI admin search', async () => {
    const res = await request(app)
      .post('/api/admin/ai-search')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ query: 'show me everything' });
    expect(res.status).toBe(403);
  });

  test('a citizen cannot generate a situation report', async () => {
    const res = await request(app).post('/api/admin/situation-report').set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(403);
  });

  test('an unauthenticated request is rejected before role-checking', async () => {
    const res = await request(app).get('/api/admin/hotspots');
    expect(res.status).toBe(401);
  });
});

describe('Reopen flow (Section 17)', () => {
  let citizenToken;
  let otherCitizenToken;
  let adminToken;
  let complaintId;

  beforeAll(async () => {
    const email = `reopen.citizen.${Date.now()}@example.demo`;
    await request(app).post('/api/auth/register').send({ name: 'Reopen Citizen', email, password: 'Password123!' });
    citizenToken = await loginAs(email);

    const otherEmail = `reopen.other.${Date.now()}@example.demo`;
    await request(app).post('/api/auth/register').send({ name: 'Other Citizen', email: otherEmail, password: 'Password123!' });
    otherCitizenToken = await loginAs(otherEmail);

    adminToken = await loginAs('admin@civicconnect.demo');

    const createRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('description', 'Pothole near the market causing traffic issues for vehicles.')
      .field('latitude', '19.05')
      .field('longitude', '72.90');
    complaintId = createRes.body.data.complaint.id;
    expect(createRes.body.data.complaint.status).toBe('ASSIGNED');
  });

  test('cannot reopen a complaint that is not yet resolved', async () => {
    const res = await request(app)
      .post(`/api/complaints/${complaintId}/reopen`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('reason', 'still broken');
    expect(res.status).toBe(400);
  });

  test('walk the complaint to RESOLVED as admin, then a non-owner cannot reopen it', async () => {
    await request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });
    await request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLUTION_SUBMITTED' });
    const resolvedRes = await request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' });
    expect(resolvedRes.body.data.complaint.status).toBe('RESOLVED');

    const forbiddenReopen = await request(app)
      .post(`/api/complaints/${complaintId}/reopen`)
      .set('Authorization', `Bearer ${otherCitizenToken}`)
      .field('reason', 'not mine to reopen');
    expect(forbiddenReopen.status).toBe(403);
  });

  test('the owning citizen can reopen it, walking RESOLVED -> REOPENED -> ASSIGNED', async () => {
    const res = await request(app)
      .post(`/api/complaints/${complaintId}/reopen`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('reason', 'The pothole is still there.');
    expect(res.status).toBe(200);
    expect(res.body.data.complaint.status).toBe('ASSIGNED');
  });
});

describe('Incident merge (Section 5)', () => {
  let adminToken;
  let targetId;
  let sourceId;

  beforeAll(async () => {
    adminToken = await loginAs('admin@civicconnect.demo');

    const target = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test target incident', category: 'POTHOLE', latitude: 19.05, longitude: 72.9 });
    targetId = target.body.data.incident.id;

    const source = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test source incident', category: 'POTHOLE', latitude: 19.051, longitude: 72.901 });
    sourceId = source.body.data.incident.id;
  });

  test('cannot merge an incident into itself', async () => {
    const res = await request(app)
      .post(`/api/incidents/${targetId}/merge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source_incident_id: targetId });
    expect(res.status).toBe(400);
  });

  test('merging closes the source incident and both timelines record the merge', async () => {
    const res = await request(app)
      .post(`/api/incidents/${targetId}/merge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source_incident_id: sourceId });
    expect(res.status).toBe(200);

    const sourceDetail = await request(app)
      .get(`/api/incidents/${sourceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sourceDetail.body.data.incident.status).toBe('CLOSED');
    expect(sourceDetail.body.data.timeline.some((e) => e.event_type === 'MERGED')).toBe(true);

    const targetDetail = await request(app)
      .get(`/api/incidents/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(targetDetail.body.data.timeline.some((e) => e.event_type === 'MERGE_RECEIVED')).toBe(true);
  });
});
