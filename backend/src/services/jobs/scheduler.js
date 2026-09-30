const { pool } = require('../../config/db');
const escalationService = require('../complaint/escalation.service');
const escalationEngine = require('../complaint/escalationEngine.service');
const anomalyService = require('../analytics/anomaly.service');
const { runAnalysisPipeline } = require('../complaint/analysisPipeline.service');
const metrics = require('../observability/metrics.service');
const logger = require('../../utils/logger');

const MINUTE = 60 * 1000;
const MAX_AI_ATTEMPTS = 4; // initial run + 3 retries

/** Re-runs the pipeline for complaints whose AI analysis failed (outage, malformed output). */
async function retryFailedAnalyses() {
  const [rows] = await pool.query(
    `SELECT id FROM complaints
     WHERE ai_analysis_failed = TRUE AND ai_attempts < ? AND review_status = 'PENDING'
       AND status NOT IN ('RESOLVED', 'REJECTED')
       AND updated_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
     ORDER BY id LIMIT 5`,
    [MAX_AI_ATTEMPTS]
  );
  let recovered = 0;
  for (const { id } of rows) {
    const result = await runAnalysisPipeline(id);
    if (result && !result.ai_analysis_failed) recovered += 1;
  }
  return { attempted: rows.length, recovered };
}

const JOBS = [
  { name: 'sla_check', everyMs: 5 * MINUTE, run: () => escalationService.runSlaEscalationCheck() },
  { name: 'escalation_rules', everyMs: 10 * MINUTE, run: () => escalationEngine.runEscalationRules() },
  {
    name: 'anomaly_scan',
    everyMs: 15 * MINUTE,
    run: async () => {
      const r = await anomalyService.detectAnomalies({ force: true });
      return { anomalies: r.anomalies.length, sufficientData: r.sufficientData };
    },
  },
  { name: 'ai_retry', everyMs: 10 * MINUTE, run: retryFailedAnalyses },
];

const running = new Set();
const timers = [];

/** Runs one job with an overlap guard; outcome is stored in job_runs and never throws. */
async function runJob(job) {
  if (running.has(job.name)) return { skipped: true };
  running.add(job.name);
  const startedAt = Date.now();
  try {
    const details = await job.run();
    const durationMs = Date.now() - startedAt;
    metrics.increment(`jobs.${job.name}.success`);
    metrics.observeLatency(`job.${job.name}`, durationMs);
    await pool
      .query('INSERT INTO job_runs (job_name, status, duration_ms, details) VALUES (?, ?, ?, ?)', [job.name, 'SUCCESS', durationMs, JSON.stringify(details ?? null)])
      .catch(() => {});
    return { ok: true, details };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    metrics.increment(`jobs.${job.name}.failed`);
    metrics.recordError('job', `${job.name}: ${err.message}`);
    logger.error('Background job failed.', { job: job.name, error: err.message });
    await pool
      .query('INSERT INTO job_runs (job_name, status, duration_ms, error_message) VALUES (?, ?, ?, ?)', [job.name, 'FAILED', durationMs, String(err.message).slice(0, 255)])
      .catch(() => {});
    return { ok: false, error: err.message };
  } finally {
    running.delete(job.name);
  }
}

function start() {
  if (timers.length > 0) return;
  JOBS.forEach((job, index) => {
    // Stagger first runs so the jobs do not all hit the database at boot.
    const first = setTimeout(() => runJob(job), 30 * 1000 + index * 15 * 1000);
    const interval = setInterval(() => runJob(job), job.everyMs);
    first.unref();
    interval.unref();
    timers.push(first, interval);
  });
  logger.info('Background jobs scheduled.', { jobs: JOBS.map((j) => `${j.name}/${j.everyMs / MINUTE}m`) });
}

function stop() {
  timers.splice(0).forEach((t) => {
    clearTimeout(t);
    clearInterval(t);
  });
}

async function runNow(name) {
  const job = JOBS.find((j) => j.name === name);
  if (!job) return null;
  return runJob(job);
}

async function recentRuns(limit = 50) {
  const [rows] = await pool.query('SELECT * FROM job_runs ORDER BY id DESC LIMIT ?', [limit]);
  return rows;
}

function definitions() {
  return JOBS.map((j) => ({ name: j.name, everyMinutes: j.everyMs / MINUTE, running: running.has(j.name) }));
}

module.exports = { start, stop, runNow, recentRuns, definitions, retryFailedAnalyses };
