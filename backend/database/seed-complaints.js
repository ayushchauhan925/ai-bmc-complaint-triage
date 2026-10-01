/* eslint-disable no-console */
// Generates realistic demo complaint data: multiple categories, priorities, statuses,
// a handful of incidents (grouped duplicates), SLA breaches, and resolved+feedback records.
// This is clearly synthetic demo data (Section 40) - it does not call OpenAI repeatedly;
// it uses the same deterministic priority/routing/SLA services the live app uses so the
// numbers stay internally consistent, and only skips the live AI text/image call itself.
require('dotenv').config();
const { pool } = require('../src/config/db');
const priorityService = require('../src/services/complaint/priority.service');
const slaService = require('../src/services/complaint/sla.service');
const { CATEGORY_TO_DEPARTMENT } = require('../src/utils/constants');

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function daysAgo(days, extraHours = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - extraHours * 60 * 60 * 1000);
}

const DESCRIPTION_TEMPLATES = {
  POTHOLE: [
    'Large pothole outside the school gate, bikes keep skidding.',
    'School ke bahar bahut bada gaddha hai, baarish mein pani bhar jata hai.',
    'रस्त्यावर मोठा खड्डा आहे, वाहनांना त्रास होतो आहे.',
  ],
  ROAD_DAMAGE: [
    'Road surface has completely broken down near the junction.',
    'Sadak bohot kharab ho gayi hai, gaadi chalana mushkil hai.',
  ],
  GARBAGE: [
    'Garbage has not been collected for over a week, foul smell in the area.',
    'Kachra kai dino se nahi uthaya gaya, bahut badbu aa rahi hai.',
    'कचरा बरेच दिवस उचलला नाही, दुर्गंधी येत आहे.',
  ],
  WASTE_COLLECTION: [
    'Waste collection truck has skipped our street for several days.',
    'Kachra gaadi hamare gali mein kai din se nahi aayi.',
  ],
  WATER_LEAKAGE: [
    'Major water pipe leakage flooding the street, lots of water being wasted.',
    'Pani ki pipeline leak ho rahi hai, sadak par pani bhar gaya hai.',
  ],
  WATER_SUPPLY: [
    'No water supply in our building for three days now.',
    'Teen din se paani ki supply nahi aa rahi hai.',
  ],
  DRAINAGE: [
    'Storm drain is completely blocked, water not draining after rain.',
    'नाला तुंबला आहे, पावसाचे पाणी वाहून जात नाही.',
  ],
  SEWERAGE: [
    'Sewer line overflow near residential block, unhygienic conditions.',
    'Sewer ka pani sadak par aa raha hai, bahut ganda smell hai.',
  ],
  STREETLIGHT: [
    'Streetlight has been off for two weeks, the lane is very dark at night.',
    'Streetlight kaam nahi kar raha, raat ko bahut andhera rehta hai.',
  ],
  TRAFFIC_SIGNAL: [
    'Traffic signal at the main junction is not working, causing chaos.',
    'Traffic signal band pada hai, bahut jaam lag raha hai.',
  ],
  ROAD_SIGNAGE: ['Road sign is missing at a blind turn, risk of accidents.'],
  FOOTPATH_DAMAGE: ['Footpath tiles are broken, difficult for pedestrians to walk.'],
  ENCROACHMENT: ['Illegal stall has encroached on the public footpath.'],
  PUBLIC_TOILET: ['Public toilet is in extremely unhygienic condition, needs cleaning.'],
  SANITATION: ['Open drain near the market is causing sanitation issues.'],
  DEAD_ANIMAL: ['A dead animal has been lying on the roadside for two days.'],
  TREE_HAZARD: ['A large tree branch is hanging dangerously over the road after the storm.'],
  FLOODING: ['Street is flooded ankle-deep after even light rain.'],
  ILLEGAL_DUMPING: ['Construction debris has been illegally dumped on the empty plot.'],
  OTHER: ['General civic issue reported by citizen, needs assessment.'],
};

const SIGNAL_POOL = [
  'traffic_hazard',
  'near_school',
  'water_accumulation',
  'large_damage',
  'multiple_people_affected',
  'public_health_risk',
  'environmental_risk',
];

function randomSeveritySignals(category) {
  const signals = {};
  const count = Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    signals[randomChoice(SIGNAL_POOL)] = true;
  }
  if (['POTHOLE', 'ROAD_DAMAGE', 'TRAFFIC_SIGNAL'].includes(category)) {
    signals.traffic_hazard = Math.random() > 0.4;
  }
  if (['DRAINAGE', 'FLOODING', 'SEWERAGE'].includes(category)) {
    signals.water_accumulation = Math.random() > 0.3;
  }
  return signals;
}

const HOTSPOTS = [
  { category: 'POTHOLE', count: 7, lat: 19.076, lng: 72.878, address: 'Near ABC School, Demo Ward' },
  { category: 'GARBAGE', count: 4, lat: 19.101, lng: 72.834, address: 'Sector 5 Market, Demo Ward' },
  { category: 'STREETLIGHT', count: 3, lat: 19.05, lng: 72.9, address: 'MG Road, Demo Ward' },
  { category: 'WATER_LEAKAGE', count: 12, lat: 19.12, lng: 72.86, address: 'Colony Road, Demo Ward' },
  { category: 'DRAINAGE', count: 2, lat: 19.03, lng: 72.85, address: 'Riverside Lane, Demo Ward' },
];

const STANDALONE_COUNT = 26;
const ALL_CATEGORIES = Object.keys(DESCRIPTION_TEMPLATES);

async function getReferenceData() {
  const [[citizens], [officers], [departments], [wards]] = await Promise.all([
    pool.query("SELECT id FROM users WHERE role = 'CITIZEN'"),
    pool.query("SELECT id, department_id FROM users WHERE role = 'OFFICER'"),
    pool.query('SELECT id, code FROM departments'),
    pool.query('SELECT id FROM wards'),
  ]);
  return { citizens, officers, departments, wards };
}

function pickStatus() {
  const roll = Math.random();
  if (roll < 0.08) return 'SUBMITTED';
  if (roll < 0.14) return 'AI_ANALYZED';
  if (roll < 0.42) return 'ASSIGNED';
  if (roll < 0.62) return 'IN_PROGRESS';
  if (roll < 0.68) return 'RESOLUTION_SUBMITTED';
  if (roll < 0.94) return 'RESOLVED';
  return 'NEEDS_REVIEW';
}

async function insertComplaint({ ref, category, latitude, longitude, address, relatedCount, forceBreach }) {
  const description = randomChoice(DESCRIPTION_TEMPLATES[category]);
  const severitySignals = randomSeveritySignals(category);
  const citizen = randomChoice(ref.citizens);
  const ward = ref.wards.length ? randomChoice(ref.wards) : null;
  const deptCode = CATEGORY_TO_DEPARTMENT[category] || 'GENERAL_CIVIC';
  const department = ref.departments.find((d) => d.code === deptCode);
  const status = pickStatus();

  const ageDays = Math.floor(randomFloat(0, 20));
  const createdAt = daysAgo(ageDays, randomFloat(0, 23));

  const priority = priorityService.calculatePriority({
    category,
    severitySignals,
    relatedComplaintCount: relatedCount,
    createdAt,
  });

  const slaDeadline = slaService.calculateSlaDeadline(priority.level, createdAt);
  let resolvedAt = null;
  let slaStatus = 'ON_TRACK';
  let officerId = null;

  const isActive = !['SUBMITTED'].includes(status);
  const isAssignedOrLater = ['ASSIGNED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED', 'RESOLVED'].includes(status);

  if (isAssignedOrLater && department) {
    const deptOfficers = ref.officers.filter((o) => o.department_id === department.id);
    if (deptOfficers.length) officerId = randomChoice(deptOfficers).id;
  }

  if (status === 'RESOLVED') {
    const resolutionDelayHours = forceBreach
      ? randomFloat(1, 5) * 24 // resolved late, past SLA
      : randomFloat(0.5, 0.9) * ((slaDeadline - createdAt) / (60 * 60 * 1000));
    resolvedAt = new Date(createdAt.getTime() + resolutionDelayHours * 60 * 60 * 1000);
    slaStatus = resolvedAt.getTime() <= slaDeadline.getTime() ? 'COMPLETED_WITHIN_SLA' : 'COMPLETED_AFTER_SLA';
  } else if (forceBreach || (isActive && slaDeadline.getTime() < Date.now())) {
    slaStatus = 'BREACHED';
  } else if (isActive) {
    const windowMs = slaDeadline.getTime() - createdAt.getTime();
    const elapsed = Date.now() - createdAt.getTime();
    slaStatus = elapsed / windowMs >= 0.8 ? 'APPROACHING' : 'ON_TRACK';
  }

  const reviewRequired = status === 'NEEDS_REVIEW' || Math.random() < 0.05;

  const [result] = await pool.query(
    `INSERT INTO complaints (
       complaint_number, user_id, description, category, subcategory, language, ai_summary, ai_confidence,
       severity_signals, image_verified, review_required, review_reason, priority_score, priority_level,
       priority_reasons, department_id, officer_id, ward_id, latitude, longitude, address, status,
       sla_deadline, sla_status, created_at, updated_at, resolved_at
     ) VALUES (?, ?, ?, ?, NULL, 'ENGLISH', ?, 0.85, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `CMP-SEED-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      citizen.id,
      description,
      category,
      description,
      JSON.stringify(severitySignals),
      reviewRequired,
      reviewRequired ? 'Flagged during demo data generation for reviewer training.' : null,
      priority.score,
      priority.level,
      JSON.stringify(priority.reasons),
      department ? department.id : null,
      officerId,
      ward ? ward.id : null,
      latitude,
      longitude,
      address,
      status,
      slaDeadline,
      slaStatus,
      createdAt,
      resolvedAt || createdAt,
      resolvedAt,
    ]
  );

  const complaintId = result.insertId;
  await pool.query(
    'INSERT INTO complaint_status_history (complaint_id, old_status, new_status, notes, created_at) VALUES (?, NULL, ?, ?, ?)',
    [complaintId, status, 'Seed data generated for demo.', createdAt]
  );

  if (status === 'RESOLVED' && Math.random() < 0.7) {
    const resolved = Math.random() < 0.85;
    await pool.query(
      'INSERT INTO feedback (complaint_id, user_id, rating, resolved, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        complaintId,
        citizen.id,
        resolved ? Math.ceil(randomFloat(3, 5)) : Math.ceil(randomFloat(1, 3)),
        resolved,
        resolved ? 'Thanks, issue was fixed promptly.' : 'Issue still not fully resolved.',
        resolvedAt,
      ]
    );
  }

  return complaintId;
}

async function createIncidentForGroup(hotspot, complaintIds, department) {
  const [result] = await pool.query(
    `INSERT INTO incidents (incident_number, title, category, latitude, longitude, department_id, priority_score, priority_level, status, complaint_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
    [
      `INC-SEED-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      `${hotspot.category.replace(/_/g, ' ')} - ${hotspot.address}`,
      hotspot.category,
      hotspot.lat,
      hotspot.lng,
      department ? department.id : null,
      0,
      'LOW',
      complaintIds.length,
    ]
  );
  const incidentId = result.insertId;

  for (const complaintId of complaintIds) {
    await pool.query('INSERT IGNORE INTO incident_complaints (incident_id, complaint_id) VALUES (?, ?)', [
      incidentId,
      complaintId,
    ]);
    await pool.query('UPDATE complaints SET incident_id = ? WHERE id = ?', [incidentId, complaintId]);
  }

  const priority = priorityService.calculatePriority({
    category: hotspot.category,
    severitySignals: { traffic_hazard: true, water_accumulation: true },
    relatedComplaintCount: complaintIds.length,
    createdAt: daysAgo(5),
  });
  await pool.query('UPDATE incidents SET priority_score = ?, priority_level = ? WHERE id = ?', [
    priority.score,
    priority.level,
    incidentId,
  ]);

  return incidentId;
}

async function run() {
  const ref = await getReferenceData();
  if (ref.citizens.length === 0) {
    console.error('No citizen users found. Run "npm run seed" first.');
    process.exit(1);
  }

  console.log('Generating hotspot/incident complaint groups...');
  for (const hotspot of HOTSPOTS) {
    const complaintIds = [];
    for (let i = 0; i < hotspot.count; i += 1) {
      const jitterLat = hotspot.lat + randomFloat(-0.0015, 0.0015);
      const jitterLng = hotspot.lng + randomFloat(-0.0015, 0.0015);
      const forceBreach = i === 0; // ensure at least one breach per hotspot for demo variety
      const id = await insertComplaint({
        ref,
        category: hotspot.category,
        latitude: jitterLat,
        longitude: jitterLng,
        address: hotspot.address,
        relatedCount: hotspot.count - 1,
        forceBreach,
      });
      complaintIds.push(id);
    }
    const deptCode = CATEGORY_TO_DEPARTMENT[hotspot.category] || 'GENERAL_CIVIC';
    const department = ref.departments.find((d) => d.code === deptCode);
    const incidentId = await createIncidentForGroup(hotspot, complaintIds, department);
    console.log(`  Incident created (id=${incidentId}) grouping ${complaintIds.length} ${hotspot.category} complaints.`);
  }

  console.log(`Generating ${STANDALONE_COUNT} standalone complaints...`);
  for (let i = 0; i < STANDALONE_COUNT; i += 1) {
    const category = randomChoice(ALL_CATEGORIES);
    const latitude = randomFloat(19.0, 19.15);
    const longitude = randomFloat(72.8, 72.95);
    await insertComplaint({
      ref,
      category,
      latitude,
      longitude,
      address: 'Demo Ward area',
      relatedCount: 0,
      forceBreach: Math.random() < 0.08,
    });
  }

  console.log('Demo complaint data generation complete.');
  await pool.end();
}

run().catch((err) => {
  console.error('Seeding complaints failed:', err);
  process.exit(1);
});
