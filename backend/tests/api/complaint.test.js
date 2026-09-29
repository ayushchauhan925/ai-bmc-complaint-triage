// Mock the AI + embedding calls so API tests are fast, free and deterministic, and don't
// require a live OPENAI_API_KEY. The AI pipeline itself is exercised manually / in the
// unit tests for the deterministic services it feeds into.
jest.mock('../../src/services/ai/complaintAnalysis.service', () => ({
  analyzeComplaint: jest.fn().mockResolvedValue({
    success: true,
    analysis: {
      category: 'POTHOLE',
      subcategory: 'test',
      language: 'ENGLISH',
      summary: 'Mocked AI summary for automated testing.',
      confidence: 0.9,
      severity_signals: { traffic_hazard: true, near_school: false },
      image_analysis: { issue_visible: false, issue_type: null, image_supports_claim: false },
      moderation: { is_spam_or_irrelevant: false, reason: null },
    },
  }),
}));
jest.mock('../../src/services/ai/embedding.service', () => ({
  generateAndStoreEmbedding: jest.fn().mockResolvedValue({ success: false, failureReason: 'mocked-off' }),
}));

const request = require('supertest');
const app = require('../../src/app');

describe('Complaints API', () => {
  const citizenEmail = `citizen.${Date.now()}@example.demo`;
  let citizenToken;
  let complaintId;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Complaint Test Citizen',
      email: citizenEmail,
      password: 'Password123!',
    });
    const loginRes = await request(app).post('/api/auth/login').send({
      email: citizenEmail,
      password: 'Password123!',
    });
    citizenToken = loginRes.body.data.token;
  });

  test('rejects complaint creation without authentication', async () => {
    const res = await request(app).post('/api/complaints').send({
      description: 'Unauthenticated attempt',
      latitude: 19.07,
      longitude: 72.87,
    });
    expect(res.status).toBe(401);
  });

  test('rejects complaint creation with invalid coordinates', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('description', 'Pothole near my house causing issues for traffic.')
      .field('latitude', '999')
      .field('longitude', '72.87');
    expect(res.status).toBe(400);
  });

  test('creates a complaint and runs the (mocked) AI pipeline', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('description', 'Large pothole near my house causing issues for traffic near the school.')
      .field('latitude', '19.076')
      .field('longitude', '72.877')
      .field('address', 'Test Address');

    expect(res.status).toBe(201);
    expect(res.body.data.complaint.category).toBe('POTHOLE');
    expect(res.body.data.complaint.priority_level).toBeDefined();
    expect(res.body.data.complaint.status).toBe('ASSIGNED');
    complaintId = res.body.data.complaint.id;
  });

  test('citizen can fetch their own complaint', async () => {
    const res = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.complaint.id).toBe(complaintId);
  });

  test('a different citizen cannot access someone else complaint', async () => {
    const otherEmail = `other.${Date.now()}@example.demo`;
    await request(app).post('/api/auth/register').send({
      name: 'Other Citizen',
      email: otherEmail,
      password: 'Password123!',
    });
    const otherLogin = await request(app).post('/api/auth/login').send({
      email: otherEmail,
      password: 'Password123!',
    });

    const res = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${otherLogin.body.data.token}`);
    expect(res.status).toBe(403);
  });

  test('citizen cannot access admin-only endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/statistics')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(403);
  });

  test('citizen cannot directly change complaint status', async () => {
    const res = await request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(403);
  });
});
