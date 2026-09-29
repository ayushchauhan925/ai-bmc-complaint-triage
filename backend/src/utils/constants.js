// Central configuration for categories, department routing, priority scoring and SLA.
// Keeping this in one place avoids hard-coded mappings scattered across the app (rule #11).

const CATEGORIES = [
  'POTHOLE',
  'ROAD_DAMAGE',
  'GARBAGE',
  'WASTE_COLLECTION',
  'WATER_LEAKAGE',
  'WATER_SUPPLY',
  'DRAINAGE',
  'SEWERAGE',
  'STREETLIGHT',
  'TRAFFIC_SIGNAL',
  'ROAD_SIGNAGE',
  'FOOTPATH_DAMAGE',
  'ENCROACHMENT',
  'PUBLIC_TOILET',
  'SANITATION',
  'DEAD_ANIMAL',
  'TREE_HAZARD',
  'FLOODING',
  'ILLEGAL_DUMPING',
  'OTHER',
];

// Base severity tier per category. Drives the "base category severity" component of the
// priority score (Section 9). CRITICAL/HIGH/MEDIUM/LOW map to +40/+30/+20/+10.
const CATEGORY_BASE_SEVERITY = {
  POTHOLE: 'HIGH',
  ROAD_DAMAGE: 'HIGH',
  GARBAGE: 'MEDIUM',
  WASTE_COLLECTION: 'MEDIUM',
  WATER_LEAKAGE: 'HIGH',
  WATER_SUPPLY: 'HIGH',
  DRAINAGE: 'HIGH',
  SEWERAGE: 'CRITICAL',
  STREETLIGHT: 'MEDIUM',
  TRAFFIC_SIGNAL: 'CRITICAL',
  ROAD_SIGNAGE: 'LOW',
  FOOTPATH_DAMAGE: 'MEDIUM',
  ENCROACHMENT: 'LOW',
  PUBLIC_TOILET: 'MEDIUM',
  SANITATION: 'HIGH',
  DEAD_ANIMAL: 'HIGH',
  TREE_HAZARD: 'CRITICAL',
  FLOODING: 'CRITICAL',
  ILLEGAL_DUMPING: 'MEDIUM',
  OTHER: 'LOW',
};

const BASE_SEVERITY_SCORE = {
  CRITICAL: 40,
  HIGH: 30,
  MEDIUM: 20,
  LOW: 10,
};

// Department codes. Actual department rows live in MySQL (`departments` table, seeded from
// this list) so admin can rename/describe them without code changes; routing keys stay fixed.
const DEPARTMENT_CODES = {
  ROADS: 'ROADS',
  SOLID_WASTE: 'SOLID_WASTE',
  WATER: 'WATER',
  DRAINAGE: 'DRAINAGE',
  ELECTRICAL: 'ELECTRICAL',
  TRAFFIC: 'TRAFFIC',
  GARDENS: 'GARDENS',
  SANITATION: 'SANITATION',
  ENCROACHMENT: 'ENCROACHMENT',
  GENERAL: 'GENERAL',
};

const DEPARTMENTS_SEED = [
  { code: 'ROADS', name: 'Roads Department', description: 'Road surface, potholes, footpaths' },
  { code: 'SOLID_WASTE', name: 'Solid Waste Management', description: 'Garbage collection and disposal' },
  { code: 'WATER', name: 'Water Supply Department', description: 'Water supply and leakage' },
  { code: 'DRAINAGE', name: 'Drainage & Sewerage', description: 'Storm drains and sewerage' },
  { code: 'ELECTRICAL', name: 'Electrical Department', description: 'Streetlights and public lighting' },
  { code: 'TRAFFIC', name: 'Traffic Department', description: 'Traffic signals and road signage' },
  { code: 'GARDENS', name: 'Gardens & Tree Department', description: 'Trees and green spaces' },
  { code: 'SANITATION', name: 'Public Health & Sanitation', description: 'Public toilets, sanitation, dead animals' },
  { code: 'ENCROACHMENT', name: 'Encroachment Removal', description: 'Illegal encroachment on public land' },
  { code: 'GENERAL', name: 'General Administration', description: 'Uncategorized / miscellaneous complaints' },
];

// Deterministic category -> department routing (Section 10). AI never decides this.
const CATEGORY_TO_DEPARTMENT = {
  POTHOLE: DEPARTMENT_CODES.ROADS,
  ROAD_DAMAGE: DEPARTMENT_CODES.ROADS,
  FOOTPATH_DAMAGE: DEPARTMENT_CODES.ROADS,
  ROAD_SIGNAGE: DEPARTMENT_CODES.TRAFFIC,
  GARBAGE: DEPARTMENT_CODES.SOLID_WASTE,
  WASTE_COLLECTION: DEPARTMENT_CODES.SOLID_WASTE,
  ILLEGAL_DUMPING: DEPARTMENT_CODES.SOLID_WASTE,
  WATER_LEAKAGE: DEPARTMENT_CODES.WATER,
  WATER_SUPPLY: DEPARTMENT_CODES.WATER,
  DRAINAGE: DEPARTMENT_CODES.DRAINAGE,
  SEWERAGE: DEPARTMENT_CODES.DRAINAGE,
  FLOODING: DEPARTMENT_CODES.DRAINAGE,
  STREETLIGHT: DEPARTMENT_CODES.ELECTRICAL,
  TRAFFIC_SIGNAL: DEPARTMENT_CODES.TRAFFIC,
  ENCROACHMENT: DEPARTMENT_CODES.ENCROACHMENT,
  PUBLIC_TOILET: DEPARTMENT_CODES.SANITATION,
  SANITATION: DEPARTMENT_CODES.SANITATION,
  DEAD_ANIMAL: DEPARTMENT_CODES.SANITATION,
  TREE_HAZARD: DEPARTMENT_CODES.GARDENS,
  OTHER: DEPARTMENT_CODES.GENERAL,
};

// Priority scoring weights (Section 9). Configurable in one place.
const PRIORITY_WEIGHTS = {
  signals: {
    traffic_hazard: 20,
    near_school: 15,
    near_hospital: 15,
    near_public_place: 5,
    injury_reported: 30,
    emergency_access_blocked: 30,
    water_accumulation: 10,
    public_health_risk: 20,
    environmental_risk: 10,
    multiple_people_affected: 10,
    large_damage: 10,
  },
  duplicates: [
    { min: 1, max: 2, score: 5 },
    { min: 3, max: 5, score: 10 },
    { min: 6, max: 10, score: 15 },
    { min: 11, max: Infinity, score: 20 },
  ],
  // Complaint age nudges urgency upward the longer it sits unresolved/unassigned.
  age: [
    { hoursMin: 0, hoursMax: 24, score: 0 },
    { hoursMin: 24, hoursMax: 72, score: 3 },
    { hoursMin: 72, hoursMax: 168, score: 6 },
    { hoursMin: 168, hoursMax: Infinity, score: 10 },
  ],
  maxScore: 100,
};

const PRIORITY_LEVEL_THRESHOLDS = [
  { min: 80, max: 100, level: 'CRITICAL' },
  { min: 60, max: 79, level: 'HIGH' },
  { min: 40, max: 59, level: 'MEDIUM' },
  { min: 0, max: 39, level: 'LOW' },
];

// SLA hours by priority level (Section 19). Demo/application rules, not official BMC SLAs.
const SLA_HOURS_BY_PRIORITY = {
  CRITICAL: 12,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

const SLA_APPROACHING_THRESHOLD_PCT = 0.8; // >=80% of SLA window elapsed => APPROACHING

const COMPLAINT_STATUS = {
  SUBMITTED: 'SUBMITTED',
  AI_ANALYZED: 'AI_ANALYZED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLUTION_SUBMITTED: 'RESOLUTION_SUBMITTED',
  RESOLVED: 'RESOLVED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REJECTED: 'REJECTED',
  REOPENED: 'REOPENED',
};

const SLA_STATUS = {
  ON_TRACK: 'ON_TRACK',
  APPROACHING: 'APPROACHING',
  BREACHED: 'BREACHED',
  COMPLETED_WITHIN_SLA: 'COMPLETED_WITHIN_SLA',
  COMPLETED_AFTER_SLA: 'COMPLETED_AFTER_SLA',
};

const ROLES = {
  CITIZEN: 'CITIZEN',
  OFFICER: 'OFFICER',
  ADMIN: 'ADMIN',
};

// Duplicate/incident-grouping tuning (Section 11-12). Practical hackathon defaults.
const DUPLICATE_DETECTION = {
  searchRadiusMeters: 300,
  timeWindowHours: 168, // 7 days
  semanticSimilarityThreshold: 0.82,
  combinedScoreThreshold: 0.7,
  // Stored embeddings are computed from "AI summary + description" (post-analysis), but a
  // pre-submission draft (Section 16) has no summary yet, so raw-draft-vs-enriched-embedding
  // similarity runs systematically lower for the same real-world match. Calibrated separately.
  preSubmission: {
    semanticSimilarityThreshold: 0.5,
    combinedScoreThreshold: 0.45,
  },
  weights: {
    semantic: 0.55,
    distance: 0.3,
    time: 0.15,
  },
  maxCandidates: 50,
  // A complaint is grouped into an incident once at least this many related complaints are found.
  minRelatedForIncident: 1,
};

// Hotspot detection (Section 7). Deterministic geo/time/category clustering - no ML model,
// just a greedy proximity cluster over recent complaints. Practical hackathon defaults.
const HOTSPOT_DETECTION = {
  radiusMeters: 450,
  timeWindowHours: 12,
  minComplaintsForHotspot: 3,
};

// Incident severity escalation factors (Section 6). All deterministic - the LLM never sets
// this score. Distinct from the per-complaint PRIORITY_WEIGHTS: these are incident-level
// multipliers layered on top of the base priority computed for the incident's category.
const INCIDENT_ESCALATION = {
  // Bonus per point of "geographic concentration" (1 - avgDistance/radius), 0-1 scaled.
  concentrationMaxBonus: 15,
  // Bonus for how long the incident has been open, in hours -> points.
  duration: [
    { hoursMin: 0, hoursMax: 24, score: 0 },
    { hoursMin: 24, hoursMax: 72, score: 5 },
    { hoursMin: 72, hoursMax: 168, score: 10 },
    { hoursMin: 168, hoursMax: Infinity, score: 15 },
  ],
};

// SLA escalation notification thresholds (Section 14). Demo/application values, not
// official BMC SLA policy - see README.
const SLA_ESCALATION = {
  // sla_status transitions that trigger a notification + sla_escalations row.
  notifyOn: {
    APPROACHING: ['OFFICER'],
    BREACHED: ['OFFICER', 'ADMIN'],
  },
};

// Allowlisted fields/operators for the AI admin natural-language search (Section 9). The
// LLM's output is validated against this shape - anything outside it is rejected before any
// SQL is built, and no free-form SQL is ever generated by the model.
const ADMIN_SEARCH_ALLOWED_FIELDS = {
  category: { type: 'enum', values: CATEGORIES },
  status: { type: 'enum[]', values: null }, // validated against COMPLAINT_STATUS at runtime
  priority_level: { type: 'enum[]', values: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
  department_code: { type: 'enum', values: null }, // validated against live departments
  ward_code: { type: 'enum', values: null }, // validated against live wards
  sla_status: { type: 'enum[]', values: ['ON_TRACK', 'APPROACHING', 'BREACHED', 'COMPLETED_WITHIN_SLA', 'COMPLETED_AFTER_SLA'] },
  near_school: { type: 'boolean' },
  near_hospital: { type: 'boolean' },
  min_related_count: { type: 'number' },
  date_from: { type: 'date' },
  date_to: { type: 'date' },
  review_required: { type: 'boolean' },
  limit: { type: 'number' },
};

module.exports = {
  CATEGORIES,
  CATEGORY_BASE_SEVERITY,
  BASE_SEVERITY_SCORE,
  DEPARTMENT_CODES,
  DEPARTMENTS_SEED,
  CATEGORY_TO_DEPARTMENT,
  PRIORITY_WEIGHTS,
  PRIORITY_LEVEL_THRESHOLDS,
  SLA_HOURS_BY_PRIORITY,
  SLA_APPROACHING_THRESHOLD_PCT,
  COMPLAINT_STATUS,
  SLA_STATUS,
  ROLES,
  DUPLICATE_DETECTION,
  HOTSPOT_DETECTION,
  INCIDENT_ESCALATION,
  SLA_ESCALATION,
  ADMIN_SEARCH_ALLOWED_FIELDS,
};
