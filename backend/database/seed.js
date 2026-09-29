/* eslint-disable no-console */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { DEPARTMENTS_SEED } = require('../src/utils/constants');

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
  for (const dept of DEPARTMENTS_SEED) {
    await pool.query(
      `INSERT INTO departments (code, name, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [dept.code, dept.name, dept.description]
    );
  }
  console.log(`Seeded ${DEPARTMENTS_SEED.length} departments.`);
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

async function upsertUser({ name, email, phone, role, departmentCode }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let departmentId = null;
  if (departmentCode) {
    const [rows] = await pool.query('SELECT id FROM departments WHERE code = ?', [departmentCode]);
    departmentId = rows[0]?.id ?? null;
  }
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    await pool.query(
      'UPDATE users SET name = ?, phone = ?, role = ?, department_id = ? WHERE email = ?',
      [name, phone, role, departmentId, email]
    );
    return existing[0].id;
  }
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role, department_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, phone, role, departmentId]
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

  for (const dept of DEPARTMENTS_SEED) {
    await upsertUser({
      name: `${dept.name} Officer`,
      email: `officer.${dept.code.toLowerCase()}@civicconnect.demo`,
      phone: '9800000001',
      role: 'OFFICER',
      departmentCode: dept.code,
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
