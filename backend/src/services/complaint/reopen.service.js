const { pool } = require('../../config/db');
const complaintModel = require('../../models/complaint.model');
const reopeningModel = require('../../models/reopening.model');
const feedbackModel = require('../../models/feedback.model');
const statusService = require('./status.service');
const notificationService = require('../notification/notification.service');
const { uploadComplaintImage } = require('../upload/cloudinary.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { COMPLAINT_STATUS } = require('../../utils/constants');

/**
 * Section 17: citizen reopens a RESOLVED complaint. Records the reopen (reason + optional
 * evidence photo) separately from the generic status history, then walks the lifecycle
 * RESOLVED -> REOPENED -> ASSIGNED, keeping the same department/officer so it lands straight
 * back in the right queue instead of starting from scratch.
 */
async function reopenComplaint({ complaintId, user, reason, imageFile }) {
  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) {
    throw new AppError('Complaint not found.', 404);
  }
  if (complaint.user_id !== user.id) {
    throw new AppError('You can only reopen your own complaints.', 403);
  }
  if (complaint.status !== COMPLAINT_STATUS.RESOLVED) {
    throw new AppError('Only resolved complaints can be reopened.', 400);
  }
  // Once the citizen has confirmed the fix, that confirmation is final.
  const existing = await feedbackModel.findForCurrentResolution(complaint);
  if (existing && existing.resolved) {
    throw new AppError('You confirmed this complaint as resolved, so it can no longer be reopened.', 409);
  }

  let imageUrl = null;
  if (imageFile) {
    imageUrl = await uploadComplaintImage(imageFile.buffer, 'reopen');
    await complaintModel.addImage(pool, complaintId, imageUrl, 'REOPEN');
  }

  await reopeningModel.create({ complaintId, userId: user.id, reason, imageUrl });

  await statusService.transition(complaintId, COMPLAINT_STATUS.REOPENED, user, reason || 'Citizen reported the issue is not resolved.');
  const updated = await statusService.transition(
    complaintId,
    COMPLAINT_STATUS.ASSIGNED,
    user,
    'Reopened complaint re-queued to the assigned department.',
    { force: true }
  );

  logger.info('Complaint reopened by citizen.', { complaintId, userId: user.id });

  if (complaint.officer_id) {
    await notificationService.notify({
      userId: complaint.officer_id,
      title: `Complaint reopened: ${complaint.complaint_number}`,
      message: reason || 'The citizen reported this issue is not resolved.',
      type: 'COMPLAINT_REOPENED',
      relatedComplaintId: complaintId,
    });
  }

  return updated;
}

module.exports = { reopenComplaint };
