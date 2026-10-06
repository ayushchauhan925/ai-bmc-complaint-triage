const complaintModel = require('../models/complaint.model');
const complaintService = require('../services/complaint/complaint.service');
const departmentModel = require('../models/department.model');
const wardModel = require('../models/ward.model');
const userModel = require('../models/user.model');
const notificationService = require('../services/notification/notification.service');
const analyticsService = require('../services/analytics/analytics.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const auditService = require('../services/audit/audit.service');
const timeline = require('../services/complaint/timeline.service');
const resolutionOverview = require('../services/admin/resolutionOverview.service');

const listComplaints = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, status, category, priority_level, department_id, ward_id, search, review_required,
    sla_status, incident_id, officer_id, citizen, complaint_id, date_from, date_to, sort, order,
  } = req.query;
  const filters = { status, category, priority_level, search, sla_status, citizen, date_from, date_to };
  if (incident_id) filters.incident_id = Number(incident_id);
  if (officer_id) filters.officer_id = Number(officer_id);
  if (complaint_id) filters.complaint_id = Number(complaint_id);
  if (department_id) filters.department_id = Number(department_id);
  if (ward_id) filters.ward_id = Number(ward_id);
  if (review_required !== undefined) filters.review_required = review_required === 'true';

  const result = await complaintModel.list(filters, { page: Number(page), limit: Number(limit), sort, order });
  res.status(200).json({ success: true, data: result });
});

const assign = asyncHandler(async (req, res) => {
  const { department_id, officer_id } = req.body;

  const department = await departmentModel.findById(department_id);
  if (!department) {
    throw new AppError('Department not found.', 404);
  }
  if (!department.is_active) {
    throw new AppError('That department is inactive. Choose an active department.', 409);
  }

  if (officer_id) {
    const officer = await userModel.findById(officer_id);
    if (!officer || officer.role !== 'OFFICER') {
      throw new AppError('Officer not found.', 404);
    }
    if (!officer.is_active) {
      throw new AppError('That officer is inactive and cannot receive assignments.', 409);
    }
    if (officer.department_id !== department.id) {
      throw new AppError('That officer does not belong to the selected department.', 400);
    }
  }

  const before = await complaintModel.findById(req.params.id);
  if (!before) throw new AppError('Complaint not found.', 404);

  await complaintModel.update(req.params.id, {
    department_id,
    officer_id: officer_id || null,
  });
  await auditService.record({
    actor: req.user,
    action: 'COMPLAINT_ASSIGNED',
    entityType: 'complaint',
    entityId: req.params.id,
    previous: { departmentId: before.department_id, officerId: before.officer_id },
    next: { departmentId: department_id, officerId: officer_id || null },
  });
  await timeline.recordEvent(before.id, timeline.EVENT_TYPES.DEPARTMENT_ASSIGNED, `Assigned to ${department.name}${officer_id ? ' (officer assigned)' : ''}`, {
    details: { departmentId: department_id, officerId: officer_id || null },
    actorId: req.user.id,
  });

  if (officer_id) {
    const complaint = await complaintModel.findById(req.params.id);
    await notificationService.notify({
      userId: officer_id,
      title: `Complaint ${complaint.complaint_number} assigned to you`,
      message: `${complaint.category.replace(/_/g, ' ')} - priority ${complaint.priority_level}`,
      type: 'COMPLAINT_ASSIGNED',
      relatedComplaintId: complaint.id,
    });
  }

  const complaint = await complaintService.getComplaintDetail(req.params.id);
  res.status(200).json({ success: true, data: { complaint } });
});

const statistics = asyncHandler(async (req, res) => {
  const [summary, overTime, byCategory, byPriority, recentCritical, slaBreaches] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getComplaintsOverTime(30),
    analyticsService.getByCategory(),
    analyticsService.getByPriority(),
    analyticsService.getRecentCritical(10),
    analyticsService.getSlaBreaches(10),
  ]);
  res.status(200).json({
    success: true,
    data: { summary, overTime, byCategory, byPriority, recentCritical, slaBreaches },
  });
});

const mapData = asyncHandler(async (req, res) => {
  const { category, priority_level, status, department_id, ward_id, days } = req.query;
  const filters = { category, priority_level, status, days };
  if (department_id) filters.department_id = Number(department_id);
  if (ward_id) filters.ward_id = Number(ward_id);
  const rows = await analyticsService.getMapData(filters);
  res.status(200).json({ success: true, data: { points: rows } });
});

const listDepartments = asyncHandler(async (req, res) => {
  const departments = await departmentModel.findAll();
  res.status(200).json({ success: true, data: { departments } });
});

const listWards = asyncHandler(async (req, res) => {
  const wards = await wardModel.findAll();
  res.status(200).json({ success: true, data: { wards } });
});

const listOfficers = asyncHandler(async (req, res) => {
  const officers = await userModel.listByRole('OFFICER');
  res.status(200).json({ success: true, data: { officers } });
});

const resolutions = asyncHandler(async (req, res) => {
  const { view, limit } = req.query;
  const data = await resolutionOverview.overview({ view: typeof view === 'string' ? view : undefined, limit });
  res.status(200).json({ success: true, data });
});

module.exports = { listComplaints, assign, statistics, mapData, listDepartments, listWards, listOfficers, resolutions };
