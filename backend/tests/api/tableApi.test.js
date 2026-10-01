// Server-side sorting, pagination limits and audit-log search that the shared frontend tables rely on.
// Runs against the test database; no AI calls are made.

const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

jest.setTimeout(60000);
const PW = 'Password123!';
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let adminToken;
let officerToken;

beforeAll(async () => {
  const a = await request(app).post('/api/auth/login').send({ email: 'admin@civicconnect.demo', password: PW });
  expect(a.status).toBe(200);
  adminToken = a.body.data.token;
  const o = await request(app).post('/api/auth/login').send({ email: 'officer.roads@civicconnect.demo', password: PW });
  expect(o.status).toBe(200);
  officerToken = o.body.data.token;
});

afterAll(async () => { await pool.end(); });

const list = (qs, token = adminToken) => request(app).get(`/api/admin/complaints?${qs}`).set(auth(token));

describe('complaint list sorting (admin)', () => {
  test('sorts by created_at ascending and descending', async () => {
    const asc = await list('limit=20&sort=created_at&order=asc');
    const desc = await list('limit=20&sort=created_at&order=desc');
    expect(asc.status).toBe(200);
    const a = asc.body.data.rows.map((r) => r.id);
    const d = desc.body.data.rows.map((r) => r.id);
    expect(a.length).toBeGreaterThan(1);
    const ts = (rows) => rows.map((r) => new Date(String(r.created_at).replace(' ', 'T')).getTime());
    const at = ts(asc.body.data.rows);
    const dt = ts(desc.body.data.rows);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect([...dt].sort((x, y) => y - x)).toEqual(dt);
    expect(a).not.toEqual(d);
  });

  test('sorts by priority score, highest first when descending', async () => {
    const res = await list('limit=30&sort=priority&order=desc');
    const scores = res.body.data.rows.map((r) => r.priority_score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });

  test('sorts by department name and by SLA deadline with empty deadlines last', async () => {
    const dep = await list('limit=30&sort=department&order=asc');
    const names = dep.body.data.rows.map((r) => r.department_name).filter(Boolean);
    expect([...names].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }))).toEqual(names);

    const sla = await list('limit=100&sort=sla_deadline&order=asc');
    expect(sla.status).toBe(200);
    const rows = sla.body.data.rows;
    const firstNull = rows.findIndex((r) => r.sla_deadline === null);
    if (firstNull >= 0) expect(rows.slice(firstNull).every((r) => r.sla_deadline === null)).toBe(true);
  });

  test('an unknown or hostile sort key falls back to the default order instead of reaching SQL', async () => {
    const def = await list('limit=10');
    for (const bad of ['created_at;DROP TABLE users', '1; SELECT SLEEP(5)', 'nope', "x' OR '1'='1"]) {
      const res = await list(`limit=10&sort=${encodeURIComponent(bad)}&order=asc`);
      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBe(def.body.data.rows.length);
    }
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
    expect(n).toBeGreaterThan(0); // table still exists
  });

  test('an invalid order value is treated as descending', async () => {
    const bad = await list('limit=10&sort=created_at&order=sideways');
    const desc = await list('limit=10&sort=created_at&order=desc');
    expect(bad.body.data.rows.map((r) => r.id)).toEqual(desc.body.data.rows.map((r) => r.id));
  });

  test('paging with a sort is stable: pages do not overlap and the count is consistent', async () => {
    const p1 = await list('page=1&limit=10&sort=status&order=asc');
    const p2 = await list('page=2&limit=10&sort=status&order=asc');
    const ids1 = new Set(p1.body.data.rows.map((r) => r.id));
    expect(p2.body.data.rows.every((r) => !ids1.has(r.id))).toBe(true);
    expect(p1.body.data.total).toBe(p2.body.data.total);
  });

  test('page size is capped at 100 rows', async () => {
    const res = await list('limit=5000');
    expect(res.status).toBe(200);
    expect(res.body.data.rows.length).toBeLessThanOrEqual(100);
    expect(res.body.data.limit).toBe(100);
  });

  test('a negative or zero page is treated as page 1', async () => {
    const res = await list('page=-3&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
  });
});

describe('officer department list', () => {
  test('supports search, priority filter and sorting, scoped to the officer department', async () => {
    const all = await request(app).get('/api/officer/complaints?limit=50&sort=priority&order=desc').set(auth(officerToken));
    expect(all.status).toBe(200);
    const deptIds = new Set(all.body.data.rows.map((r) => r.department_id));
    expect(deptIds.size).toBeLessThanOrEqual(1);
    const scores = all.body.data.rows.map((r) => r.priority_score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);

    const high = await request(app).get('/api/officer/complaints?limit=50&priority_level=HIGH').set(auth(officerToken));
    expect(high.body.data.rows.every((r) => r.priority_level === 'HIGH')).toBe(true);

    const none = await request(app).get('/api/officer/complaints?search=zzz-no-such-text-zzz').set(auth(officerToken));
    expect(none.body.data.rows).toHaveLength(0);
  });
});

describe('audit log search and order', () => {
  const audit = (qs) => request(app).get(`/api/admin/audit-logs?${qs}`).set(auth(adminToken));

  test('searches by action, actor name and resource, and returns a matching total', async () => {
    const byAction = await audit('search=STATUS&limit=20');
    expect(byAction.status).toBe(200);
    expect(byAction.body.data.rows.every((r) => /STATUS/i.test(r.action) || /STATUS/i.test(r.entity_type) || /STATUS/i.test(String(r.actor_name)) || /STATUS/i.test(String(r.entity_id)))).toBe(true);

    const byActor = await audit('search=System%20Admin&limit=20');
    expect(byActor.body.data.rows.every((r) => r.actor_name && /System Admin/i.test(r.actor_name))).toBe(true);
    expect(byActor.body.data.total).toBeGreaterThanOrEqual(byActor.body.data.rows.length);

    const none = await audit('search=zzz-nothing-zzz');
    expect(none.body.data.rows).toHaveLength(0);
    expect(none.body.data.total).toBe(0);
  });

  test('order=asc returns oldest first and is not injectable', async () => {
    const asc = await audit('limit=10&order=asc');
    const ids = asc.body.data.rows.map((r) => r.id);
    expect([...ids].sort((x, y) => x - y)).toEqual(ids);
    const hostile = await audit(`limit=10&order=${encodeURIComponent('asc; DROP TABLE audit_logs')}`);
    expect(hostile.status).toBe(200);
    const desc = hostile.body.data.rows.map((r) => r.id);
    expect([...desc].sort((x, y) => y - x)).toEqual(desc); // anything but "asc" means newest first
  });

  test('is admin-only', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set(auth(officerToken));
    expect(res.status).toBe(403);
  });
});
