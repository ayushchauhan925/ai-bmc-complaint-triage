/* eslint-disable no-console */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { DEPARTMENTS_SEED } = require('../src/utils/constants');
const { ensureDepartmentCatalog } = require('../src/services/department/catalog.service');

// Demo officer accounts created before the catalog keep their original emails, so re-seeding
// never creates a second officer for the same department.
const LEGACY_OFFICER_EMAILS = {
  PUBLIC_HEALTH: 'officer.sanitation@civicconnect.demo',
  GENERAL_CIVIC: 'officer.general@civicconnect.demo',
};

const DEMO_WARDS = [
  { ward_code: 'DEMO-A', ward_name: 'Ward A (DEMO)' },
  { ward_code: 'DEMO-B', ward_name: 'Ward B (DEMO)' },
  { ward_code: 'DEMO-C', ward_name: 'Ward C (DEMO)' },
  { ward_code: 'DEMO-D', ward_name: 'Ward D (DEMO)' },
  { ward_code: 'DEMO-E', ward_name: 'Ward E (DEMO)' },
  { ward_code: 'DEMO-F', ward_name: 'Ward F (DEMO)' },
  { ward_code: 'DEMO-G', ward_name: 'Ward G (DEMO)' },
  { ward_code: 'DEMO-H', ward_name: 'Ward H (DEMO)' },
];

const DEMO_PASSWORD = 'Password123!';

const CITIZEN_NAMES = [
  'Aarav Sharma', 'Priya Patel', 'Rohan Mehta', 'Sneha Iyer', 'Vikram Singh',
  'Anjali Desai', 'Karan Joshi', 'Neha Kulkarni', 'Arjun Nair', 'Divya Rao',
  'Sanjay Verma', 'Pooja Reddy', 'Amit Shah', 'Kavita Menon', 'Rahul Gupta',
];

async function upsertDepartments() {
  const { created, total } = await ensureDepartmentCatalog();
  console.log(`Department catalog: ${total} departments (${created} newly created).`);
}

async function upsertWards() {
  for (const ward of DEMO_WARDS) {
    await pool.query(
      `INSERT INTO wards (ward_code, ward_name, is_demo)
       VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE ward_name = VALUES(ward_name)`,
      [ward.ward_code, ward.ward_name]
    );
  }
  console.log(`Seeded ${DEMO_WARDS.length} demo wards.`);
}

async function upsertUser({ name, email, phone, role, departmentCode, wardCode }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let departmentId = null;
  if (departmentCode) {
    const [rows] = await pool.query('SELECT id FROM departments WHERE code = ?', [departmentCode]);
    departmentId = rows[0]?.id ?? null;
  }
  let wardId = null;
  if (wardCode) {
    const [rows] = await pool.query('SELECT id FROM wards WHERE ward_code = ?', [wardCode]);
    wardId = rows[0]?.id ?? null;
  }
  const [existing] = await pool.query('SELECT id, ward_id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    // Re-seeding refreshes the demo identity but keeps an admin's ward choice and active flag.
    await pool.query(
      'UPDATE users SET name = ?, phone = ?, role = ?, department_id = ?, ward_id = COALESCE(ward_id, ?) WHERE email = ?',
      [name, phone, role, departmentId, wardId, email]
    );
    return existing[0].id;
  }
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role, department_id, ward_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, phone, role, departmentId, wardId]
  );
  return result.insertId;
}

async function seedUsers() {
  await upsertUser({
    name: 'System Admin',
    email: 'admin@civicconnect.demo',
    phone: '9800000000',
    role: 'ADMIN',
    departmentCode: null,
  });

  for (let i = 0; i < DEPARTMENTS_SEED.length; i += 1) {
    const dept = DEPARTMENTS_SEED[i];
    await upsertUser({
      name: `${dept.name} Officer`,
      email: LEGACY_OFFICER_EMAILS[dept.code] || `officer.${dept.code.toLowerCase()}@civicconnect.demo`,
      phone: '9800000001',
      role: 'OFFICER',
      departmentCode: dept.code,
      wardCode: DEMO_WARDS[i % DEMO_WARDS.length].ward_code,
    });
  }

  for (let i = 0; i < CITIZEN_NAMES.length; i += 1) {
    const name = CITIZEN_NAMES[i];
    const emailSlug = name.toLowerCase().replace(/\s+/g, '.');
    await upsertUser({
      name,
      email: `${emailSlug}@example.demo`,
      phone: `98${String(10000000 + i).slice(0, 8)}`,
      role: 'CITIZEN',
      departmentCode: null,
    });
  }

  console.log(`Seeded 1 admin, ${DEPARTMENTS_SEED.length} officers, ${CITIZEN_NAMES.length} citizens.`);
  console.log(`All demo accounts use password: ${DEMO_PASSWORD}`);
}

async function run() {
  console.log('Seeding departments, wards and users...');
  await upsertDepartments();
  await upsertWards();
  await seedUsers();
  console.log('Base seed complete. Run "npm run seed:complaints" after Phase 6 for demo complaint data.');
  await pool.end();
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
