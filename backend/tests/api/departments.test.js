// Department catalog, routing, officer management and smart assignment - against the real
// (test) database with the OpenAI-backed services mocked.

let mockCategory = 'POTHOLE';
jest.mock('../../src/services/ai/complaintAnalysis.service', () => ({
  analyzeComplaint: jest.fn(async ({ description }) => ({
    success: true,
    safety: { injectionSuspected: false, truncated: false },
    analysis: {
      title: 'Mock', category: mockCategory, subcategory: null, language: 'ENGLISH', summary: 'Mock summary.',
      normalized_description: description, confidence: 0.9, missing_information: [], severity_signals: {},
      urgency: 'NORMAL', recommended_action: null, location_relevance: 'CLEAR', risk_indicators: [], explanation_factors: [],
      image_analysis: { issue_visible: false, issue_type: null, image_supports_claim: false, image_quality_sufficient: false, is_blurry: false, likely_irrelevant: false, possible_duplicate_image: false, manipulated_or_suspicious: false, contextual_notes: null, evidence_confidence: 0 },
      moderation: { is_spam_or_irrelevant: false, reason: null },
    },
  })),
}));
jest.mock('../../src/services/ai/embedding.service', () => ({
  generateAndStoreEmbedding: jest.fn().mockResolvedValue({ success: false }),
  generateEmbedding: jest.fn().mockResolvedValue({ success: false }),
}));

const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { ensureDepartmentCatalog } = require('../../src/services/department/catalog.service');
const { DEPARTMENT_CATALOG } = require('../../src/utils/departmentCatalog');
const { CATEGORIES } = require('../../src/utils/constants');

jest.setTimeout(60000);
const PW = 'Password123!';
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const uniq = (p) => `${p}.${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
const login = (email, password = PW) => request(app).post('/api/auth/login').send({ email, password });

let adminToken;
let citizenToken;
let codeToId;

async function dept(code) {
  const [[row]] = await pool.query('SELECT * FROM departments WHERE code = ?', [code]);
  return row;
}
async function submit(description, lat = '19.2', lng = '72.9') {
  const res = await request(app).post('/api/complaints').set(auth(citizenToken)).field('description', description).field('latitude', lat).field('longitude', lng);
  expect(res.status).toBe(201);
  return res.body.data.complaint;
}
const wards = async () => (await pool.query('SELECT id FROM wards ORDER BY id LIMIT 3'))[0];

beforeAll(async () => {
  adminToken = (await login('admin@civicconnect.demo')).body.data.token;
  const email = `${uniq('deptcit')}@example.demo`;
  await request(app).post('/api/auth/register').send({ name: 'Dept Citizen', email, password: PW });
  citizenToken = (await login(email)).body.data.token;
  const [rows] = await pool.query('SELECT id, code FROM departments');
  codeToId = Object.fromEntries(rows.map((r) => [r.code, r.id]));
});

describe('department catalog in the database', () => {
  test('every catalog department exists exactly once with a stable code', async () => {
    const [rows] = await pool.query('SELECT code, COUNT(*) AS n FROM departments GROUP BY code');
    for (const d of DEPARTMENT_CATALOG) expect(rows.find((r) => r.code === d.code)?.n).toBe(1);
    expect(rows.every((r) => Number(r.n) === 1)).toBe(true);
  });

  test('syncing the catalog is idempotent and never overwrites admin edits', async () => {
    await pool.query("UPDATE departments SET name = 'Custom Parks Name', is_active = FALSE WHERE code = 'PARKS'");
    const before = (await pool.query('SELECT COUNT(*) AS n FROM departments'))[0][0].n;
    const first = await ensureDepartmentCatalog();
    const second = await ensureDepartmentCatalog();
    const after = (await pool.query('SELECT COUNT(*) AS n FROM departments'))[0][0].n;
    expect(first.created).toBe(0);
    expect(second.created).toBe(0);
    expect(after).toBe(before);
    const parks = await dept('PARKS');
    expect(parks.name).toBe('Custom Parks Name');
    expect(parks.is_active).toBe(0);
    await pool.query("UPDATE departments SET name = 'Parks & Recreation', is_active = TRUE WHERE code = 'PARKS'");
  });

  test('every category routes (through the pipeline) to a real department row', async () => {
    for (const category of ['BUILDING_COLLAPSE', 'DANGEROUS_BUILDING', 'STRAY_ANIMAL', 'PARK_DAMAGE', 'POLLUTION', 'NATURAL_DISASTER', 'SEWERAGE', 'PUBLIC_TOILET']) {
      mockCategory = category;
      const c = await submit(`Routing check for ${category} ${Date.now()}`);
      const row = await dept(
        { BUILDING_COLLAPSE: 'EMERGENCY_RESPONSE', DANGEROUS_BUILDING: 'BUILDINGS', STRAY_ANIMAL: 'ANIMAL_MANAGEMENT', PARK_DAMAGE: 'PARKS', POLLUTION: 'ENVIRONMENT', NATURAL_DISASTER: 'DISASTER_MANAGEMENT', SEWERAGE: 'SEWERAGE', PUBLIC_TOILET: 'CIVIC_AMENITIES' }[category]
      );
      expect(c.department_id).toBe(row.id);
    }
    expect(CATEGORIES.length).toBe(28);
    mockCategory = 'POTHOLE';
  });

  test('the routing decision records secondary departments on the timeline', async () => {
    mockCategory = 'FLOODING';
    const c = await submit(`Flooding with secondary ${Date.now()}`);
    const tl = await request(app).get(`/api/complaints/${c.id}/timeline`).set(auth(adminToken));
    const ev = tl.body.data.timeline.find((e) => e.type === 'DEPARTMENT_ASSIGNED');
    expect(ev.detail.secondaryDepartments).toContain('Flood / Emergency Water Management');
    mockCategory = 'POTHOLE';
  });
});

describe('admin: department management', () => {
  test('overview lists all departments with categories and counts; supports search and active filter', async () => {
    const res = await request(app).get('/api/admin/departments/overview').set(auth(adminToken));
    expect(res.status).toBe(200);
    const list = res.body.data.departments;
    expect(list.length).toBeGreaterThanOrEqual(20);
    const roads = list.find((d) => d.code === 'ROADS');
    expect(roads.name).toBe('Roads & Traffic Infrastructure');
    expect(roads.primaryCategories).toEqual(expect.arrayContaining(['POTHOLE', 'ROAD_DAMAGE', 'FOOTPATH_DAMAGE']));
    expect(roads.activeOfficers).toBeGreaterThanOrEqual(1);
    expect(typeof roads.activeComplaints).toBe('number');
    expect(list.find((d) => d.code === 'PUBLIC_HEALTH').secondaryCategories).toEqual(expect.arrayContaining(['PUBLIC_TOILET']));

    const search = await request(app).get('/api/admin/departments/overview?search=sewer').set(auth(adminToken));
    expect(search.body.data.departments.map((d) => d.code)).toContain('SEWERAGE');
    const inactive = await request(app).get('/api/admin/departments/overview?active=false').set(auth(adminToken));
    expect(inactive.body.data.departments.every((d) => d.isActive === false)).toBe(true);
  });

  test('only admins can see or change departments', async () => {
    expect((await request(app).get('/api/admin/departments/overview').set(auth(citizenToken))).status).toBe(403);
    expect((await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(citizenToken)).send({ is_active: false })).status).toBe(403);
    expect((await request(app).get('/api/admin/departments/overview')).status).toBe(401);
  });

  test('invalid department ids and bad input are rejected', async () => {
    const bad = await request(app).patch('/api/admin/departments/abc').set(auth(adminToken)).send({ description: 'valid text' });
    expect(bad.status).toBe(400);
    const missing = await request(app).patch('/api/admin/departments/999999').set(auth(adminToken)).send({ description: 'valid text' });
    expect(missing.status).toBe(404);
    const invalidEmail = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ contact_email: 'not-an-email' });
    expect(invalidEmail.status).toBe(400);
  });

  test('contact details can be edited and are audited', async () => {
    const res = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ contact_email: 'parks@city.example', contact_phone: '022-5550100' });
    expect(res.status).toBe(200);
    expect(res.body.data.department.contactEmail).toBe('parks@city.example');
    const audit = await request(app).get('/api/admin/audit-logs?action=DEPARTMENT_UPDATED').set(auth(adminToken));
    expect(audit.body.data.rows.length).toBeGreaterThan(0);
  });

  test('the General Civic Services fallback can never be deactivated', async () => {
    const res = await request(app).patch(`/api/admin/departments/${codeToId.GENERAL_CIVIC}`).set(auth(adminToken)).send({ is_active: false });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/fallback/i);
  });

  test('deactivation is blocked while open complaints exist, unless they are reassigned', async () => {
    mockCategory = 'PARK_DAMAGE';
    const open = await submit(`Park bench broken ${Date.now()}`);
    const closed = await submit(`Park fountain broken ${Date.now()}`);
    await pool.query("UPDATE complaints SET status = 'RESOLVED', resolved_at = NOW() WHERE id = ?", [closed.id]);
    mockCategory = 'POTHOLE';
    expect(open.department_id).toBe(codeToId.PARKS);

    const blocked = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ is_active: false });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/open complaint/i);
    expect(blocked.body.details.openComplaints).toBeGreaterThanOrEqual(1);
    expect((await dept('PARKS')).is_active).toBe(1); // unchanged

    // reassignment target must be valid, active and different
    const same = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ is_active: false, reassign_to_department_id: codeToId.PARKS });
    expect(same.status).toBe(400);
    const missing = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ is_active: false, reassign_to_department_id: 999999 });
    expect(missing.status).toBe(404);
    await pool.query("UPDATE departments SET is_active = FALSE WHERE code = 'ENVIRONMENT'");
    const inactiveTarget = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ is_active: false, reassign_to_department_id: codeToId.ENVIRONMENT });
    expect(inactiveTarget.status).toBe(409);
    await pool.query("UPDATE departments SET is_active = TRUE WHERE code = 'ENVIRONMENT'");

    const ok = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ is_active: false, reassign_to_department_id: codeToId.PUBLIC_INFRASTRUCTURE });
    expect(ok.status).toBe(200);
    expect(ok.body.data.reassigned).toBeGreaterThanOrEqual(1);
    expect(ok.body.data.department.isActive).toBe(false);

    const [[moved]] = await pool.query('SELECT department_id, officer_id FROM complaints WHERE id = ?', [open.id]);
    expect(moved.department_id).toBe(codeToId.PUBLIC_INFRASTRUCTURE);
    expect(moved.officer_id).toBeNull();
    const [[stillClosed]] = await pool.query('SELECT department_id FROM complaints WHERE id = ?', [closed.id]);
    expect(stillClosed.department_id).toBe(codeToId.PARKS); // history untouched

    const tl = await request(app).get(`/api/complaints/${open.id}/timeline`).set(auth(adminToken));
    expect(tl.body.data.timeline.some((e) => /deactivated/i.test(e.title))).toBe(true);
  });

  test('while a department is inactive, new complaints for its categories fall back; reactivating restores routing', async () => {
    expect((await dept('PARKS')).is_active).toBe(0);
    mockCategory = 'PARK_DAMAGE';
    const during = await submit(`Playground swing broken ${Date.now()}`);
    expect(during.department_id).toBe(codeToId.GENERAL_CIVIC);

    const reactivated = await request(app).patch(`/api/admin/departments/${codeToId.PARKS}`).set(auth(adminToken)).send({ is_active: true });
    expect(reactivated.status).toBe(200);
    const after = await submit(`Playground slide broken ${Date.now()}`);
    expect(after.department_id).toBe(codeToId.PARKS);
    mockCategory = 'POTHOLE';
  });

  test('an inactive department cannot be chosen when assigning a complaint', async () => {
    await pool.query("UPDATE departments SET is_active = FALSE WHERE code = 'PARKS'");
    const c = await submit(`Assignment target test ${Date.now()}`);
    const res = await request(app).patch(`/api/admin/complaints/${c.id}/assign`).set(auth(adminToken)).send({ department_id: codeToId.PARKS });
    expect(res.status).toBe(409);
    await pool.query("UPDATE departments SET is_active = TRUE WHERE code = 'PARKS'");
  });
});

describe('admin: officer management', () => {
  const newOfficer = async (overrides = {}) => {
    const [w] = await wards();
    return request(app)
      .post('/api/admin/officers')
      .set(auth(adminToken))
      .send({ name: 'Test Officer', email: `${uniq('off')}@civicconnect.demo`, password: PW, department_id: codeToId.ENVIRONMENT, ward_id: w.id, ...overrides });
  };

  test('officers must reference a real, active department and a real ward', async () => {
    expect((await newOfficer({ department_id: 999999 })).status).toBe(404);
    expect((await newOfficer({ ward_id: 999999 })).status).toBe(404);
    await pool.query("UPDATE departments SET is_active = FALSE WHERE code = 'ENVIRONMENT'");
    expect((await newOfficer()).status).toBe(409);
    await pool.query("UPDATE departments SET is_active = TRUE WHERE code = 'ENVIRONMENT'");
    expect((await newOfficer({ department_id: 'abc' })).status).toBe(400);
    expect((await newOfficer({ password: 'short' })).status).toBe(400);
    expect((await newOfficer({ email: 'admin@civicconnect.demo' })).status).toBe(409);
  });

  test('citizens and officers cannot manage officers', async () => {
    expect((await request(app).post('/api/admin/officers').set(auth(citizenToken)).send({})).status).toBe(403);
    expect((await request(app).get('/api/admin/officers/overview').set(auth(citizenToken))).status).toBe(403);
  });

  test('a created officer can sign in, appears in the overview with department/ward/metrics, and is always an OFFICER', async () => {
    const [w] = await wards();
    const email = `${uniq('okoff')}@civicconnect.demo`;
    const created = await newOfficer({ email, ward_id: w.id });
    expect(created.status).toBe(201);
    expect(created.body.data.officer.role).toBe('OFFICER');
    expect(created.body.data.officer.department_id).toBe(codeToId.ENVIRONMENT);
    expect(created.body.data.officer.ward_id).toBe(w.id);
    expect(created.body.data.officer).not.toHaveProperty('password_hash');
    expect((await login(email)).status).toBe(200);

    const overview = await request(app).get(`/api/admin/officers/overview?search=${encodeURIComponent(email)}`).set(auth(adminToken));
    const row = overview.body.data.officers[0];
    expect(row).toEqual(expect.objectContaining({ departmentCode: 'ENVIRONMENT', isActive: true, activeAssignments: 0, criticalAssignments: 0, slaBreaches: 0 }));
    expect(row.wardName).toMatch(/Ward/);
  });

  test('overview can be filtered by department and status', async () => {
    const res = await request(app).get(`/api/admin/officers/overview?department_id=${codeToId.ROADS}&status=active`).set(auth(adminToken));
    expect(res.body.data.officers.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.officers.every((o) => o.departmentCode === 'ROADS' && o.isActive)).toBe(true);
  });

  test('deactivating an officer with open work requires releasing it; the officer then cannot sign in or use old tokens', async () => {
    const email = `${uniq('deact')}@civicconnect.demo`;
    const created = await newOfficer({ email, department_id: codeToId.ROADS });
    const officerId = created.body.data.officer.id;
    const officerToken = (await login(email)).body.data.token;

    mockCategory = 'POTHOLE';
    const c = await submit(`Pothole for deactivation test ${Date.now()}`);
    await pool.query('UPDATE complaints SET officer_id = ? WHERE id = ?', [officerId, c.id]);

    const blocked = await request(app).patch(`/api/admin/officers/${officerId}`).set(auth(adminToken)).send({ is_active: false });
    expect(blocked.status).toBe(409);
    expect(blocked.body.details.openAssignments).toBeGreaterThanOrEqual(1);

    const ok = await request(app).patch(`/api/admin/officers/${officerId}`).set(auth(adminToken)).send({ is_active: false, release_assignments: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.released).toBeGreaterThanOrEqual(1);
    const [[row]] = await pool.query('SELECT officer_id FROM complaints WHERE id = ?', [c.id]);
    expect(row.officer_id).toBeNull();

    expect((await login(email)).status).toBe(403);
    expect((await request(app).get('/api/officer/complaints').set(auth(officerToken))).status).toBe(403); // existing session is cut off too
  });

  test('moving an officer to another department also needs their open work released', async () => {
    const created = await newOfficer({ department_id: codeToId.ROADS });
    const officerId = created.body.data.officer.id;
    const c = await submit(`Pothole for move test ${Date.now()}`);
    await pool.query('UPDATE complaints SET officer_id = ? WHERE id = ?', [officerId, c.id]);
    const blocked = await request(app).patch(`/api/admin/officers/${officerId}`).set(auth(adminToken)).send({ department_id: codeToId.WATER });
    expect(blocked.status).toBe(409);
    const ok = await request(app).patch(`/api/admin/officers/${officerId}`).set(auth(adminToken)).send({ department_id: codeToId.WATER, release_assignments: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.officer.department_id).toBe(codeToId.WATER);
    expect((await request(app).patch(`/api/admin/officers/${officerId}`).set(auth(adminToken)).send({ department_id: 999999 })).status).toBe(404);
    expect((await request(app).patch('/api/admin/officers/999999').set(auth(adminToken)).send({ name: 'Nobody' })).status).toBe(404);
  });
});

describe('assignment rules and smart recommendations', () => {
  test('assignment respects the department, and inactive officers cannot receive work', async () => {
    const [w] = await wards();
    const mk = async (departmentId) => (await request(app).post('/api/admin/officers').set(auth(adminToken)).send({ name: 'Assignee', email: `${uniq('as')}@civicconnect.demo`, password: PW, department_id: departmentId, ward_id: w.id })).body.data.officer;
    const roadsOfficer = await mk(codeToId.ROADS);
    const waterOfficer = await mk(codeToId.WATER);
    mockCategory = 'POTHOLE';
    const c = await submit(`Assignment rule test ${Date.now()}`);

    const wrongDept = await request(app).patch(`/api/admin/complaints/${c.id}/assign`).set(auth(adminToken)).send({ department_id: codeToId.ROADS, officer_id: waterOfficer.id });
    expect(wrongDept.status).toBe(400);
    expect(wrongDept.body.message).toMatch(/does not belong/i);

    const ok = await request(app).patch(`/api/admin/complaints/${c.id}/assign`).set(auth(adminToken)).send({ department_id: codeToId.ROADS, officer_id: roadsOfficer.id });
    expect(ok.status).toBe(200);
    expect(ok.body.data.complaint.officer_id).toBe(roadsOfficer.id);

    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [roadsOfficer.id]);
    const inactive = await request(app).patch(`/api/admin/complaints/${c.id}/assign`).set(auth(adminToken)).send({ department_id: codeToId.ROADS, officer_id: roadsOfficer.id });
    expect(inactive.status).toBe(409);
    expect(inactive.body.message).toMatch(/inactive/i);

    expect((await request(app).patch(`/api/admin/complaints/${c.id}/assign`).set(auth(adminToken)).send({ department_id: 999999 })).status).toBe(404);
    expect((await request(app).patch(`/api/admin/complaints/${c.id}/assign`).set(auth(adminToken)).send({ department_id: codeToId.ROADS, officer_id: 999999 })).status).toBe(404);
  });

  test('recommendations are ward-aware, workload-aware, exclude inactive officers, and explain themselves', async () => {
    const [w1, w2] = await wards();
    const mk = async (name, wardId) => (await request(app).post('/api/admin/officers').set(auth(adminToken)).send({ name, email: `${uniq('rec')}@civicconnect.demo`, password: PW, department_id: codeToId.DISASTER_MANAGEMENT, ward_id: wardId })).body.data.officer;
    const a = await mk('Rec A (ward 1, busy)', w1.id);
    const b = await mk('Rec B (ward 2, idle)', w2.id);
    const inactive = await mk('Rec C (ward 1, inactive)', w1.id);
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [inactive.id]);

    // A already has one open job
    mockCategory = 'NATURAL_DISASTER';
    const busy = await submit(`Existing disaster job ${Date.now()}`);
    await pool.query('UPDATE complaints SET officer_id = ? WHERE id = ?', [a.id, busy.id]);

    const target = await submit(`New disaster to assign ${Date.now()}`);
    expect(target.department_id).toBe(codeToId.DISASTER_MANAGEMENT);
    mockCategory = 'POTHOLE';

    // Complaint in ward 1: the ward match (A) beats the idle officer from another ward (B).
    await pool.query('UPDATE complaints SET ward_id = ? WHERE id = ?', [w1.id, target.id]);
    const withWard = await request(app).get(`/api/admin/complaints/${target.id}/recommend-officer`).set(auth(adminToken));
    const recs = withWard.body.data.recommendations;
    const ids = recs.map((r) => r.officerId);
    expect(ids).not.toContain(inactive.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
    const recA = recs.find((r) => r.officerId === a.id);
    expect(recA).toEqual(expect.objectContaining({ wardMatch: true, workload: 1, rank: expect.any(Number) }));
    expect(recA.reasons.join(' ')).toMatch(/ward/i);

    // No ward on the complaint: workload decides, so the idle officer comes first.
    await pool.query('UPDATE complaints SET ward_id = NULL WHERE id = ?', [target.id]);
    const noWard = await request(app).get(`/api/admin/complaints/${target.id}/recommend-officer`).set(auth(adminToken));
    const ids2 = noWard.body.data.recommendations.map((r) => r.officerId);
    expect(ids2.indexOf(b.id)).toBeLessThan(ids2.indexOf(a.id));

    // The admin makes the final call: recommendation does not assign anyone by itself.
    const [[unchanged]] = await pool.query('SELECT officer_id FROM complaints WHERE id = ?', [target.id]);
    expect(unchanged.officer_id).toBeNull();
  });

  test('recommendations only offer officers of the complaint\'s own department', async () => {
    mockCategory = 'POTHOLE';
    const c = await submit(`Dept-scope recommendation ${Date.now()}`);
    const res = await request(app).get(`/api/admin/complaints/${c.id}/recommend-officer`).set(auth(adminToken));
    const [officers] = await pool.query("SELECT id, department_id FROM users WHERE role = 'OFFICER'");
    const dep = new Map(officers.map((o) => [o.id, o.department_id]));
    expect(res.body.data.recommendations.every((r) => dep.get(r.officerId) === c.department_id)).toBe(true);
  });
});
