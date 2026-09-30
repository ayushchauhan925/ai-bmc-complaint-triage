// Managed MySQL hosts such as Aiven can run with sql_mode ANSI_QUOTES, where "text" is an
// identifier rather than a string literal. A default local MySQL accepts `FIELD(x, "A")` but
// production rejects it (this exact bug shipped once: "Unknown column 'CRITICAL'"). These tests
// run the read endpoints with ANSI_QUOTES forced on every pooled connection to catch that class
// of portability bug before deploy.

jest.mock('../../src/services/ai/complaintAnalysis.service', () => ({ analyzeComplaint: jest.fn().mockResolvedValue({ success: false, failureReason: 'off' }) }));
jest.mock('../../src/services/ai/embedding.service', () => ({
  generateAndStoreEmbedding: jest.fn().mockResolvedValue({ success: false }),
  generateEmbedding: jest.fn().mockResolvedValue({ success: false, failureReason: 'off' }),
}));

const request = require('supertest');
const { pool } = require('../../src/config/db');

// Must be attached before the first query so every connection is created in ANSI mode.
pool.pool.on('connection', (conn) => {
  conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',ANSI_QUOTES')");
});

const app = require('../../src/app');

jest.setTimeout(60000);

describe('admin endpoints under ANSI_QUOTES sql_mode (Aiven-like)', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@civicconnect.demo', password: 'Password123!' });
    token = res.body.data.token;
    const [[row]] = await pool.query('SELECT @@SESSION.sql_mode AS m');
    expect(row.m).toMatch(/ANSI_QUOTES/);
  });

  const paths = [
    '/api/sla',
    '/api/escalations',
    '/api/analytics/overview',
    '/api/analytics/trends',
    '/api/analytics/heatmap',
    '/api/analytics/hotspots',
    '/api/analytics/anomalies?refresh=true',
    '/api/analytics/forecast',
    '/api/analytics/department-workload',
    '/api/admin/audit-logs',
    '/api/admin/ai-usage',
    '/api/admin/ai-performance',
    '/api/admin/observability',
    '/api/admin/complaints',
    '/api/admin/statistics',
    '/api/admin/intelligence',
    '/api/incidents',
    '/api/public/statistics',
  ];

  test.each(paths)('GET %s succeeds', async (p) => {
    const res = await request(app).get(p).set('Authorization', `Bearer ${token}`);
    expect({ path: p, status: res.status, message: res.body.message }).toEqual({ path: p, status: 200, message: undefined });
  });
});
