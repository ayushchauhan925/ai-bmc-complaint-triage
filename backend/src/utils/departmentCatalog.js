/**
 * PROJECT DEMO DEPARTMENT CATALOG - the single source of truth for departments, the
 * complaint categories each one handles, and category -> department routing.
 *
 * This is a configurable, fictional model for the project. It is NOT a claim that these are the
 * current official BMC departmental names; if you adopt official names, edit them here (and the
 * `departments` rows pick them up on the next startup for any department not yet customised).
 *
 * `categories` lists every complaint code a department handles:
 *   - canonical categories (those in constants.CATEGORIES) are what the AI may choose;
 *   - the remaining codes are ALIASES (more specific or alternative labels, e.g. BLOCKED_DRAIN)
 *     that route identically. They let imported/legacy/staff-entered codes resolve to a
 *     department without bloating the AI's category enum.
 *
 * Routing is deterministic: a code listed by several departments goes to the FIRST department
 * in this array unless PRIMARY_OVERRIDES says otherwise; the other departments become
 * SECONDARY (informational) departments. The LLM never assigns a department.
 */

const DEPARTMENT_CATALOG = [
  {
    code: 'ROADS',
    name: 'Roads & Traffic Infrastructure',
    description: 'Road surface, potholes, footpaths, signage and road markings',
    categories: ['POTHOLE', 'ROAD_DAMAGE', 'ROAD_COLLAPSE', 'FOOTPATH_DAMAGE', 'ROAD_SIGNAGE', 'ROAD_MARKINGS', 'TRAFFIC_RELATED_INFRASTRUCTURE'],
  },
  {
    code: 'SOLID_WASTE',
    name: 'Solid Waste Management',
    description: 'Garbage collection, accumulation and illegal dumping',
    categories: ['GARBAGE', 'WASTE_COLLECTION', 'ILLEGAL_DUMPING', 'PUBLIC_WASTE', 'GARBAGE_ACCUMULATION'],
  },
  {
    code: 'WATER',
    name: 'Water Supply',
    description: 'Water supply, pressure, quality and pipe damage',
    categories: ['WATER_LEAKAGE', 'WATER_SUPPLY', 'LOW_WATER_PRESSURE', 'CONTAMINATED_WATER', 'WATER_PIPE_DAMAGE'],
  },
  {
    code: 'DRAINAGE',
    name: 'Storm Water Drainage',
    description: 'Storm drains, blocked drains and waterlogging',
    categories: ['DRAINAGE', 'WATERLOGGING', 'FLOODING', 'BLOCKED_DRAIN', 'STORM_WATER_ISSUES'],
  },
  {
    code: 'SEWERAGE',
    name: 'Sewerage',
    description: 'Sewer lines, blockages and sewage overflow',
    categories: ['SEWERAGE', 'SEWER_BLOCKAGE', 'SEWAGE_OVERFLOW', 'SEWER_PIPE_DAMAGE'],
  },
  {
    code: 'ELECTRICAL',
    name: 'Street Lighting & Electrical Infrastructure',
    description: 'Streetlights, dark streets and exposed public electrical wiring',
    categories: ['STREETLIGHT', 'BROKEN_STREETLIGHT', 'ELECTRICAL_INFRASTRUCTURE', 'DARK_STREET', 'EXPOSED_ELECTRICAL_WIRING'],
  },
  {
    code: 'TRAFFIC',
    name: 'Traffic Management / Signals',
    description: 'Traffic signals and traffic control devices',
    categories: ['TRAFFIC_SIGNAL', 'SIGNAL_MALFUNCTION', 'TRAFFIC_CONTROL_DEVICE', 'ROAD_TRAFFIC_INFRASTRUCTURE'],
  },
  {
    code: 'GARDENS',
    name: 'Gardens & Tree Management',
    description: 'Tree hazards, fallen trees, trimming and overgrown vegetation',
    categories: ['TREE_HAZARD', 'FALLEN_TREE', 'TREE_TRIMMING', 'OVERGROWN_VEGETATION', 'TREE_OBSTRUCTION'],
  },
  {
    code: 'PUBLIC_HEALTH',
    name: 'Public Health & Sanitation',
    description: 'Sanitation, hygiene and unsanitary conditions',
    categories: ['SANITATION', 'PUBLIC_HEALTH', 'PUBLIC_TOILET', 'HYGIENE_ISSUE', 'UNSANITARY_CONDITION'],
  },
  {
    code: 'ENCROACHMENT',
    name: 'Encroachment & Unauthorized Occupation',
    description: 'Encroachment on roads, footpaths and public land',
    categories: ['ENCROACHMENT', 'ILLEGAL_OCCUPATION', 'FOOTPATH_ENCROACHMENT', 'ROAD_ENCROACHMENT'],
  },
  {
    code: 'ANIMAL_MANAGEMENT',
    name: 'Animal Management',
    description: 'Dead and stray animals and animal-related public hazards',
    categories: ['DEAD_ANIMAL', 'STRAY_ANIMAL', 'ANIMAL_HAZARD', 'ANIMAL_RELATED_PUBLIC_ISSUE'],
  },
  {
    code: 'EMERGENCY_RESPONSE',
    name: 'Disaster / Emergency Response',
    description: 'Building collapse, major fires and accidents, major public-safety hazards',
    categories: ['BUILDING_COLLAPSE', 'MAJOR_FIRE', 'MAJOR_ACCIDENT', 'STRUCTURAL_HAZARD', 'MAJOR_PUBLIC_SAFETY_HAZARD'],
  },
  {
    code: 'BUILDINGS',
    name: 'Buildings & Structural Safety',
    description: 'Dangerous buildings and unsafe structures',
    categories: ['DANGEROUS_BUILDING', 'STRUCTURAL_DAMAGE', 'UNSAFE_STRUCTURE', 'BUILDING_HAZARD'],
  },
  {
    code: 'PUBLIC_INFRASTRUCTURE',
    name: 'Public Infrastructure',
    description: 'Damaged public facilities, bus shelters and public assets',
    categories: ['DAMAGED_PUBLIC_INFRASTRUCTURE', 'PUBLIC_FACILITY_DAMAGE', 'BUS_SHELTER_DAMAGE', 'PUBLIC_ASSET_DAMAGE'],
  },
  {
    code: 'PARKS',
    name: 'Parks & Recreation',
    description: 'Parks, playgrounds, public gardens and recreational facilities',
    categories: ['PARK_DAMAGE', 'PLAYGROUND_DAMAGE', 'PUBLIC_GARDEN_ISSUE', 'RECREATIONAL_FACILITY_DAMAGE'],
  },
  {
    code: 'CIVIC_AMENITIES',
    name: 'Public Toilets & Civic Amenities',
    description: 'Public toilets and civic amenity maintenance',
    categories: ['PUBLIC_TOILET', 'TOILET_MAINTENANCE', 'CIVIC_AMENITY_DAMAGE'],
  },
  {
    code: 'FLOOD_MANAGEMENT',
    name: 'Flood / Emergency Water Management',
    description: 'Severe flooding, major waterlogging and emergency drainage',
    categories: ['SEVERE_FLOODING', 'MAJOR_WATERLOGGING', 'EMERGENCY_DRAINAGE'],
  },
  {
    code: 'ENVIRONMENT',
    name: 'Environmental Services',
    description: 'Pollution, environmental hazards and nuisances',
    categories: ['POLLUTION', 'ENVIRONMENTAL_HAZARD', 'ILLEGAL_WASTE_DISPOSAL', 'ENVIRONMENTAL_NUISANCE'],
  },
  {
    code: 'DISASTER_MANAGEMENT',
    name: 'Disaster Management',
    description: 'Natural disasters and coordinated emergency response',
    categories: ['NATURAL_DISASTER', 'MAJOR_ACCIDENT', 'BUILDING_COLLAPSE', 'MAJOR_FIRE', 'EMERGENCY_RESPONSE'],
  },
  {
    code: 'GENERAL_CIVIC',
    name: 'General Civic Services',
    description: 'Uncategorised and general civic complaints (also the routing fallback)',
    categories: ['OTHER', 'UNCLASSIFIED', 'GENERAL_CIVIC_COMPLAINT'],
  },
];

// A code listed under several departments normally goes to the first one. These pin the
// primary where the more specific department should win.
const PRIMARY_OVERRIDES = {
  PUBLIC_TOILET: 'CIVIC_AMENITIES', // specific amenity team rather than general public health
};

// Extra informational (secondary) departments that are not simply "also listed" in the catalog.
const SECONDARY_EXTRA = {
  FLOODING: ['FLOOD_MANAGEMENT'],
  SEWERAGE: ['PUBLIC_HEALTH'],
  SEWAGE_OVERFLOW: ['PUBLIC_HEALTH'],
  DEAD_ANIMAL: ['PUBLIC_HEALTH'],
  FALLEN_TREE: ['EMERGENCY_RESPONSE'],
};

const FALLBACK_DEPARTMENT_CODE = 'GENERAL_CIVIC';

// ---- derived routing tables (computed once, deterministic) ------------------------------

const DEPARTMENT_CODES = Object.fromEntries(DEPARTMENT_CATALOG.map((d) => [d.code, d.code]));

const PRIMARY = {};
const SECONDARY = {};
for (const dept of DEPARTMENT_CATALOG) {
  for (const category of dept.categories) {
    if (!PRIMARY[category]) PRIMARY[category] = PRIMARY_OVERRIDES[category] || dept.code;
    if (PRIMARY[category] !== dept.code) {
      SECONDARY[category] = [...new Set([...(SECONDARY[category] || []), dept.code])];
    }
  }
}
for (const [category, codes] of Object.entries(SECONDARY_EXTRA)) {
  SECONDARY[category] = [...new Set([...(SECONDARY[category] || []), ...codes])].filter((c) => c !== PRIMARY[category]);
}
// An override can displace the first-listed department; keep it as a secondary.
for (const [category, primary] of Object.entries(PRIMARY_OVERRIDES)) {
  for (const dept of DEPARTMENT_CATALOG) {
    if (dept.categories.includes(category) && dept.code !== primary) {
      SECONDARY[category] = [...new Set([...(SECONDARY[category] || []), dept.code])];
    }
  }
}

/** category (canonical or alias) -> primary department code. */
const CATEGORY_TO_DEPARTMENT = { ...PRIMARY };

const primaryDepartmentCode = (category) => PRIMARY[category] || FALLBACK_DEPARTMENT_CODE;
const secondaryDepartmentCodes = (category) => SECONDARY[category] || [];

/** Categories a department is PRIMARILY responsible for (what staff see as "handles"). */
function categoriesForDepartment(code) {
  return Object.entries(PRIMARY)
    .filter(([, dept]) => dept === code)
    .map(([category]) => category);
}

/** Departments where the code is secondary (listed but not primary). */
function secondaryCategoriesForDepartment(code) {
  return Object.entries(SECONDARY)
    .filter(([, depts]) => depts.includes(code))
    .map(([category]) => category);
}

/**
 * Integrity check, run at load time and in tests: unique stable codes, every canonical
 * category routes somewhere, every routed code refers to a real department.
 */
function validateCatalog(canonicalCategories) {
  const problems = [];
  const codes = DEPARTMENT_CATALOG.map((d) => d.code);
  if (new Set(codes).size !== codes.length) problems.push('duplicate department codes');
  for (const d of DEPARTMENT_CATALOG) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(d.code)) problems.push(`unstable code format: ${d.code}`);
    if (!d.name || !d.description || d.categories.length === 0) problems.push(`incomplete department: ${d.code}`);
  }
  for (const c of canonicalCategories) if (!PRIMARY[c]) problems.push(`category without a department: ${c}`);
  for (const [c, code] of Object.entries(PRIMARY)) if (!codes.includes(code)) problems.push(`${c} routes to unknown department ${code}`);
  for (const [c, list] of Object.entries(SECONDARY)) for (const code of list) if (!codes.includes(code)) problems.push(`${c} has unknown secondary ${code}`);
  if (!codes.includes(FALLBACK_DEPARTMENT_CODE)) problems.push('fallback department missing');
  return problems;
}

module.exports = {
  DEPARTMENT_CATALOG,
  DEPARTMENT_CODES,
  CATEGORY_TO_DEPARTMENT,
  FALLBACK_DEPARTMENT_CODE,
  primaryDepartmentCode,
  secondaryDepartmentCodes,
  categoriesForDepartment,
  secondaryCategoriesForDepartment,
  validateCatalog,
};
