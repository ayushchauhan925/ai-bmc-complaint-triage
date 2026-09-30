const { pool } = require('../config/db');
const auditService = require('../services/audit/audit.service');
const aiUsage = require('../services/ai/aiUsage.service');
const feedbackMetrics = require('../services/review/feedbackMetrics.service');
const evaluationService = require('../services/evaluation/evaluation.service');
const semanticSearch = require('../services/admin/semanticSearch.service');
const scheduler = require('../services/jobs/scheduler');
const metrics = require('../services/observability/metrics.service');
const notificationService = require('../services/notification/notification.service');
const slaService = require('../services/complaint/sla.service');
const slaPolicyService = require('../services/complaint/slaPolicy.service');
const escalationService = require('../services/complaint/escalation.service');
const escalationEngine = require('../services/complaint/escalationEngine.service');
const escalationEventModel = require('../models/escalationEvent.model');
const analyticsService = require('../services/analytics/analytics.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const env = require('../config/env');

const auditLogs = asyncHandler(async (req, res) => {
  const { entity_type, entity_id, action, actor_id, date_from, date_to, page, limit } = req.query;
  const data = await auditService.list({ entityType: entity_type, entityId: entity_id, action, actorId: actor_id, dateFrom: date_from, dateTo: date_to, page, limit });
  res.status(200).json({ success: true, data });
});

const aiUsageSummary = asyncHandler(async (req, res) => {
  const data = await aiUsage.getSummary({ days: req.query.days });
  res.status(200).json({ success: true, data });
});

const aiPerformance = asyncHandler(async (req, res) => {
  const [feedback, runs] = await Promise.all([
    feedbackMetrics.getMetrics({ days: req.query.days }),
    evaluationService.listRuns(5),
  ]);
  res.status(200).json({ success: true, data: { feedback, evaluations: runs } });
});

const runEvaluation = asyncHandler(async (req, res) => {
  const mode = req.body?.mode === 'live' ? 'live' : 'deterministic';
  const result = await evaluationService.runEvaluation({ mode });
  await auditService.record({ actor: req.user, action: 'AI_EVALUATION_RUN', entityType: 'system', next: { runId: result.runId, mode } });
  res.status(201).json({ success: true, data: result });
});

const evaluationRun = asyncHandler(async (req, res) => {
  const cases = await evaluationService.getRunCases(req.params.runId);
  if (cases.length === 0) throw new AppError('Evaluation run not found.', 404);
  res.status(200).json({ success: true, data: { cases } });
});

const semantic = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) throw new AppError('Search text must be at least 3 characters.', 400);
  const data = await semanticSearch.search(q.slice(0, 500), { limit: req.query.limit });
  res.status(200).json({ success: true, data });
});

// System health for operators: request latency, error counts by kind, job history, AI usage,
// database round-trip. Metrics are per-instance and reset on restart (documented).
const observability = asyncHandler(async (req, res) => {
  const t0 = Date.now();
  let dbOk = true;
  try { await pool.query('SELECT 1'); } catch (err) { dbOk = false; }
  const dbMs = Date.now() - t0;

  const [runs, usage] = await Promise.all([
    scheduler.recentRuns(30).catch(() => []),
    aiUsage.getSummary({ days: 7 }).catch(() => null),
  ]);
  res.status(200).json({
    success: true,
    data: {
      database: { ok: dbOk, roundTripMs: dbMs },
      metrics: metrics.snapshot(),
      jobs: { enabled: env.jobsEnabled, definitions: scheduler.definitions(), recentRuns: runs },
      ai: usage ? { configured: Boolean(env.openai.apiKey), last7Days: usage.totals } : { configured: Boolean(env.openai.apiKey), last7Days: null },
      notifications: { channels: notificationService.enabledChannels() },
      note: 'Request/error metrics are in-process and reset when the server restarts; durable history is in ai_usage, job_runs and audit_logs.',
    },
  });
});

const runJob = asyncHandler(async (req, res) => {
  const outcome = await scheduler.runNow(req.params.name);
  if (outcome === null) throw new AppError('Unknown job.', 404);
  await auditService.record({ actor: req.user, action: 'JOB_TRIGGERED', entityType: 'system', entityId: req.params.name });
  res.status(200).json({ success: true, data: outcome });
});

// ---- SLA ---------------------------------------------------------------------------------

const slaOverview = asyncHandler(async (req, res) => {
  await escalationService.runSlaEscalationCheck();
  const [summary, policies, [atRisk], [resolved]] = await Promise.all([
    analyticsService.getSlaSummary(),
    slaPolicyService.listPolicies(),
    pool.query(
      `SELECT c.id, c.complaint_number, c.category, c.priority_level, c.status, c.sla_status, c.sla_deadline, c.sla_hours, c.created_at, c.resolved_at,
              d.name AS department_name
       FROM complaints c LEFT JOIN departments d ON d.id = c.department_id
       WHERE c.status NOT IN ('RESOLVED', 'REJECTED') AND c.sla_status IN ('APPROACHING', 'BREACHED')
       ORDER BY FIELD(c.sla_status, 'BREACHED', 'APPROACHING'), c.sla_deadline ASC LIMIT 100`
    ),
    pool.query(
      `SELECT SUM(sla_status = 'COMPLETED_WITHIN_SLA') AS within_sla, SUM(sla_status = 'COMPLETED_AFTER_SLA') AS after_sla,
              AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) AS avg_hours
       FROM complaints WHERE status = 'RESOLVED'`
    ),
  ]);
  const within = Number(resolved[0]?.within_sla || 0);
  const after = Number(resolved[0]?.after_sla || 0);
  res.status(200).json({
    success: true,
    data: {
      summary,
      policies,
      atRisk: atRisk.map((c) => ({ ...c, sla: slaService.slaSnapshot(c) })),
      resolved: {
        withinSla: within,
        afterSla: after,
        compliance: within + after > 0 ? Number((within / (within + after)).toFixed(3)) : null,
        avgResolutionHours: resolved[0]?.avg_hours === null || resolved[0]?.avg_hours === undefined ? null : Number(Number(resolved[0].avg_hours).toFixed(1)),
      },
    },
  });
});

const upsertSlaPolicy = asyncHandler(async (req, res) => {
  const { priority_level, category, target_hours, warning_pct, is_active } = req.body;
  const before = (await slaPolicyService.listPolicies()).find((p) => p.priority_level === priority_level && p.category_key === (category || '*'));
  const policy = await slaPolicyService.upsertPolicy({
    priorityLevel: priority_level,
    categoryKey: category || '*',
    targetHours: Number(target_hours),
    warningPct: warning_pct === undefined ? 0.8 : Number(warning_pct),
    isActive: is_active !== false,
  });
  await auditService.record({ actor: req.user, action: 'SLA_POLICY_CHANGED', entityType: 'sla_policy', entityId: policy.id, previous: before ? { targetHours: before.target_hours, warningPct: before.warning_pct } : null, next: { priority_level, category: category || '*', targetHours: policy.target_hours, warningPct: policy.warning_pct } });
  res.status(200).json({ success: true, data: { policy } });
});

// ---- Escalations -------------------------------------------------------------------------

const listEscalations = asyncHandler(async (req, res) => {
  const [events, summary] = await Promise.all([
    escalationEventModel.list({ status: req.query.status, ruleCode: req.query.rule, limit: req.query.limit }),
    escalationEventModel.summary(),
  ]);
  res.status(200).json({ success: true, data: { events, summary } });
});

const acknowledgeEscalation = asyncHandler(async (req, res) => {
  const ok = await escalationEventModel.acknowledge(req.params.id, req.user.id);
  if (!ok) throw new AppError('Escalation not found or already handled.', 404);
  await auditService.record({ actor: req.user, action: 'ESCALATION_ACKNOWLEDGED', entityType: 'escalation', entityId: req.params.id });
  res.status(200).json({ success: true, data: { acknowledged: true } });
});

const runEscalations = asyncHandler(async (req, res) => {
  const result = await escalationEngine.runEscalationRules();
  res.status(200).json({ success: true, data: result });
});

module.exports = {
  auditLogs, aiUsageSummary, aiPerformance, runEvaluation, evaluationRun, semantic, observability, runJob,
  slaOverview, upsertSlaPolicy, listEscalations, acknowledgeEscalation, runEscalations,
};
