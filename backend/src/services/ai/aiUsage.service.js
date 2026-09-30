const { pool } = require('../../config/db');
const metrics = require('../observability/metrics.service');
const logger = require('../../utils/logger');

// Approximate public list prices in USD per 1M tokens. These are ESTIMATES used for
// relative cost monitoring only - not billing. Unknown models report a null cost rather
// than a guess. Override/extend here when models or prices change.
const PRICING_PER_MILLION = [
  { match: /^gpt-4o-mini/, input: 0.15, output: 0.6 },
  { match: /^gpt-4o/, input: 2.5, output: 10 },
  { match: /^gpt-4\.1-mini/, input: 0.4, output: 1.6 },
  { match: /^gpt-4\.1/, input: 2, output: 8 },
  { match: /^text-embedding-3-small/, input: 0.02, output: 0 },
  { match: /^text-embedding-3-large/, input: 0.13, output: 0 },
];

function estimateCostUsd(model, promptTokens, completionTokens) {
  if (promptTokens == null && completionTokens == null) return null;
  const price = PRICING_PER_MILLION.find((p) => p.match.test(model || ''));
  if (!price) return null;
  return ((promptTokens || 0) * price.input + (completionTokens || 0) * price.output) / 1e6;
}

/** Fire-and-forget usage row; never throws and never blocks the AI call's caller. */
function record({ useCase, model, usage, latencyMs, success, error }) {
  metrics.increment(`ai.requests.${useCase}`);
  metrics.observeLatency(`ai.${useCase}`, latencyMs);
  if (!success) {
    metrics.recordError('ai', error || 'AI call failed', { useCase, model });
  }

  const promptTokens = usage?.prompt_tokens ?? null;
  const completionTokens = usage?.completion_tokens ?? null;
  const totalTokens = usage?.total_tokens ?? null;
  const cost = estimateCostUsd(model, promptTokens, completionTokens);

  pool
    .query(
      `INSERT INTO ai_usage
         (use_case, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, latency_ms, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        useCase,
        model || 'unknown',
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        Math.round(latencyMs),
        success ? 1 : 0,
        error ? String(error).slice(0, 255) : null,
      ]
    )
    .catch((err) => logger.warn('Failed to record AI usage.', { error: err.message }));
}

async function getSummary({ days = 30 } = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const [byUseCase] = await pool.query(
    `SELECT use_case, COUNT(*) AS requests, SUM(success = 0) AS failures,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
            AVG(latency_ms) AS avg_latency_ms
     FROM ai_usage WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY use_case ORDER BY estimated_cost_usd DESC, requests DESC`,
    [safeDays]
  );
  const [byModel] = await pool.query(
    `SELECT model, COUNT(*) AS requests, COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
     FROM ai_usage WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY model`,
    [safeDays]
  );
  const [daily] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS requests,
            COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
     FROM ai_usage WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at) ORDER BY date`,
    [safeDays]
  );

  const num = (v) => (v === null || v === undefined ? 0 : Number(v));
  const useCases = byUseCase.map((r) => ({
    useCase: r.use_case,
    requests: num(r.requests),
    failures: num(r.failures),
    failureRate: r.requests > 0 ? Number((num(r.failures) / num(r.requests)).toFixed(3)) : 0,
    totalTokens: num(r.total_tokens),
    estimatedCostUsd: Number(num(r.estimated_cost_usd).toFixed(6)),
    avgLatencyMs: Math.round(num(r.avg_latency_ms)),
  }));
  const totalRequests = useCases.reduce((s, r) => s + r.requests, 0);
  const totalFailures = useCases.reduce((s, r) => s + r.failures, 0);

  return {
    windowDays: safeDays,
    totals: {
      requests: totalRequests,
      failures: totalFailures,
      failureRate: totalRequests ? Number((totalFailures / totalRequests).toFixed(3)) : 0,
      totalTokens: useCases.reduce((s, r) => s + r.totalTokens, 0),
      estimatedCostUsd: Number(useCases.reduce((s, r) => s + r.estimatedCostUsd, 0).toFixed(6)),
    },
    byUseCase: useCases,
    byModel: byModel.map((r) => ({
      model: r.model,
      requests: num(r.requests),
      totalTokens: num(r.total_tokens),
      estimatedCostUsd: Number(num(r.estimated_cost_usd).toFixed(6)),
    })),
    daily: daily.map((r) => ({
      date: r.date,
      requests: num(r.requests),
      estimatedCostUsd: Number(num(r.estimated_cost_usd).toFixed(6)),
    })),
    costNote: 'Costs are estimates from public list prices and reported token usage; not billing data.',
  };
}

module.exports = { record, getSummary, estimateCostUsd };
