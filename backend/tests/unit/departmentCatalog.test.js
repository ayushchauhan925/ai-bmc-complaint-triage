const {
  DEPARTMENT_CATALOG,
  CATEGORY_TO_DEPARTMENT,
  FALLBACK_DEPARTMENT_CODE,
  primaryDepartmentCode,
  secondaryDepartmentCodes,
  categoriesForDepartment,
  validateCatalog,
} = require('../../src/utils/departmentCatalog');
const { CATEGORIES, CATEGORY_BASE_SEVERITY, DEPARTMENTS_SEED } = require('../../src/utils/constants');

const EXPECTED_CODES = [
  'ROADS', 'SOLID_WASTE', 'WATER', 'DRAINAGE', 'SEWERAGE', 'ELECTRICAL', 'TRAFFIC', 'GARDENS', 'PUBLIC_HEALTH',
  'ENCROACHMENT', 'ANIMAL_MANAGEMENT', 'EMERGENCY_RESPONSE', 'BUILDINGS', 'PUBLIC_INFRASTRUCTURE', 'PARKS',
  'CIVIC_AMENITIES', 'FLOOD_MANAGEMENT', 'ENVIRONMENT', 'DISASTER_MANAGEMENT', 'GENERAL_CIVIC',
];

describe('department catalog integrity', () => {
  test('has exactly the 20 specified departments with stable, unique codes', () => {
    expect(DEPARTMENT_CATALOG.map((d) => d.code)).toEqual(EXPECTED_CODES);
    expect(new Set(EXPECTED_CODES).size).toBe(20);
    expect(DEPARTMENTS_SEED).toHaveLength(20);
  });

  test('passes its own validation against the canonical categories', () => {
    expect(validateCatalog(CATEGORIES)).toEqual([]);
  });

  test('EVERY supported complaint category has a routing destination', () => {
    for (const category of CATEGORIES) {
      const code = CATEGORY_TO_DEPARTMENT[category];
      expect(EXPECTED_CODES).toContain(code);
    }
  });

  test('every canonical category has a base severity tier (so priority scoring never silently defaults)', () => {
    for (const category of CATEGORIES) expect(CATEGORY_BASE_SEVERITY[category]).toBeDefined();
  });

  test('every department handles at least one category and has a name and description', () => {
    for (const d of DEPARTMENT_CATALOG) {
      expect(d.name.length).toBeGreaterThan(3);
      expect(d.description.length).toBeGreaterThan(3);
      expect(d.categories.length).toBeGreaterThan(0);
      expect(categoriesForDepartment(d.code).length).toBeGreaterThan(0);
    }
  });

  test('the catalog from the specification routes as documented', () => {
    const expected = {
      POTHOLE: 'ROADS', ROAD_COLLAPSE: 'ROADS', GARBAGE: 'SOLID_WASTE', PUBLIC_WASTE: 'SOLID_WASTE',
      WATER_LEAKAGE: 'WATER', CONTAMINATED_WATER: 'WATER', DRAINAGE: 'DRAINAGE', WATERLOGGING: 'DRAINAGE',
      SEWERAGE: 'SEWERAGE', SEWER_BLOCKAGE: 'SEWERAGE', STREETLIGHT: 'ELECTRICAL', EXPOSED_ELECTRICAL_WIRING: 'ELECTRICAL',
      TRAFFIC_SIGNAL: 'TRAFFIC', SIGNAL_MALFUNCTION: 'TRAFFIC', TREE_HAZARD: 'GARDENS', FALLEN_TREE: 'GARDENS',
      SANITATION: 'PUBLIC_HEALTH', HYGIENE_ISSUE: 'PUBLIC_HEALTH', ENCROACHMENT: 'ENCROACHMENT', ROAD_ENCROACHMENT: 'ENCROACHMENT',
      DEAD_ANIMAL: 'ANIMAL_MANAGEMENT', STRAY_ANIMAL: 'ANIMAL_MANAGEMENT', BUILDING_COLLAPSE: 'EMERGENCY_RESPONSE',
      DANGEROUS_BUILDING: 'BUILDINGS', UNSAFE_STRUCTURE: 'BUILDINGS', BUS_SHELTER_DAMAGE: 'PUBLIC_INFRASTRUCTURE',
      PARK_DAMAGE: 'PARKS', PLAYGROUND_DAMAGE: 'PARKS', TOILET_MAINTENANCE: 'CIVIC_AMENITIES', SEVERE_FLOODING: 'FLOOD_MANAGEMENT',
      POLLUTION: 'ENVIRONMENT', ILLEGAL_WASTE_DISPOSAL: 'ENVIRONMENT', NATURAL_DISASTER: 'DISASTER_MANAGEMENT',
      OTHER: 'GENERAL_CIVIC', UNCLASSIFIED: 'GENERAL_CIVIC', GENERAL_CIVIC_COMPLAINT: 'GENERAL_CIVIC',
    };
    for (const [category, code] of Object.entries(expected)) expect({ category, code: primaryDepartmentCode(category) }).toEqual({ category, code });
  });

  test('categories listed under two departments resolve deterministically, keeping the other as secondary', () => {
    expect(primaryDepartmentCode('PUBLIC_TOILET')).toBe('CIVIC_AMENITIES'); // explicit override
    expect(secondaryDepartmentCodes('PUBLIC_TOILET')).toContain('PUBLIC_HEALTH');
    expect(primaryDepartmentCode('BUILDING_COLLAPSE')).toBe('EMERGENCY_RESPONSE'); // first listed wins
    expect(secondaryDepartmentCodes('BUILDING_COLLAPSE')).toContain('DISASTER_MANAGEMENT');
    expect(primaryDepartmentCode('MAJOR_ACCIDENT')).toBe('EMERGENCY_RESPONSE');
    expect(secondaryDepartmentCodes('FLOODING')).toEqual(['FLOOD_MANAGEMENT']);
    // a secondary is never also the primary
    for (const category of Object.keys(CATEGORY_TO_DEPARTMENT)) {
      expect(secondaryDepartmentCodes(category)).not.toContain(primaryDepartmentCode(category));
    }
  });

  test('unknown codes route to the fallback department', () => {
    expect(primaryDepartmentCode('NOT_A_REAL_CATEGORY')).toBe(FALLBACK_DEPARTMENT_CODE);
    expect(FALLBACK_DEPARTMENT_CODE).toBe('GENERAL_CIVIC');
  });

  test('validation actually catches a broken catalog', () => {
    expect(validateCatalog([...CATEGORIES, 'SOMETHING_UNROUTED'])).toEqual(['category without a department: SOMETHING_UNROUTED']);
  });
});
