const { pool } = require('../../config/db');
const complaintModel = require('../../models/complaint.model');
const duplicateModel = require('../../models/duplicate.model');
const incidentModel = require('../../models/incident.model');
const routingService = require('../complaint/routing.service');
const slaService = require('../complaint/sla.service');
const slaPolicyService = require('../complaint/slaPolicy.service');
const statusService = require('../complaint/status.service');
const timeline = require('../complaint/timeline.service');
const incidentGrouping = require('../duplicate/incidentGrouping.service');
const auditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { COMPLAINT_STATUS, CATEGORIES, PRIORITY_LEVEL_THRESHOLDS, ROLES } = require('../../utils/constants');

const ACTIONS = ['APPROVE', 'CORRECT', 'FALSE_POSITIVE', 'CONFIRM_DUPLICATE', 'REJECT_DUPLICATE'];
const LEVEL_MIN_SCORE = Object.fromEntries(PRIORITY_LEVEL_THRESHOLDS.map((t) => [t.level, t.min]));
const CLOSED = [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED];

/** Admins may review anything; officers only complaints in their own department or assigned to them. */
function assertCanReview(complaint, user) {
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.OFFICER && (complaint.officer_id === user.id || (user.department_id && complaint.department_id === user.department_id))) {
    return;
  }
  throw new AppError('You can only review complaints in your own department.', 403);
}

async function insertReview(conn, { complaint, reviewer, action, humanCategory, humanPriority, humanDepartmentId, notes }) {
  await conn.query(
    `INSERT INTO human_reviews
       (complaint_id, reviewer_id, action, ai_category, human_category, ai_priority_level, human_priority_level,
        ai_department_id, human_department_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      complaint.id,
      reviewer.id,
      action,
      complaint.category,
      humanCategory ?? null,
      complaint.priority_level,
      humanPriority ?? null,
      complaint.department_id,
      humanDepartmentId ?? null,
      notes || null,
    ]
  );
}

/** Moves a complaint that was waiting on review into the normal flow after a human decision. */
async function releaseFromReview(complaint, reviewer, note) {
  const waiting = [COMPLAINT_STATUS.NEEDS_REVIEW, COMPLAINT_STATUS.AI_ANALYZED, COMPLAINT_STATUS.SUBMITTED];
  if (waiting.includes(complaint.status)) {
    await statusService.transition(complaint.id, COMPLAINT_STATUS.ASSIGNED, reviewer, note, { force: true });
  }
}

/**
 * Applies a staff review to an AI/system decision. Every review is stored next to the value
 * the system produced (human_reviews), audited, and added to the complaint timeline. The
 * stored pairs are evaluation data only - nothing retrains a model from them.
 */
async function applyReview({ complaintId, reviewer, action, category, priorityLevel, departmentId, relatedComplaintId, notes }) {
  if (!ACTIONS.includes(action)) throw new AppError('Unknown review action.', 400);
  const complaint = await complaintModel.findById(complaintId);
  if (!complaint) throw new AppError('Complaint not found.', 404);
  assertCanReview(complaint, reviewer);
  if (CLOSED.includes(complaint.status) && action !== 'FALSE_POSITIVE') {
    throw new AppError('This complaint is already closed; it can no longer be reviewed.', 409);
  }

  const before = {
    category: complaint.category,
    priorityLevel: complaint.priority_level,
    departmentId: complaint.department_id,
    status: complaint.status,
    reviewStatus: complaint.review_status,
  };
  let after = { ...before };
  let summary;

  if (action === 'APPROVE') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await insertReview(conn, {
        complaint, reviewer, action, notes,
        humanCategory: complaint.category, humanPriority: complaint.priority_level, humanDepartmentId: complaint.department_id,
      });
      await conn.query("UPDATE complaints SET review_status = 'APPROVED', review_required = FALSE, review_reason = NULL WHERE id = ?", [complaint.id]);
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
    if (!complaint.department_id) {
      const dept = await routingService.routeToDepartment(complaint.category);
      if (dept) await complaintModel.update(complaint.id, { department_id: dept.id });
    }
    await releaseFromReview(complaint, reviewer, 'AI classification approved by staff.');
    after.reviewStatus = 'APPROVED';
    summary = 'Staff approved the AI classification';
  }

  if (action === 'CORRECT') {
    if (category && !CATEGORIES.includes(category)) throw new AppError('Invalid category.', 400);
    if (priorityLevel && !(priorityLevel in LEVEL_MIN_SCORE)) throw new AppError('Invalid priority level.', 400);
    if (!category && !priorityLevel && !departmentId) throw new AppError('Provide at least one corrected value.', 400);

    const newCategory = category || complaint.category;
    const newPriority = priorityLevel || complaint.priority_level;
    // A category change re-routes by the deterministic map unless staff picked a department explicitly.
    let newDepartmentId = complaint.department_id;
    if (departmentId) {
      const [[dept]] = await pool.query('SELECT id FROM departments WHERE id = ?', [departmentId]);
      if (!dept) throw new AppError('Department not found.', 404);
      newDepartmentId = dept.id;
    } else if (category && category !== complaint.category) {
      newDepartmentId = (await routingService.routeToDepartment(newCategory))?.id ?? complaint.department_id;
    }

    const fields = { category: newCategory, department_id: newDepartmentId, review_status: 'CORRECTED', review_required: false, review_reason: null };
    if (priorityLevel && priorityLevel !== complaint.priority_level) {
      const reasons = Array.isArray(complaint.priority_reasons) ? complaint.priority_reasons : [];
      fields.priority_level = newPriority;
      fields.priority_score = LEVEL_MIN_SCORE[newPriority];
      fields.priority_reasons = JSON.stringify([...reasons, { label: `Priority set to ${newPriority} by staff review`, points: 0 }]);
    }
    if (newPriority !== complaint.priority_level || newCategory !== complaint.category) {
      const policy = await slaPolicyService.resolvePolicy(newPriority, newCategory);
      fields.sla_hours = policy.hours;
      fields.sla_deadline = slaService.calculateSlaDeadline(newPriority, new Date(complaint.created_at), policy.hours);
      fields.sla_status = slaService.computeSlaStatus({
        slaDeadline: fields.sla_deadline, status: complaint.status, resolvedAt: complaint.resolved_at,
        priorityLevel: newPriority, createdAt: complaint.created_at, slaHours: policy.hours, warningPct: policy.warningPct,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await insertReview(conn, {
        complaint, reviewer, action, notes,
        humanCategory: newCategory, humanPriority: newPriority, humanDepartmentId: newDepartmentId,
      });
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
    await complaintModel.update(complaint.id, fields);
    await releaseFromReview(complaint, reviewer, 'Corrected and released by staff review.');
    after = { ...after, category: newCategory, priorityLevel: newPriority, departmentId: newDepartmentId, reviewStatus: 'CORRECTED' };
    summary = 'Staff corrected the AI/system decision';
  }

  if (action === 'FALSE_POSITIVE') {
    if (CLOSED.includes(complaint.status)) throw new AppError('This complaint is already closed.', 409);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await insertReview(conn, { complaint, reviewer, action, notes });
      await conn.query("UPDATE complaints SET review_status = 'FALSE_POSITIVE', review_required = FALSE WHERE id = ?", [complaint.id]);
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
    await statusService.transition(complaint.id, COMPLAINT_STATUS.REJECTED, reviewer, notes || 'Marked as a false positive by staff review.', { force: true });
    after = { ...after, status: COMPLAINT_STATUS.REJECTED, reviewStatus: 'FALSE_POSITIVE' };
    summary = 'Staff marked the complaint as a false positive';
  }

  if (action === 'CONFIRM_DUPLICATE' || action === 'REJECT_DUPLICATE') {
    if (!relatedComplaintId) throw new AppError('relatedComplaintId is required for duplicate review.', 400);
    const related = await complaintModel.findById(relatedComplaintId);
    if (!related) throw new AppError('Related complaint not found.', 404);
    const pair = (await duplicateModel.findPair(complaint.id, related.id)) || (await duplicateModel.findPair(related.id, complaint.id));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await insertReview(conn, { complaint, reviewer, action, notes });
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }

    if (action === 'CONFIRM_DUPLICATE') {
      if (pair) await duplicateModel.setReview(pair.complaint_id, pair.related_complaint_id, 'CONFIRMED', reviewer.id);
      const incidentId = await incidentGrouping.linkAsSameIncident({ complaint, related, actorId: reviewer.id });
      after = { ...after, incidentId };
      summary = `Staff confirmed ${related.complaint_number} as the same issue`;
    } else {
      if (pair) await duplicateModel.setReview(pair.complaint_id, pair.related_complaint_id, 'REJECTED', reviewer.id);
      // Only detach if the two shared an incident: the complaint itself is never deleted.
      if (complaint.incident_id && complaint.incident_id === related.incident_id) {
        const conn2 = await pool.getConnection();
        try {
          await conn2.beginTransaction();
          await incidentModel.unlinkComplaint(conn2, complaint.incident_id, complaint.id, reviewer.id);
          await conn2.commit();
        } catch (err) { await conn2.rollback(); throw err; } finally { conn2.release(); }
        after = { ...after, incidentId: null };
      }
      summary = `Staff rejected ${related.complaint_number} as a duplicate`;
    }
  }

  await timeline.recordEvent(complaint.id, timeline.EVENT_TYPES.HUMAN_REVIEW, summary, {
    details: { action, before, after, notes: notes || null },
    actorId: reviewer.id,
  });
  await auditService.record({
    actor: reviewer,
    action: `HUMAN_REVIEW_${action}`,
    entityType: 'complaint',
    entityId: complaint.id,
    previous: before,
    next: { ...after, relatedComplaintId: relatedComplaintId || undefined, notes: notes || undefined },
  });

  return complaintModel.findById(complaint.id);
}

async function listForComplaint(complaintId) {
  const [rows] = await pool.query(
    `SELECT r.*, u.name AS reviewer_name FROM human_reviews r
     LEFT JOIN users u ON u.id = r.reviewer_id
     WHERE r.complaint_id = ? ORDER BY r.created_at DESC`,
    [complaintId]
  );
  return rows;
}

module.exports = { applyReview, listForComplaint, assertCanReview, ACTIONS };
