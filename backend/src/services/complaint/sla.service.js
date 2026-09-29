const { SLA_HOURS_BY_PRIORITY, SLA_APPROACHING_THRESHOLD_PCT, SLA_STATUS, COMPLAINT_STATUS } = require('../../utils/constants');

// Demo/application SLA rules (Section 19) - not a claim about actual BMC SLA policy.
function calculateSlaDeadline(priorityLevel, fromDate = new Date()) {
  const hours = SLA_HOURS_BY_PRIORITY[priorityLevel] ?? SLA_HOURS_BY_PRIORITY.LOW;
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}

function computeSlaStatus({ slaDeadline, status, resolvedAt, priorityLevel, createdAt }) {
  if (!slaDeadline) return SLA_STATUS.ON_TRACK;

  const deadline = new Date(slaDeadline).getTime();

  if (status === COMPLAINT_STATUS.RESOLVED && resolvedAt) {
    return new Date(resolvedAt).getTime() <= deadline
      ? SLA_STATUS.COMPLETED_WITHIN_SLA
      : SLA_STATUS.COMPLETED_AFTER_SLA;
  }

  const now = Date.now();
  if (now > deadline) return SLA_STATUS.BREACHED;

  const hours = SLA_HOURS_BY_PRIORITY[priorityLevel] ?? SLA_HOURS_BY_PRIORITY.LOW;
  const windowMs = hours * 60 * 60 * 1000;
  const created = new Date(createdAt).getTime();
  const elapsedRatio = (now - created) / windowMs;

  return elapsedRatio >= SLA_APPROACHING_THRESHOLD_PCT ? SLA_STATUS.APPROACHING : SLA_STATUS.ON_TRACK;
}

module.exports = { calculateSlaDeadline, computeSlaStatus };
