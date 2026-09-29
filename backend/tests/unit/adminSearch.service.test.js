jest.mock('../../src/models/department.model', () => ({
  findByCode: jest.fn(),
}));
jest.mock('../../src/models/ward.model', () => ({
  findAll: jest.fn(),
}));

const departmentModel = require('../../src/models/department.model');
const wardModel = require('../../src/models/ward.model');
const { sanitizeFilters } = require('../../src/services/admin/adminSearch.service');

describe('adminSearch.service.sanitizeFilters (security allowlist boundary)', () => {
  afterEach(() => jest.clearAllMocks());

  test('passes through a valid, fully-allowlisted filter object', async () => {
    const { safeFilters, dropped } = await sanitizeFilters({
      category: 'POTHOLE',
      status: ['ASSIGNED', 'IN_PROGRESS'],
      priority_level: ['CRITICAL', 'HIGH'],
      near_school: true,
      limit: 10,
    });
    expect(safeFilters.category).toBe('POTHOLE');
    expect(safeFilters.status).toEqual(['ASSIGNED', 'IN_PROGRESS']);
    expect(safeFilters.priority_level).toEqual(['CRITICAL', 'HIGH']);
    expect(safeFilters.near_school).toBe(true);
    expect(dropped).toEqual([]);
  });

  test('drops a category value that is not in the allowed CATEGORIES list', async () => {
    const { safeFilters, dropped } = await sanitizeFilters({ category: 'DROP TABLE complaints' });
    expect(safeFilters.category).toBeUndefined();
    expect(dropped).toContain('category');
  });

  test('drops status values outside the enum instead of passing them through', async () => {
    const { safeFilters, dropped } = await sanitizeFilters({
      status: ['ASSIGNED', "'; DROP TABLE complaints; --"],
    });
    expect(safeFilters.status).toEqual(['ASSIGNED']);
    expect(dropped).toContain('status');
  });

  test('never emits a raw SQL fragment for any field - only structured, typed values', async () => {
    const { safeFilters } = await sanitizeFilters({
      category: 'POTHOLE OR 1=1',
      priority_level: ['CRITICAL); DROP TABLE users;'],
      date_from: 'not-a-date',
    });
    expect(safeFilters.category).toBeUndefined();
    expect(safeFilters.priority_level).toBeUndefined();
    expect(safeFilters.date_from).toBeUndefined();
  });

  test('resolves a valid department_code to a department_id via the live department table', async () => {
    departmentModel.findByCode.mockResolvedValue({ id: 3, code: 'ROADS' });
    const { safeFilters, dropped } = await sanitizeFilters({ department_code: 'roads' });
    expect(departmentModel.findByCode).toHaveBeenCalledWith('ROADS');
    expect(safeFilters.department_id).toBe(3);
    expect(dropped).not.toContain('department_code');
  });

  test('drops an unknown department_code rather than guessing', async () => {
    departmentModel.findByCode.mockResolvedValue(null);
    const { safeFilters, dropped } = await sanitizeFilters({ department_code: 'NOT_REAL' });
    expect(safeFilters.department_id).toBeUndefined();
    expect(dropped).toContain('department_code');
  });

  test('resolves ward_code case-insensitively against the live wards table', async () => {
    wardModel.findAll.mockResolvedValue([{ id: 7, ward_code: 'DEMO-A', ward_name: 'Ward A (DEMO)' }]);
    const { safeFilters } = await sanitizeFilters({ ward_code: 'demo-a' });
    expect(safeFilters.ward_id).toBe(7);
  });

  test('rejects malformed date strings', async () => {
    const { safeFilters, dropped } = await sanitizeFilters({ date_from: '2026/09/30', date_to: '2026-09-30' });
    expect(safeFilters.date_from).toBeUndefined();
    expect(safeFilters.date_to).toBe('2026-09-30');
    expect(dropped).toContain('date_from');
  });

  test('clamps limit to a sane range instead of trusting an arbitrarily large value', async () => {
    const { limit } = await sanitizeFilters({ limit: 100000 });
    expect(limit).toBeLessThanOrEqual(100);
  });

  test('ignores unknown/unlisted fields entirely', async () => {
    const { safeFilters } = await sanitizeFilters({ arbitrary_field: 'value', __proto__: 'polluted' });
    expect(Object.keys(safeFilters)).toEqual([]);
  });
});
