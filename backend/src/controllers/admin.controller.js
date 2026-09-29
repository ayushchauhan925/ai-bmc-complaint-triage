const complaintModel = require('../models/complaint.model');
const complaintService = require('../services/complaint/complaint.service');
const departmentModel = require('../models/department.model');
const wardModel = require('../models/ward.model');
const userModel = require('../models/user.model');
const notificationService = require('../services/notification/notification.service');
const analyticsService = require('../services/analytics/analytics.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const listComplaints = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category, priority_level, department_id, ward_id, search, review_required } = req.query;
  const filters = { status, category, priority_level, search };
  if (department_id) filters.department_id = Number(department_id);
  if (ward_id) filters.ward_id = Number(ward_id);
  if (review_required !== undefined) filters.review_required = review_required === 'true';

  const result = await complaintModel.list(filters, { page: Number(page), limit: Number(limit) });
  res.status(200).json({ success: true, data: result });
});

const assign = asyncHandler(async (req, res) => {
  const { department_id, officer_id } = req.body;

  const department = await departmentModel.findById(department_id);
  if (!department) {
    throw new AppError('Department not found.', 404);
  }

  if (officer_id) {
    const officer = await userModel.findById(officer_id);
    if (!officer || officer.role !== 'OFFICER') {
      throw new AppError('Officer not found.', 404);
    }
  }

  await complaintModel.update(req.params.id, {
    department_id,
    officer_id: officer_id || null,
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
  const { category, priority_level, status, department_id, ward_id } = req.query;
  const filters = { category, priority_level, status };
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

module.exports = { listComplaints, assign, statistics, mapData, listDepartments, listWards, listOfficers };
