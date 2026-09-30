const { pool } = require('../../config/db');
const complaintModel = require('../../models/complaint.model');
const notificationService = require('../../services/notification/notification.service');
const AppError = require('../../utils/AppError');
const auditService = require('../audit/audit.service');
const { COMPLAINT_STATUS } = require('../../utils/constants');

const S = COMPLAINT_STATUS;

// Deterministic lifecycle graph (Section 17). Kept in one place so no controller has to
// guess which transitions are legal.
const ALLOWED_TRANSITIONS = {
  [S.SUBMITTED]: [S.AI_ANALYZED, S.NEEDS_REVIEW, S.REJECTED],
  [S.AI_ANALYZED]: [S.ASSIGNED, S.NEEDS_REVIEW],
  [S.ASSIGNED]: [S.IN_PROGRESS, S.NEEDS_REVIEW, S.REJECTED],
  [S.IN_PROGRESS]: [S.RESOLUTION_SUBMITTED, S.NEEDS_REVIEW],
  [S.RESOLUTION_SUBMITTED]: [S.RESOLVED, S.IN_PROGRESS],
  [S.RESOLVED]: [S.REOPENED],
  [S.REOPENED]: [S.ASSIGNED, S.IN_PROGRESS],
  [S.NEEDS_REVIEW]: [S.AI_ANALYZED, S.ASSIGNED, S.REJECTED, S.SUBMITTED],
  [S.REJECTED]: [S.SUBMITTED],
};

const STATUS_MESSAGES = {
  [S.AI_ANALYZED]: 'Your complaint has been analyzed by our AI system.',
  [S.ASSIGNED]: 'Your complaint has been assigned to the relevant department.',
  [S.IN_PROGRESS]: 'Work has started on your complaint.',
  [S.RESOLUTION_SUBMITTED]: 'A resolution has been submitted for your complaint and is pending approval.',
  [S.RESOLVED]: 'Your complaint has been marked as resolved.',
  [S.NEEDS_REVIEW]: 'Your complaint requires manual review by our team.',
  [S.REJECTED]: 'Your complaint has been reviewed and closed. See notes for details.',
  [S.REOPENED]: 'Your complaint has been reopened for further action.',
};

function assertTransitionAllowed(currentStatus, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(`Cannot change status from ${currentStatus} to ${nextStatus}.`, 400);
  }
}

async function transition(complaintId, nextStatus, actorUser, notes, { force = false } = {}) {
  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) {
    throw new AppError('Complaint not found.', 404);
  }

  if (!force) {
    assertTransitionAllowed(complaint.status, nextStatus);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const extraFields = {};
    if (nextStatus === S.RESOLVED) {
      extraFields.resolved_at = new Date();
    }

    const setClauses = ['status = ?', ...Object.keys(extraFields).map((k) => `${k} = ?`)];
    const values = [nextStatus, ...Object.values(extraFields)];
    await conn.query(`UPDATE complaints SET ${setClauses.join(', ')} WHERE id = ?`, [...values, complaintId]);

    await complaintModel.addHistory(conn, complaintId, complaint.status, nextStatus, actorUser?.id, notes);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await auditService.record({
    actor: actorUser,
    action: 'STATUS_CHANGED',
    entityType: 'complaint',
    entityId: complaintId,
    previous: { status: complaint.status },
    next: { status: nextStatus, notes },
  });

  const message = STATUS_MESSAGES[nextStatus] || `Complaint status updated to ${nextStatus}.`;
  await notificationService.notify({
    userId: complaint.user_id,
    title: `Complaint ${complaint.complaint_number} updated`,
    message,
    type: 'STATUS_CHANGE',
    relatedComplaintId: complaintId,
  });

  return complaintModel.findById(complaintId);
}

module.exports = { transition, ALLOWED_TRANSITIONS, assertTransitionAllowed };
