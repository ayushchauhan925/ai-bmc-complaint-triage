const { pool } = require('../config/db');
const complaintService = require('../services/complaint/complaint.service');
const reopenService = require('../services/complaint/reopen.service');
const feedbackModel = require('../models/feedback.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { COMPLAINT_STATUS } = require('../utils/constants');

const submit = asyncHandler(async (req, res) => {
  const complaint = await complaintService.getComplaintDetail(req.params.id);
  if (complaint.user_id !== req.user.id) {
    throw new AppError('You can only give feedback on your own complaints.', 403);
  }
  if (complaint.status !== COMPLAINT_STATUS.RESOLVED) {
    throw new AppError('Feedback can only be submitted after a complaint is resolved.', 400);
  }

  // One piece of feedback per resolution, and it cannot be edited afterwards.
  if (await feedbackModel.findForCurrentResolution(complaint)) {
    throw new AppError('You have already submitted feedback for this resolution. It can no longer be changed.', 409);
  }

  const { resolved, rating, comment } = req.body;

  await pool.query(
    `INSERT INTO feedback (complaint_id, user_id, rating, resolved, comment) VALUES (?, ?, ?, ?, ?)`,
    [complaint.id, req.user.id, rating ?? null, resolved, comment || null]
  );

  let updated = complaint;
  if (!resolved) {
    // Reuses the same reopen pipeline as the dedicated /reopen endpoint (Section 17) so both
    // entry points produce identical history/notifications.
    updated = await reopenService.reopenComplaint({
      complaintId: complaint.id,
      user: req.user,
      reason: comment || 'Citizen reported the issue is not actually resolved.',
      imageFile: null,
    });
  }

  res.status(201).json({ success: true, data: { complaint: updated } });
});

module.exports = { submit };
