const { pool } = require('../../config/db');
const slaService = require('./sla.service');
const slaPolicyService = require('./slaPolicy.service');
const slaEscalationModel = require('../../models/slaEscalation.model');
const escalationEventModel = require('../../models/escalationEvent.model');
const timeline = require('./timeline.service');
const notificationService = require('../notification/notification.service');
const userModel = require('../../models/user.model');
const logger = require('../../utils/logger');
const { SLA_ESCALATION } = require('../../utils/constants');

/**
 * Advances sla_status for every active complaint and, the first time a complaint crosses
 * into APPROACHING or BREACHED, records an escalation event + timeline entry and notifies
 * the officer/admins (Section 14). Fully deterministic: same data in, same escalations out,
 * and each (complaint, status) escalates at most once.
 *
 * Runs on a schedule (services/jobs/scheduler.js) and lazily whenever an admin opens the
 * SLA/intelligence views, so it still works if background jobs are disabled.
 */
async function runSlaEscalationCheck() {
  const [rows] = await pool.query(
    `SELECT * FROM complaints WHERE status NOT IN ('RESOLVED', 'REJECTED')`
  );

  let newEscalations = 0;
  const admins = await userModel.listByRole('ADMIN');

  for (const complaint of rows) {
    const policy = await slaPolicyService.resolvePolicy(complaint.priority_level, complaint.category);
    const newStatus = slaService.computeSlaStatus({
      slaDeadline: complaint.sla_deadline,
      status: complaint.status,
      resolvedAt: complaint.resolved_at,
      priorityLevel: complaint.priority_level,
      createdAt: complaint.created_at,
      slaHours: complaint.sla_hours,
      warningPct: policy.warningPct,
    });

    if (newStatus !== complaint.sla_status) {
      await pool.query('UPDATE complaints SET sla_status = ? WHERE id = ?', [newStatus, complaint.id]);
    }

    const rolesToNotify = SLA_ESCALATION.notifyOn[newStatus];
    if (!rolesToNotify) continue;

    const alreadyEscalated = await slaEscalationModel.hasEscalation(complaint.id, newStatus);
    if (alreadyEscalated) continue;

    const breached = newStatus === 'BREACHED';
    await escalationEventModel.create({
      ruleCode: breached ? 'SLA_BREACHED' : 'SLA_APPROACHING',
      severity: breached ? 'HIGH' : 'MEDIUM',
      complaintId: complaint.id,
      departmentId: complaint.department_id,
      title: `${breached ? 'SLA breached' : 'SLA approaching'}: ${complaint.complaint_number}`,
      details: { priority: complaint.priority_level, slaDeadline: complaint.sla_deadline, targetHours: complaint.sla_hours },
      dedupeKey: `sla:${complaint.id}:${newStatus}`,
      notify: false, // recipients are handled below (officer + admins), as before
    });
    await timeline.recordEvent(
      complaint.id,
      breached ? timeline.EVENT_TYPES.SLA_BREACHED : timeline.EVENT_TYPES.SLA_WARNING,
      breached ? 'SLA deadline missed' : 'SLA deadline approaching',
      { details: { deadline: complaint.sla_deadline } }
    );

    for (const role of rolesToNotify) {
      const recipients =
        role === 'OFFICER' && complaint.officer_id
          ? [await userModel.findById(complaint.officer_id)].filter(Boolean)
          : role === 'ADMIN'
          ? admins
          : [];

      for (const recipient of recipients) {
        await notificationService.notify({
          userId: recipient.id,
          title: `SLA ${breached ? 'breached' : 'approaching'}: ${complaint.complaint_number}`,
          message: `${complaint.category.replace(/_/g, ' ')} - priority ${complaint.priority_level}`,
          type: 'SLA_ESCALATION',
          relatedComplaintId: complaint.id,
        });
        await slaEscalationModel.create({
          complaintId: complaint.id,
          fromStatus: complaint.sla_status,
          toStatus: newStatus,
          notifiedUserId: recipient.id,
          notifiedRole: role,
        });
        newEscalations += 1;
      }
    }
  }

  if (newEscalations > 0) {
    logger.info('SLA escalation check completed.', { checked: rows.length, newEscalations });
  }

  return { checked: rows.length, newEscalations };
}

module.exports = { runSlaEscalationCheck };
