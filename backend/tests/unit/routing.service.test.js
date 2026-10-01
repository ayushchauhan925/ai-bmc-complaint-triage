const mockRows = {};
jest.mock('../../src/models/department.model', () => ({
  findByCode: jest.fn((code) => Promise.resolve(code in mockRows ? mockRows[code] : { id: 1, code, name: `${code} Department` })),
}));

const routingService = require('../../src/services/complaint/routing.service');
const departmentModel = require('../../src/models/department.model');

const reset = () => Object.keys(mockRows).forEach((k) => delete mockRows[k]);

describe('routing.service.routeToDepartment', () => {
  afterEach(() => {
    jest.clearAllMocks();
    reset();
  });

  test.each([
    ['POTHOLE', 'ROADS'],
    ['GARBAGE', 'SOLID_WASTE'],
    ['STREETLIGHT', 'ELECTRICAL'],
    ['SEWERAGE', 'SEWERAGE'],
    ['DRAINAGE', 'DRAINAGE'],
    ['SANITATION', 'PUBLIC_HEALTH'],
    ['PUBLIC_TOILET', 'CIVIC_AMENITIES'],
    ['DEAD_ANIMAL', 'ANIMAL_MANAGEMENT'],
    ['BUILDING_COLLAPSE', 'EMERGENCY_RESPONSE'],
    ['DANGEROUS_BUILDING', 'BUILDINGS'],
    ['BLOCKED_DRAIN', 'DRAINAGE'], // alias codes route like canonical ones
    ['SEVERE_FLOODING', 'FLOOD_MANAGEMENT'],
    ['OTHER', 'GENERAL_CIVIC'],
  ])('routes %s to %s', async (category, code) => {
    const dept = await routingService.routeToDepartment(category);
    expect(dept.code).toBe(code);
  });

  test('unknown/unmapped category falls back to General Civic Services', async () => {
    const dept = await routingService.routeToDepartment('SOME_UNKNOWN_CATEGORY');
    expect(dept.code).toBe('GENERAL_CIVIC');
  });

  test('records secondary departments without changing the primary', async () => {
    const r = await routingService.routeWithSecondary('FLOODING');
    expect(r.primary.code).toBe('DRAINAGE');
    expect(r.secondary.map((d) => d.code)).toEqual(['FLOOD_MANAGEMENT']);
    expect(r.usedFallback).toBe(false);
  });

  test('an inactive primary promotes the first active secondary department', async () => {
    mockRows.DRAINAGE = { id: 4, code: 'DRAINAGE', name: 'Storm Water Drainage', is_active: 0 };
    const r = await routingService.routeWithSecondary('FLOODING');
    expect(r.primary.code).toBe('FLOOD_MANAGEMENT');
    expect(r.usedFallback).toBe(true);
  });

  test('an inactive primary with no secondary falls back to General Civic Services', async () => {
    mockRows.PARKS = { id: 9, code: 'PARKS', name: 'Parks & Recreation', is_active: 0 };
    const r = await routingService.routeWithSecondary('PARK_DAMAGE');
    expect(r.primary.code).toBe('GENERAL_CIVIC');
    expect(r.usedFallback).toBe(true);
  });

  test('a missing department row also falls back instead of returning nothing', async () => {
    mockRows.PARKS = null;
    const dept = await routingService.routeToDepartment('PARK_DAMAGE');
    expect(dept.code).toBe('GENERAL_CIVIC');
  });

  test('looks departments up by stable code', async () => {
    await routingService.routeToDepartment('POTHOLE');
    expect(departmentModel.findByCode).toHaveBeenCalledWith('ROADS');
  });
});
