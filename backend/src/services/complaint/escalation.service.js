const { pool } = require('../../config/db');
const slaService = require('./sla.service');
const slaEscalationModel = require('../../models/slaEscalation.model');
const notificationService = require('../notification/notification.service');
const userModel = require('../../models/user.model');
const logger = require('../../utils/logger');
const { SLA_ESCALATION } = require('../../utils/constants');

/**
 * Advances sla_status for every active complaint and fires a one-time notification +
 * sla_escalations record the first time a complaint crosses into APPROACHING or BREACHED
 * (Section 14). There is no real job scheduler in this build, so this runs lazily whenever
 * an admin views the SLA/intelligence endpoints - see README for that documented limitation.
 */
async function runSlaEscalationCheck() {
  const [rows] = await pool.query(
    `SELECT * FROM complaints WHERE status NOT IN ('RESOLVED', 'REJECTED')`
  );

  let newEscalations = 0;

  for (const complaint of rows) {
    const newStatus = slaService.computeSlaStatus({
      slaDeadline: complaint.sla_deadline,
      status: complaint.status,
      resolvedAt: complaint.resolved_at,
      priorityLevel: complaint.priority_level,
      createdAt: complaint.created_at,
    });

    if (newStatus !== complaint.sla_status) {
      await pool.query('UPDATE complaints SET sla_status = ? WHERE id = ?', [newStatus, complaint.id]);
    }

    const rolesToNotify = SLA_ESCALATION.notifyOn[newStatus];
    if (!rolesToNotify) continue;

    const alreadyEscalated = await slaEscalationModel.hasEscalation(complaint.id, newStatus);
    if (alreadyEscalated) continue;

    for (const role of rolesToNotify) {
      const recipients =
        role === 'OFFICER' && complaint.officer_id
          ? [await userModel.findById(complaint.officer_id)].filter(Boolean)
          : role === 'ADMIN'
          ? await userModel.listByRole('ADMIN')
          : [];

      for (const recipient of recipients) {
        await notificationService.notify({
          userId: recipient.id,
          title: `SLA ${newStatus === 'BREACHED' ? 'breached' : 'approaching'}: ${complaint.complaint_number}`,
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
