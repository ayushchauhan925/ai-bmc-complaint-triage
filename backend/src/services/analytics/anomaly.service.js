const { pool } = require('../../config/db');
const { ANOMALY } = require('../../utils/constants');

/**
 * Statistical anomaly detection. Pure numerics - no LLM anywhere near these numbers.
 *
 * Method: compare the most recent 24 h bucket against the distribution of the preceding
 * daily buckets using a *robust* z-score - (observed - median) / scale, where
 * scale = max(1.4826 * MAD, sqrt(mean), 1). MAD (median absolute deviation) resists the
 * influence of earlier spikes; the sqrt(mean) floor is the Poisson standard deviation, which
 * stops sparse count data (MAD = 0) from producing absurd scores. An anomaly must also clear
 * an absolute minimum count and a minimum ratio over the baseline, so "2 instead of 0" is
 * never reported as a surge.
 */

function median(values) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/**
 * @param {number} observed  count in the most recent bucket
 * @param {number[]} baseline counts of the preceding buckets (only buckets that were observable)
 */
function scoreAgainstBaseline(observed, baseline, opts = {}) {
  const cfg = { ...ANOMALY, ...opts };
  if (baseline.length < cfg.minBaselineDays) {
    return { status: 'insufficient_data', observed, baselineDays: baseline.length, requiredDays: cfg.minBaselineDays };
  }
  const med = median(baseline);
  const mu = mean(baseline);
  const mad = median(baseline.map((v) => Math.abs(v - med)));
  const scale = Math.max(1.4826 * mad, Math.sqrt(mu), 1);
  const score = (observed - med) / scale;
  const ratio = observed / Math.max(mu, 0.5);
  const isAnomaly = score >= cfg.scoreThreshold && observed >= cfg.minObserved && ratio >= cfg.minRatio;
  return {
    status: isAnomaly ? 'anomaly' : 'normal',
    observed,
    baseline: { mean: Number(mu.toFixed(2)), median: med, mad: Number(mad.toFixed(2)), days: baseline.length },
    score: Number(score.toFixed(2)),
    ratio: Number(ratio.toFixed(2)),
  };
}

// --- data access ------------------------------------------------------------------------

async function firstComplaintAt() {
  const [[row]] = await pool.query('SELECT MIN(created_at) AS first FROM complaints');
  return row.first ? new Date(row.first) : null;
}

/** Rolling 24h buckets relative to NOW: bucket 0 = last 24 h, bucket 1 = the 24 h before, ... */
async function bucketedCounts(groupExpr, extraWhere = '', windowBuckets) {
  const [rows] = await pool.query(
    `SELECT ${groupExpr} AS subject, FLOOR(TIMESTAMPDIFF(HOUR, created_at, NOW()) / 24) AS bucket, COUNT(*) AS cnt
     FROM complaints
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR) ${extraWhere}
     GROUP BY subject, bucket`,
    [windowBuckets * 24]
  );
  const bySubject = new Map();
  for (const r of rows) {
    const key = r.subject === null ? '__none__' : String(r.subject);
    if (!bySubject.has(key)) bySubject.set(key, new Array(windowBuckets).fill(0));
    if (r.bucket < windowBuckets) bySubject.get(key)[r.bucket] = Number(r.cnt);
  }
  return bySubject;
}

function titleCase(s) {
  return String(s).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

let cache = { at: 0, value: null };

/**
 * Scans complaint volume across several dimensions and returns the anomalies found plus a
 * per-dimension "insufficient data" note where history is too short - it never guesses.
 */
async function detectAnomalies({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < 60 * 1000) return cache.value;

  const first = await firstComplaintAt();
  const now = Date.now();
  const observableDays = first ? Math.floor((now - first.getTime()) / (24 * 3600 * 1000)) : 0; // completed prior days
  const baselineDays = Math.min(ANOMALY.baselineDays, Math.max(observableDays - 1, 0));
  const windowBuckets = baselineDays + 1;

  const result = {
    generatedAt: new Date(now).toISOString(),
    windowHours: ANOMALY.bucketHours,
    baselineDaysAvailable: baselineDays,
    sufficientData: baselineDays >= ANOMALY.minBaselineDays,
    anomalies: [],
    notes: [],
  };

  if (!result.sufficientData) {
    result.notes.push(
      `Anomaly detection needs at least ${ANOMALY.minBaselineDays} days of complaint history; ${baselineDays} available.`
    );
    cache = { at: Date.now(), value: result };
    return result;
  }

  const windowEnd = new Date(now);
  const windowStart = new Date(now - ANOMALY.bucketHours * 3600 * 1000);
  const win = { from: windowStart.toISOString(), to: windowEnd.toISOString() };

  const evaluate = (series) => scoreAgainstBaseline(series[0], series.slice(1, windowBuckets));

  // Overall volume
  const overall = await bucketedCounts('1', '', windowBuckets);
  const overallSeries = overall.get('1') || new Array(windowBuckets).fill(0);
  const ov = evaluate(overallSeries);
  if (ov.status === 'anomaly') {
    result.anomalies.push({ type: 'VOLUME_SURGE', dimension: 'overall', subject: 'All complaints', label: 'COMPLAINT VOLUME SURGE', ...ov, window: win, explanation: `${ov.observed} complaints in the last 24 h versus a typical ${ov.baseline.median}/day (mean ${ov.baseline.mean}).` });
  }

  // Per category
  for (const [category, series] of await bucketedCounts('category', '', windowBuckets)) {
    const r = evaluate(series);
    if (r.status === 'anomaly') {
      result.anomalies.push({ type: 'CATEGORY_SURGE', dimension: 'category', subject: category, label: `${titleCase(category).toUpperCase()} COMPLAINT SURGE`, category, ...r, window: win, explanation: `${r.observed} ${titleCase(category).toLowerCase()} complaints in the last 24 h versus a typical ${r.baseline.median}/day.` });
    }
  }

  // Per department (incoming workload)
  const [depts] = await pool.query('SELECT id, name FROM departments');
  const deptName = new Map(depts.map((d) => [String(d.id), d.name]));
  for (const [deptId, series] of await bucketedCounts('department_id', 'AND department_id IS NOT NULL', windowBuckets)) {
    const r = evaluate(series);
    if (r.status === 'anomaly') {
      result.anomalies.push({ type: 'DEPARTMENT_SURGE', dimension: 'department', subject: deptName.get(deptId) || deptId, label: `${(deptName.get(deptId) || 'DEPARTMENT').toUpperCase()} WORKLOAD SURGE`, departmentId: Number(deptId), ...r, window: win, explanation: `${r.observed} new complaints routed in the last 24 h versus a typical ${r.baseline.median}/day.` });
    }
  }

  // Geographic: ~1.1 km grid cells
  const cells = await bucketedCounts("CONCAT(ROUND(latitude, 2), ',', ROUND(longitude, 2))", '', windowBuckets);
  for (const [cell, series] of cells) {
    const r = evaluate(series);
    if (r.status === 'anomaly') {
      const [lat, lng] = cell.split(',').map(Number);
      const [[sample]] = await pool.query(
        `SELECT address FROM complaints WHERE ROUND(latitude, 2) = ? AND ROUND(longitude, 2) = ? AND address IS NOT NULL AND address <> '' ORDER BY id DESC LIMIT 1`,
        [lat, lng]
      );
      result.anomalies.push({ type: 'GEO_SURGE', dimension: 'location', subject: sample?.address || `${lat}, ${lng}`, label: 'LOCAL ACTIVITY SURGE', location: { latitude: lat, longitude: lng, approxRadiusMeters: 800 }, ...r, window: win, explanation: `${r.observed} complaints in this ~1 km area in the last 24 h versus a typical ${r.baseline.median}/day.` });
    }
  }

  // Severity: HIGH + CRITICAL volume
  const sev = await bucketedCounts('1', "AND priority_level IN ('HIGH', 'CRITICAL')", windowBuckets);
  const sevSeries = sev.get('1') || new Array(windowBuckets).fill(0);
  const sv = evaluate(sevSeries);
  if (sv.status === 'anomaly') {
    result.anomalies.push({ type: 'SEVERITY_SURGE', dimension: 'severity', subject: 'High/critical complaints', label: 'HIGH-SEVERITY SURGE', ...sv, window: win, explanation: `${sv.observed} high/critical complaints in the last 24 h versus a typical ${sv.baseline.median}/day.` });
  }

  // Resolution time: mean hours-to-resolve per day, compared with earlier days that had resolutions.
  const [resRows] = await pool.query(
    `SELECT FLOOR(TIMESTAMPDIFF(HOUR, resolved_at, NOW()) / 24) AS bucket, COUNT(*) AS cnt,
            AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) AS avg_hours
     FROM complaints WHERE status = 'RESOLVED' AND resolved_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     GROUP BY bucket`,
    [windowBuckets * 24]
  );
  const todayRes = resRows.find((r) => Number(r.bucket) === 0);
  const priorAvgs = resRows.filter((r) => Number(r.bucket) > 0 && Number(r.cnt) >= 1).map((r) => Number(r.avg_hours));
  if (todayRes && Number(todayRes.cnt) >= 3) {
    if (priorAvgs.length < ANOMALY.minBaselineDays) {
      result.notes.push('Resolution-time anomaly check skipped: not enough earlier days with resolved complaints.');
    } else {
      const obs = Number(todayRes.avg_hours);
      const med = median(priorAvgs);
      const mad = median(priorAvgs.map((v) => Math.abs(v - med)));
      const scale = Math.max(1.4826 * mad, med * 0.1, 1);
      const score = (obs - med) / scale;
      if (score >= ANOMALY.scoreThreshold && obs >= med * ANOMALY.minRatio) {
        result.anomalies.push({ type: 'RESOLUTION_SLOWDOWN', dimension: 'resolution_time', subject: 'Resolution time', label: 'RESOLUTION SLOWDOWN', status: 'anomaly', observed: Number(obs.toFixed(1)), baseline: { median: Number(med.toFixed(1)), mad: Number(mad.toFixed(1)), days: priorAvgs.length }, score: Number(score.toFixed(2)), ratio: Number((obs / Math.max(med, 0.5)).toFixed(2)), window: win, explanation: `Complaints resolved in the last 24 h took ${obs.toFixed(1)} h on average versus a typical ${med.toFixed(1)} h.` });
      }
    }
  }

  result.anomalies.sort((a, b) => b.score - a.score);
  cache = { at: Date.now(), value: result };
  return result;
}

module.exports = { detectAnomalies, scoreAgainstBaseline, median };
