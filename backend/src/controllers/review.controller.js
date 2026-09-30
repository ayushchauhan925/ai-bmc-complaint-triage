const humanReviewService = require('../services/review/humanReview.service');
const complaintModel = require('../models/complaint.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const submitReview = asyncHandler(async (req, res) => {
  const { action, category, priority_level, department_id, related_complaint_id, notes } = req.body;
  const complaint = await humanReviewService.applyReview({
    complaintId: Number(req.params.id),
    reviewer: req.user,
    action,
    category,
    priorityLevel: priority_level,
    departmentId: department_id,
    relatedComplaintId: related_complaint_id,
    notes,
  });
  res.status(200).json({ success: true, data: { complaint } });
});

const listReviews = asyncHandler(async (req, res) => {
  const complaint = await complaintModel.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found.', 404);
  humanReviewService.assertCanReview(complaint, req.user);
  const reviews = await humanReviewService.listForComplaint(complaint.id);
  res.status(200).json({ success: true, data: { reviews } });
});

module.exports = { submitReview, listReviews };
