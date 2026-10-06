const { pool } = require('../config/db');
const complaintModel = require('../models/complaint.model');
const complaintService = require('../services/complaint/complaint.service');
const statusService = require('../services/complaint/status.service');
const imageVerificationService = require('../services/ai/imageVerification.service');
const officerCopilotService = require('../services/ai/officerCopilot.service');
const { uploadComplaintImage } = require('../services/upload/cloudinary.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { COMPLAINT_STATUS } = require('../utils/constants');
const resolutionOverview = require('../services/admin/resolutionOverview.service');

const listAssigned = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, priority_level, search, sort, order } = req.query;
  const filters = { department_id: req.user.department_id };
  if (status) filters.status = status;
  if (priority_level) filters.priority_level = priority_level;
  if (search) filters.search = String(search).slice(0, 100);
  const result = await complaintModel.list(filters, { page: Number(page), limit: Number(limit), sort, order });
  res.status(200).json({ success: true, data: result });
});

async function assertDepartmentComplaint(req) {
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  if (complaint.department_id !== req.user.department_id) {
    throw new AppError('This complaint is not assigned to your department.', 403);
  }
  return complaint;
}

const accept = asyncHandler(async (req, res) => {
  const complaint = await assertDepartmentComplaint(req);
  if (complaint.officer_id && complaint.officer_id !== req.user.id) {
    throw new AppError('This complaint has already been accepted by another officer.', 409);
  }
  await complaintModel.update(complaint.id, { officer_id: req.user.id });
  const updated = await complaintService.getComplaintDetail(complaint.id);
  res.status(200).json({ success: true, data: { complaint: updated } });
});

const start = asyncHandler(async (req, res) => {
  const complaint = await assertDepartmentComplaint(req);
  if (complaint.officer_id !== req.user.id) {
    throw new AppError('Accept this complaint before starting work.', 400);
  }
  const updated = await statusService.transition(complaint.id, COMPLAINT_STATUS.IN_PROGRESS, req.user, req.body.notes);
  res.status(200).json({ success: true, data: { complaint: updated } });
});

const uploadResolutionImage = asyncHandler(async (req, res) => {
  const complaint = await assertDepartmentComplaint(req);
  if (complaint.officer_id !== req.user.id) {
    throw new AppError('You are not assigned to this complaint.', 403);
  }
  if (!req.file) {
    throw new AppError('A resolution image is required.', 400);
  }
  const imageUrl = await uploadComplaintImage(req.file.buffer, 'resolution');
  await complaintModel.addImage(pool, complaint.id, imageUrl, 'RESOLUTION');
  const updated = await complaintService.getComplaintDetail(complaint.id);
  res.status(200).json({ success: true, data: { complaint: updated } });
});

const resolve = asyncHandler(async (req, res) => {
  const complaint = await assertDepartmentComplaint(req);
  if (complaint.officer_id !== req.user.id) {
    throw new AppError('You are not assigned to this complaint.', 403);
  }

  const images = await complaintModel.getImages(complaint.id);
  const beforeImage = images.find((i) => i.image_type === 'ORIGINAL');
  const afterImage = images.find((i) => i.image_type === 'RESOLUTION');

  let verification = null;
  if (beforeImage && afterImage) {
    const result = await imageVerificationService.verifyBeforeAfter({
      description: complaint.description,
      beforeImageUrl: beforeImage.image_url,
      afterImageUrl: afterImage.image_url,
    });
    if (result.success) {
      verification = result.result;
      await complaintModel.update(complaint.id, {
        resolution_verification: JSON.stringify(verification),
        resolution_verification_status: verification.status,
      });
      logger.info('Resolution AI verification completed.', {
        complaintId: complaint.id,
        status: verification.status,
      });
    }
  }

  const updated = await statusService.transition(
    complaint.id,
    COMPLAINT_STATUS.RESOLUTION_SUBMITTED,
    req.user,
    req.body.notes || 'Resolution submitted by officer.'
  );
  logger.info('Resolution submitted by officer.', { complaintId: complaint.id, officerId: req.user.id });

  res.status(200).json({ success: true, data: { complaint: updated, ai_verification: verification } });
});

// Section 12: Officer AI Copilot - advisory inspection/evidence/resolution checklist.
// Cached on the complaint row after first generation to avoid repeat OpenAI calls.
const getAiAssistance = asyncHandler(async (req, res) => {
  const complaint = await assertDepartmentComplaint(req);

  if (complaint.ai_officer_checklist) {
    return res.status(200).json({ success: true, data: { checklist: complaint.ai_officer_checklist, cached: true } });
  }

  const result = await officerCopilotService.generateChecklist(complaint);
  if (!result.success) {
    return res.status(200).json({
      success: true,
      data: { checklist: null, cached: false, unavailable: true, reason: result.failureReason },
    });
  }

  await complaintModel.update(complaint.id, { ai_officer_checklist: JSON.stringify(result.checklist) });
  res.status(200).json({ success: true, data: { checklist: result.checklist, cached: false } });
});

// Outcomes of the officer's resolutions: waiting for approval, sent back, approved, and what the citizen said.
// scope=mine (default) is this officer's own complaints; scope=department is the whole department.
const resolutions = asyncHandler(async (req, res) => {
  const { view, limit, scope } = req.query;
  const departmentWide = scope === 'department' && req.user.department_id;
  const data = await resolutionOverview.overview({
    view: typeof view === 'string' ? view : undefined,
    limit,
    scope: departmentWide ? { departmentId: req.user.department_id } : { officerId: req.user.id },
  });
  res.status(200).json({ success: true, data });
});

module.exports = { listAssigned, accept, start, uploadResolutionImage, resolve, getAiAssistance, resolutions };
