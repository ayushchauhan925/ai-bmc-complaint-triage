jest.mock('../../src/models/department.model', () => ({
  findByCode: jest.fn((code) => Promise.resolve({ id: 1, code, name: `${code} Department` })),
}));

const routingService = require('../../src/services/complaint/routing.service');
const departmentModel = require('../../src/models/department.model');

describe('routing.service.routeToDepartment', () => {
  afterEach(() => jest.clearAllMocks());

  test('routes POTHOLE to ROADS', async () => {
    await routingService.routeToDepartment('POTHOLE');
    expect(departmentModel.findByCode).toHaveBeenCalledWith('ROADS');
  });

  test('routes GARBAGE to SOLID_WASTE', async () => {
    await routingService.routeToDepartment('GARBAGE');
    expect(departmentModel.findByCode).toHaveBeenCalledWith('SOLID_WASTE');
  });

  test('routes STREETLIGHT to ELECTRICAL', async () => {
    await routingService.routeToDepartment('STREETLIGHT');
    expect(departmentModel.findByCode).toHaveBeenCalledWith('ELECTRICAL');
  });

  test('unknown/unmapped category falls back to GENERAL', async () => {
    await routingService.routeToDepartment('SOME_UNKNOWN_CATEGORY');
    expect(departmentModel.findByCode).toHaveBeenCalledWith('GENERAL');
  });
});
