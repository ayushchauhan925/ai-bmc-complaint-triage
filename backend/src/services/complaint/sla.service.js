const { SLA_HOURS_BY_PRIORITY, SLA_APPROACHING_THRESHOLD_PCT, SLA_STATUS, COMPLAINT_STATUS } = require('../../utils/constants');

const HOUR_MS = 60 * 60 * 1000;

// Application SLA rules - not a claim about actual BMC SLA policy. Durations come from the
// sla_policies table via slaPolicy.service (configurable); the constants are the fallback.
// `hoursOverride` is the snapshot stored on the complaint (complaints.sla_hours).
function calculateSlaDeadline(priorityLevel, fromDate = new Date(), hoursOverride = null) {
  const hours = hoursOverride ?? SLA_HOURS_BY_PRIORITY[priorityLevel] ?? SLA_HOURS_BY_PRIORITY.LOW;
  return new Date(fromDate.getTime() + hours * HOUR_MS);
}

function computeSlaStatus({ slaDeadline, status, resolvedAt, priorityLevel, createdAt, slaHours = null, warningPct = null }) {
  if (!slaDeadline) return SLA_STATUS.ON_TRACK;

  const deadline = new Date(slaDeadline).getTime();

  if (status === COMPLAINT_STATUS.RESOLVED && resolvedAt) {
    return new Date(resolvedAt).getTime() <= deadline
      ? SLA_STATUS.COMPLETED_WITHIN_SLA
      : SLA_STATUS.COMPLETED_AFTER_SLA;
  }

  const now = Date.now();
  if (now > deadline) return SLA_STATUS.BREACHED;

  const hours = slaHours ?? SLA_HOURS_BY_PRIORITY[priorityLevel] ?? SLA_HOURS_BY_PRIORITY.LOW;
  const windowMs = hours * HOUR_MS;
  const created = new Date(createdAt).getTime();
  const elapsedRatio = (now - created) / windowMs;

  return elapsedRatio >= (warningPct ?? SLA_APPROACHING_THRESHOLD_PCT) ? SLA_STATUS.APPROACHING : SLA_STATUS.ON_TRACK;
}

/**
 * Full SLA picture for one complaint: start, deadline, time remaining/overdue, resolution
 * time and the current status - everything the UI/escalation engine needs, derived only
 * from stored timestamps.
 */
function slaSnapshot(complaint, warningPct = null) {
  const created = new Date(complaint.created_at).getTime();
  const deadline = complaint.sla_deadline ? new Date(complaint.sla_deadline).getTime() : null;
  const closed = complaint.status === COMPLAINT_STATUS.RESOLVED && complaint.resolved_at;
  const status = computeSlaStatus({
    slaDeadline: complaint.sla_deadline,
    status: complaint.status,
    resolvedAt: complaint.resolved_at,
    priorityLevel: complaint.priority_level,
    createdAt: complaint.created_at,
    slaHours: complaint.sla_hours,
    warningPct,
  });
  return {
    startedAt: new Date(created).toISOString(),
    deadline: deadline ? new Date(deadline).toISOString() : null,
    targetHours: complaint.sla_hours ?? SLA_HOURS_BY_PRIORITY[complaint.priority_level] ?? null,
    status,
    remainingMs: deadline && !closed ? deadline - Date.now() : null,
    breached: status === SLA_STATUS.BREACHED || status === SLA_STATUS.COMPLETED_AFTER_SLA,
    warning: status === SLA_STATUS.APPROACHING,
    resolutionMs: closed ? new Date(complaint.resolved_at).getTime() - created : null,
  };
}

module.exports = { calculateSlaDeadline, computeSlaStatus, slaSnapshot };
