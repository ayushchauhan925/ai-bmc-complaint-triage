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
  'BUILDING_COLLAPSE',
  'DANGEROUS_BUILDING',
  'STRAY_ANIMAL',
  'PARK_DAMAGE',
  'DAMAGED_PUBLIC_INFRASTRUCTURE',
  'POLLUTION',
  'MAJOR_FIRE',
  'NATURAL_DISASTER',
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
  BUILDING_COLLAPSE: 'CRITICAL',
  DANGEROUS_BUILDING: 'HIGH',
  STRAY_ANIMAL: 'MEDIUM',
  PARK_DAMAGE: 'LOW',
  DAMAGED_PUBLIC_INFRASTRUCTURE: 'MEDIUM',
  POLLUTION: 'MEDIUM',
  MAJOR_FIRE: 'CRITICAL',
  NATURAL_DISASTER: 'CRITICAL',
  OTHER: 'LOW',
};

const BASE_SEVERITY_SCORE = {
  CRITICAL: 40,
  HIGH: 30,
  MEDIUM: 20,
  LOW: 10,
};

// Departments, their categories and category -> department routing live in ONE place:
// utils/departmentCatalog.js (a configurable PROJECT DEMO catalog, not official BMC data). The rows
// themselves live in MySQL (departments table) and are created/synced from the catalog at startup
// (services/department/catalog.service.js), so names/contacts/active flags can be managed by admins.
const departmentCatalog = require('./departmentCatalog');

const DEPARTMENT_CODES = departmentCatalog.DEPARTMENT_CODES;
const DEPARTMENTS_SEED = departmentCatalog.DEPARTMENT_CATALOG.map(({ code, name, description }) => ({ code, name, description }));
// Includes alias codes (e.g. BLOCKED_DRAIN) as well as the canonical categories.
const CATEGORY_TO_DEPARTMENT = departmentCatalog.CATEGORY_TO_DEPARTMENT;

const catalogProblems = departmentCatalog.validateCatalog(CATEGORIES);
if (catalogProblems.length > 0) {
  throw new Error(`Invalid department catalog: ${catalogProblems.join('; ')}`);
}

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
  // Minimum calibrated duplicate probability (and compatible category) to join an incident.
  linkProbability: 0.6,
  // Lexical-only evidence (no embedding / photo) says the wording matches, not that it is the
  // same physical spot - so it must also be very close by to count as the same issue.
  textOnlyMaxDistanceMeters: 150,
  // Photos whose perceptual-hash similarity is at least this are treated as the same picture.
  imageDuplicateSimilarity: 0.9,
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


// Evidence intelligence (deterministic 0-100 score; see services/decision/evidence.service.js).
const EVIDENCE = {
  weights: {
    text: 15,
    location: 15,
    imageAvailable: 10,
    imageQuality: 10,
    imageSupports: 10,
    aiConfidence: 15,
    corroboration: 15,
    history: 5,
    temporal: 5,
  },
  penalties: { manipulated: 15, irrelevantImage: 10, injection: 10 },
  bands: { strong: 75, moderate: 50, weak: 30 },
  // Laplacian variance below this on a downscaled greyscale copy is treated as blurry.
  blurThreshold: 60,
  recentCorroborationHours: 72,
};

// Hybrid decision engine (services/decision/decisionEngine.service.js). Every adjustment is
// bounded and emitted as a named decision factor; the LLM only supplies inputs.
const DECISION_ENGINE = {
  version: '2.0',
  riskIndicatorPoints: {
    INJURY_RISK: 8,
    ELECTRICAL_HAZARD: 8,
    FIRE_RISK: 8,
    STRUCTURAL_RISK: 8,
    VULNERABLE_GROUPS_AFFECTED: 5,
  },
  riskIndicatorCap: 10,
  repeatLocation: { points: 8, radiusMeters: 150, days: 60 },
  evidenceAdjustment: { STRONG: 4, INSUFFICIENT: -5 },
  // Hard safety floors: these signals guarantee at least this level regardless of score.
  safetyFloors: [
    { signal: 'injury_reported', level: 'HIGH', label: 'Injury reported' },
    { signal: 'emergency_access_blocked', level: 'HIGH', label: 'Emergency access blocked' },
  ],
  lowConfidenceReview: 0.4,
  otherCategoryReviewConfidence: 0.6,
  immediateUrgencyMinConfidence: 0.6,
};

// Statistical anomaly detection (services/analytics/anomaly.service.js).
const ANOMALY = {
  bucketHours: 24,
  baselineDays: 28,
  minBaselineDays: 7,
  scoreThreshold: 3, // robust z-score
  minObserved: 5, // ignore tiny absolute counts
  minRatio: 1.5, // must also be at least 1.5x the baseline mean
};

// Short-term forecasting (services/analytics/forecast.service.js).
const FORECAST = {
  historyDays: 60,
  minHistoryDays: 14,
  minActiveDays: 5,
  horizonDays: 7,
  alpha: 0.4,
  beta: 0.15,
  intervalZ: 1.28, // ~80% prediction interval
};

// Rule-based escalation engine (services/complaint/escalationEngine.service.js).
const ESCALATION_RULES = {
  // Critical/High complaints still not assigned to an officer after this many hours.
  unassignedHours: { CRITICAL: 2, HIGH: 8 },
  // Same category reported again at (roughly) the same place after an earlier one was resolved.
  repeat: { minReports: 3, days: 30, radiusMeters: 150 },
  majorIncident: { minComplaints: 5 },
  surgeMinScore: 4,
};

// Hotspot v2 (region growing over complaints; see hotspot.service.js detectHotspotsAdvanced).
const HOTSPOT_V2 = {
  radiusMeters: 350,
  minComplaints: 3,
  defaultDays: 14,
  severityWeight: { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 },
  recentHours: 48,
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
  EVIDENCE,
  DECISION_ENGINE,
  ANOMALY,
  FORECAST,
  ESCALATION_RULES,
  HOTSPOT_V2,
  ADMIN_SEARCH_ALLOWED_FIELDS,
};
