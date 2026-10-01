const departmentService = require('../services/department/department.service');
const officerService = require('../services/department/officer.service');
const officerAssignment = require('../services/complaint/officerAssignment.service');
const departmentModel = require('../models/department.model');
const auditService = require('../services/audit/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const listDepartmentOverview = asyncHandler(async (req, res) => {
  const { search, active } = req.query;
  const departments = await departmentService.overview({
    search: search ? String(search).slice(0, 80) : undefined,
    active: active === 'true' ? true : active === 'false' ? false : undefined,
  });
  res.status(200).json({ success: true, data: { departments } });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid department id.', 400);
  const dept = await departmentModel.findById(id);
  if (!dept) throw new AppError('Department not found.', 404);

  const { is_active, reassign_to_department_id, ...fields } = req.body;
  let reassigned = 0;
  if (is_active !== undefined) {
    const result = await departmentService.setActive(id, is_active, { reassignToId: reassign_to_department_id, actor: req.user });
    reassigned = result.reassigned;
  }
  if (Object.keys(fields).length > 0) {
    await departmentModel.update(id, fields);
    await auditService.record({ actor: req.user, action: 'DEPARTMENT_UPDATED', entityType: 'department', entityId: id, previous: Object.fromEntries(Object.keys(fields).map((k) => [k, dept[k]])), next: fields });
  }
  const department = (await departmentService.overview()).find((d) => d.id === id);
  res.status(200).json({ success: true, data: { department, reassigned } });
});

const officerOverview = asyncHandler(async (req, res) => {
  const { search, department_id, status } = req.query;
  const officers = await officerAssignment.officerOverview({
    search: search ? String(search).slice(0, 80) : undefined,
    departmentId: department_id,
    status: status === 'active' || status === 'inactive' ? status : undefined,
  });
  res.status(200).json({ success: true, data: { officers } });
});

const createOfficer = asyncHandler(async (req, res) => {
  const { name, email, password, phone, department_id, ward_id } = req.body;
  const officer = await officerService.createOfficer({ name, email, password, phone, departmentId: department_id, wardId: ward_id }, req.user);
  res.status(201).json({ success: true, data: { officer } });
});

const updateOfficer = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid officer id.', 400);
  const result = await officerService.updateOfficer(id, req.body, req.user);
  res.status(200).json({ success: true, data: result });
});

module.exports = { listDepartmentOverview, updateDepartment, officerOverview, createOfficer, updateOfficer };
