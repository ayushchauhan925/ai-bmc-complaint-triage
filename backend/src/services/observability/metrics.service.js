// Lightweight in-process metrics: counters, latency summaries and a bounded ring buffer of
// recent errors. Deliberately dependency-free (no Prometheus/Redis) - it resets on restart
// and is per-instance, which is documented. Durable history lives in ai_usage / job_runs /
// audit_logs. Nothing recorded here may contain secrets or request bodies.

const MAX_RECENT_ERRORS = 50;
const MAX_LATENCY_SAMPLES = 500;

const state = {
  startedAt: Date.now(),
  counters: new Map(),
  latency: new Map(), // key -> { count, sum, max, samples[] }
  recentErrors: [],
};

function increment(name, by = 1) {
  state.counters.set(name, (state.counters.get(name) || 0) + by);
}

function observeLatency(name, ms) {
  let entry = state.latency.get(name);
  if (!entry) {
    entry = { count: 0, sum: 0, max: 0, samples: [] };
    state.latency.set(name, entry);
  }
  entry.count += 1;
  entry.sum += ms;
  entry.max = Math.max(entry.max, ms);
  entry.samples.push(ms);
  if (entry.samples.length > MAX_LATENCY_SAMPLES) entry.samples.shift();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// kind: api | ai | database | external | image | job
function recordError(kind, message, meta = {}) {
  increment(`errors.${kind}`);
  state.recentErrors.unshift({
    kind,
    message: String(message).slice(0, 300),
    meta,
    at: new Date().toISOString(),
  });
  if (state.recentErrors.length > MAX_RECENT_ERRORS) state.recentErrors.pop();
}

function snapshot() {
  const latency = {};
  for (const [name, entry] of state.latency.entries()) {
    const sorted = [...entry.samples].sort((a, b) => a - b);
    latency[name] = {
      count: entry.count,
      avgMs: Number((entry.sum / entry.count).toFixed(1)),
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      maxMs: Math.round(entry.max),
    };
  }
  return {
    startedAt: new Date(state.startedAt).toISOString(),
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    counters: Object.fromEntries(state.counters.entries()),
    latency,
    recentErrors: state.recentErrors,
  };
}

function reset() {
  state.counters.clear();
  state.latency.clear();
  state.recentErrors.length = 0;
}

module.exports = { increment, observeLatency, recordError, snapshot, reset };
