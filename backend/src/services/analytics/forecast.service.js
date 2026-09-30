const { pool } = require('../../config/db');
const { FORECAST } = require('../../utils/constants');

/**
 * Short-term forecasting with Holt's linear (double exponential smoothing) method - level +
 * trend, no seasonality. Deliberately simple and explainable: with weeks (not years) of
 * municipal data a heavier model would be fitting noise. Prediction intervals come from the
 * spread of the model's own one-step-ahead errors.
 *
 * A forecast is only produced when there is enough history (length AND non-zero days);
 * otherwise the function says so - it never extrapolates from a handful of points.
 */
function holtForecast(series, horizon = FORECAST.horizonDays, opts = {}) {
  const cfg = { ...FORECAST, ...opts };
  const n = series.length;
  const active = series.filter((v) => v > 0).length;

  if (n < cfg.minHistoryDays) {
    return { available: false, reason: `Need at least ${cfg.minHistoryDays} days of history; ${n} available.`, historyDays: n };
  }
  if (active < cfg.minActiveDays) {
    return { available: false, reason: `Need at least ${cfg.minActiveDays} days with activity; ${active} available.`, historyDays: n };
  }

  const fit = (data) => {
    let level = data[0];
    const k = Math.min(7, data.length - 1);
    let trend = k > 0 ? (data[k] - data[0]) / k : 0;
    const errors = [];
    for (let t = 1; t < data.length; t += 1) {
      const predicted = level + trend;
      errors.push(data[t] - predicted);
      const prevLevel = level;
      level = cfg.alpha * data[t] + (1 - cfg.alpha) * (level + trend);
      trend = cfg.beta * (level - prevLevel) + (1 - cfg.beta) * trend;
    }
    return { level, trend, errors };
  };

  const { level, trend, errors } = fit(series);
  const sigma = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / Math.max(errors.length, 1));

  const forecast = [];
  for (let h = 1; h <= horizon; h += 1) {
    const value = Math.max(0, level + h * trend);
    const width = cfg.intervalZ * sigma * Math.sqrt(h);
    forecast.push({
      step: h,
      value: Number(value.toFixed(1)),
      lower: Number(Math.max(0, value - width).toFixed(1)),
      upper: Number((value + width).toFixed(1)),
    });
  }

  // Honest quality check: hold out the last 7 days, forecast them from the earlier data, and
  // compare against the naive "same as the last week's average" baseline.
  let backtest = null;
  if (n >= cfg.minHistoryDays + 7) {
    const train = series.slice(0, n - 7);
    const test = series.slice(n - 7);
    const m = fit(train);
    const holtMae = test.reduce((s, v, i) => s + Math.abs(v - Math.max(0, m.level + (i + 1) * m.trend)), 0) / 7;
    const naive = train.slice(-7).reduce((s, v) => s + v, 0) / 7;
    const naiveMae = test.reduce((s, v) => s + Math.abs(v - naive), 0) / 7;
    backtest = { holdoutDays: 7, maeModel: Number(holtMae.toFixed(2)), maeNaive: Number(naiveMae.toFixed(2)), beatsNaive: holtMae <= naiveMae };
  }

  return {
    available: true,
    method: "Holt's linear trend (double exponential smoothing)",
    historyDays: n,
    horizonDays: horizon,
    intervalNote: 'Approximate 80% prediction interval from in-sample one-step errors.',
    forecast,
    residualStd: Number(sigma.toFixed(2)),
    backtest,
  };
}

// --- data access ------------------------------------------------------------------------

function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function eachDay(from, to) {
  const days = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur <= end) {
    days.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Daily history for `where` (created counts), starting at the later of the window start and the first record. */
async function dailyCreated({ where = '', params = [], days = FORECAST.historyDays }) {
  const [[bounds]] = await pool.query(`SELECT MIN(created_at) AS first FROM complaints ${where ? `WHERE ${where}` : ''}`, params);
  if (!bounds.first) return { dates: [], values: [] };
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - days);
  const start = new Date(Math.max(new Date(bounds.first).getTime(), windowStart.getTime()));
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM complaints
     WHERE created_at >= ? ${where ? `AND ${where}` : ''} GROUP BY DATE(created_at)`,
    [new Date(start.getFullYear(), start.getMonth(), start.getDate()), ...params]
  );
  const counts = new Map(rows.map((r) => [dayKey(r.d), Number(r.cnt)]));
  // Exclude today: it is incomplete and would drag the trend down.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dates = eachDay(start, yesterday);
  return { dates, values: dates.map((d) => counts.get(d) || 0) };
}

/** Open (unresolved) complaints at the end of each day. REJECTED complaints are excluded. */
async function dailyBacklog({ days = FORECAST.historyDays } = {}) {
  const created = await dailyCreated({ where: "status <> 'REJECTED'", days });
  if (created.dates.length === 0) return created;
  const startDate = new Date(`${created.dates[0]}T00:00:00`);
  const [[open0]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM complaints
     WHERE status <> 'REJECTED' AND created_at < ? AND (resolved_at IS NULL OR resolved_at >= ?)`,
    [startDate, startDate]
  );
  const [resolved] = await pool.query(
    `SELECT DATE(resolved_at) AS d, COUNT(*) AS cnt FROM complaints
     WHERE status = 'RESOLVED' AND resolved_at >= ? GROUP BY DATE(resolved_at)`,
    [startDate]
  );
  const resolvedByDay = new Map(resolved.map((r) => [dayKey(r.d), Number(r.cnt)]));
  let open = Number(open0.cnt);
  const values = created.dates.map((d, i) => {
    open += created.values[i] - (resolvedByDay.get(d) || 0);
    return Math.max(open, 0);
  });
  return { dates: created.dates, values };
}

function withSeries(model, history) {
  return { ...model, history: history.dates.map((date, i) => ({ date, value: history.values[i] })) };
}

/** Forecast bundle: overall volume, top categories, per-department workload and open backlog. */
async function getForecasts({ horizon = FORECAST.horizonDays } = {}) {
  const overallHist = await dailyCreated({});
  const overall = withSeries(holtForecast(overallHist.values, horizon), overallHist);

  const [topCats] = await pool.query(
    `SELECT category, COUNT(*) AS cnt FROM complaints
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY category ORDER BY cnt DESC LIMIT 5`,
    [FORECAST.historyDays]
  );
  const categories = [];
  for (const c of topCats) {
    const hist = await dailyCreated({ where: 'category = ?', params: [c.category] });
    categories.push({ category: c.category, ...withSeries(holtForecast(hist.values, horizon), hist) });
  }

  const [depts] = await pool.query(
    `SELECT d.id, d.name, COUNT(c.id) AS cnt FROM departments d
     JOIN complaints c ON c.department_id = d.id
     WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY d.id, d.name ORDER BY cnt DESC LIMIT 6`,
    [FORECAST.historyDays]
  );
  const departments = [];
  for (const d of depts) {
    const hist = await dailyCreated({ where: 'department_id = ?', params: [d.id] });
    departments.push({ departmentId: d.id, department: d.name, ...withSeries(holtForecast(hist.values, horizon), hist) });
  }

  const backlogHist = await dailyBacklog({});
  const backlog = withSeries(holtForecast(backlogHist.values, horizon), backlogHist);

  return {
    generatedAt: new Date().toISOString(),
    horizonDays: horizon,
    overall,
    categories,
    departments,
    unresolved: backlog,
    note: 'Statistical extrapolation of recent history, not a guarantee. Shown only where enough history exists.',
  };
}

module.exports = { holtForecast, getForecasts };
