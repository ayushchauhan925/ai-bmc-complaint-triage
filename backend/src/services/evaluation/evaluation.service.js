const path = require('path');
const crypto = require('crypto');
const Jimp = require('jimp');
const { pool } = require('../../config/db');
const { CATEGORY_TO_DEPARTMENT, DEPARTMENT_CODES, DUPLICATE_DETECTION, EVIDENCE } = require('../../utils/constants');
const { sanitizeComplaintText } = require('../ai/aiSafety');
const { validateAnalysisResponse } = require('../ai/aiResponseParser');
const decisionEngine = require('../decision/decisionEngine.service');
const complaintAnalysis = require('../ai/complaintAnalysis.service');
const imageIntelligence = require('../image/imageIntelligence.service');
const { duplicateProbability, sameCategoryFamily, isLinkable } = require('../duplicate/duplicateDetection.service');
const { textSimilarity } = require('../../utils/textSimilarity');
const env = require('../../config/env');

const dataset = require(path.join(__dirname, '../../../evals/dataset.json'));

const asList = (v) => (Array.isArray(v) ? v : [v]);

/**
 * AI evaluation framework: labelled cases are run through the system and compared with the
 * expected result, so quality is measured rather than asserted.
 *
 * Modes
 *  - deterministic (default; no OpenAI needed): routing, priority engine, duplicate scoring
 *    (text/geo/time path), prompt-injection detection, AI-output validation, local image
 *    metrics. Guards the rule-based parts against regressions.
 *  - live: additionally sends the classification cases to the real model and scores category
 *    agreement and summary relevance. Costs a few cents; requires OPENAI_API_KEY.
 *
 * A task that cannot run is reported as "skipped" with the reason - it is never counted as
 * agreement. Human corrections from production are reported separately (feedbackMetrics).
 */

// ---- deterministic tasks -----------------------------------------------------------------

function runRouting() {
  return dataset.routing.map((c) => {
    const actual = CATEGORY_TO_DEPARTMENT[c.category] || DEPARTMENT_CODES.GENERAL;
    return { task: 'routing', caseId: c.id, expected: c.expected, actual, agreed: actual === c.expected, confidence: null };
  });
}

function runPriority() {
  return dataset.priority.map((c) => {
    const ai = { severity_signals: c.signals, risk_indicators: [], urgency: 'NORMAL', confidence: 0.9, location_relevance: 'CLEAR', moderation: {} };
    const d = decisionEngine.decide({ category: c.category, ai, evidence: { band: 'MODERATE', score: 60 }, relatedCount: c.related, createdAt: new Date() });
    return { task: 'priority', caseId: c.id, expected: c.expected, actual: d.priority.level, agreed: asList(c.expected).includes(d.priority.level), confidence: null };
  });
}

function runDuplicates() {
  return dataset.duplicate.map((c) => {
    const textScore = textSimilarity(c.a, c.b);
    const distanceScore = Math.max(0, 1 - c.distanceMeters / DUPLICATE_DETECTION.searchRadiusMeters);
    const timeScore = Math.max(0, 1 - c.hoursApart / DUPLICATE_DETECTION.timeWindowHours);
    const categoryMatch = sameCategoryFamily(c.categoryA, c.categoryB);
    const p = duplicateProbability({ semanticScore: null, textScore, distanceScore, timeScore, categoryMatch, imageSimilarity: null });
    const predicted = isLinkable({ method: 'text', duplicateProbability: p, categoryMatch, distanceMeters: c.distanceMeters });
    return { task: 'duplicate', caseId: c.id, expected: c.expected, actual: { predicted, probability: p }, agreed: predicted === c.expected, confidence: p };
  });
}

function runSafety() {
  return dataset.safety.map((c) => {
    const actual = sanitizeComplaintText(c.text).injectionSuspected;
    return { task: 'safety', caseId: c.id, expected: c.expected, actual, agreed: actual === c.expected, confidence: null };
  });
}

function runValidation() {
  return dataset.validation.map((c) => {
    const r = validateAnalysisResponse(c.raw);
    const actual = { success: r.success };
    let agreed = r.success === c.expected.success;
    if (r.success) {
      if (c.expected.category) { actual.category = r.data.category; agreed = agreed && r.data.category === c.expected.category; }
      if (c.expected.urgency) { actual.urgency = r.data.urgency; agreed = agreed && r.data.urgency === c.expected.urgency; }
      if (c.expected.summaryHasNoTags) { actual.summaryHasNoTags = !/[<>]/.test(r.data.summary); agreed = agreed && actual.summaryHasNoTags; }
    }
    return { task: 'validation', caseId: c.id, expected: c.expected, actual, agreed, confidence: null };
  });
}

async function makeCheckerImage(size = 128) {
  const img = new Jimp(size, size, 0xffffffff);
  img.scan(0, 0, size, size, function pixel(x, y, idx) {
    const v = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 20 : 235;
    this.bitmap.data[idx] = v; this.bitmap.data[idx + 1] = v; this.bitmap.data[idx + 2] = v;
  });
  return img;
}

// A smooth "scene" (gradients + a dark block) - much closer to a real photo than a checkerboard,
// which is a pathological case for a difference hash.
async function makeSceneImage(size = 128) {
  const img = new Jimp(size, size, 0xffffffff);
  img.scan(0, 0, size, size, function pixel(x, y, idx) {
    let v = 110 + 90 * Math.sin(x / 19) * Math.cos(y / 27);
    if (x > 30 && x < 80 && y > 60 && y < 100) v = 25;
    if ((x - 96) ** 2 + (y - 32) ** 2 < 300) v = 240;
    v = Math.max(0, Math.min(255, v));
    this.bitmap.data[idx] = v; this.bitmap.data[idx + 1] = v; this.bitmap.data[idx + 2] = v;
  });
  return img;
}

async function makeStripesImage(size = 128) {
  const img = new Jimp(size, size, 0xffffffff);
  img.scan(0, 0, size, size, function pixel(x, y, idx) {
    const v = Math.floor((x + y) / 12) % 2 === 0 ? 30 : 220;
    this.bitmap.data[idx] = v; this.bitmap.data[idx + 1] = v; this.bitmap.data[idx + 2] = v;
  });
  return img;
}

async function runImage() {
  const results = [];
  for (const c of dataset.image) {
    try {
      if (c.kind === 'quality') {
        const base = await makeCheckerImage();
        const img = c.blur > 0 ? base.blur(c.blur) : base;
        const m = await imageIntelligence.analyzeBuffer(await img.getBufferAsync(Jimp.MIME_PNG));
        const blurry = m.analysed ? m.blurScore < EVIDENCE.blurThreshold : null;
        results.push({ task: 'image', caseId: c.id, expected: c.expected, actual: { blurry, blurScore: m.blurScore }, agreed: blurry === c.expected.blurry, confidence: null });
      } else {
        const a = await imageIntelligence.analyzeBuffer(await (await makeSceneImage()).getBufferAsync(Jimp.MIME_PNG));
        const variantImg = c.variant === 'brighter' ? (await makeSceneImage()).brightness(0.08) : await makeStripesImage();
        const b = await imageIntelligence.analyzeBuffer(await variantImg.getBufferAsync(Jimp.MIME_PNG));
        const sim = a.analysed && b.analysed ? imageIntelligence.hashSimilarity(a.phash, b.phash) : null;
        const similar = sim === null ? null : sim >= DUPLICATE_DETECTION.imageDuplicateSimilarity;
        results.push({ task: 'image', caseId: c.id, expected: c.expected, actual: { similar, similarity: sim }, agreed: similar === c.expected.similar, confidence: sim });
      }
    } catch (err) {
      results.push({ task: 'image', caseId: c.id, expected: c.expected, actual: { error: err.message }, agreed: false, confidence: null });
    }
  }
  return results;
}

// ---- live (LLM) tasks --------------------------------------------------------------------

async function runLiveClassification() {
  if (!env.openai.apiKey) {
    return { skipped: [{ task: 'classification', reason: 'OPENAI_API_KEY not configured.' }, { task: 'summarization', reason: 'OPENAI_API_KEY not configured.' }], results: [] };
  }
  const results = [];
  for (const c of dataset.classification) {
    const r = await complaintAnalysis.analyzeComplaint({ description: c.text, imageUrls: [] });
    if (!r.success) {
      results.push({ task: 'classification', caseId: c.id, expected: c.expected, actual: { error: r.failureReason }, agreed: false, confidence: null });
      results.push({ task: 'summarization', caseId: c.id, expected: c.keywords, actual: { error: r.failureReason }, agreed: false, confidence: null });
      continue;
    }
    const a = r.analysis;
    results.push({ task: 'classification', caseId: c.id, expected: c.expected, actual: a.category, agreed: asList(c.expected).includes(a.category), confidence: a.confidence });
    const summary = `${a.summary} ${a.title}`.toLowerCase();
    const hit = c.keywords.some((k) => summary.includes(k));
    results.push({ task: 'summarization', caseId: c.id, expected: c.keywords, actual: a.summary, agreed: hit, confidence: a.confidence });
  }
  return { skipped: [], results };
}

// ---- runner ------------------------------------------------------------------------------

function summarize(results, skipped) {
  const tasks = {};
  for (const r of results) {
    tasks[r.task] = tasks[r.task] || { total: 0, agreed: 0 };
    tasks[r.task].total += 1;
    if (r.agreed) tasks[r.task].agreed += 1;
  }
  const out = Object.entries(tasks).map(([task, t]) => ({
    task, total: t.total, agreed: t.agreed, accuracy: Number((t.agreed / t.total).toFixed(3)), status: 'ran',
  }));
  for (const s of skipped) out.push({ task: s.task, total: 0, agreed: 0, accuracy: null, status: 'skipped', reason: s.reason });
  return out;
}

async function runEvaluation({ mode = 'deterministic', store = true } = {}) {
  const runId = crypto.randomBytes(6).toString('hex');
  const started = Date.now();
  let results = [...runRouting(), ...runPriority(), ...runDuplicates(), ...runSafety(), ...runValidation(), ...(await runImage())];
  let skipped = [];

  if (mode === 'live') {
    const live = await runLiveClassification();
    results = results.concat(live.results);
    skipped = live.skipped;
  } else {
    skipped = [
      { task: 'classification', reason: 'Requires a live model call - run in live mode.' },
      { task: 'summarization', reason: 'Requires a live model call - run in live mode.' },
    ];
  }

  if (store && results.length > 0) {
    const rows = results.map((r) => [runId, mode, r.task, r.caseId, JSON.stringify(r.expected ?? null), JSON.stringify(r.actual ?? null), r.agreed ? 1 : 0, r.confidence]);
    await pool.query('INSERT INTO ai_evaluations (run_id, mode, task, case_id, expected, actual, agreed, confidence) VALUES ?', [rows]);
  }

  return { runId, mode, durationMs: Date.now() - started, summary: summarize(results, skipped), cases: results };
}

/** Recent stored runs with per-task accuracy, for trend display. */
async function listRuns(limit = 10) {
  const [rows] = await pool.query(
    `SELECT run_id, mode, MIN(created_at) AS at, COUNT(*) AS cases, SUM(agreed) AS agreed
     FROM ai_evaluations GROUP BY run_id, mode ORDER BY MIN(id) DESC LIMIT ?`,
    [limit]
  );
  const runs = [];
  for (const r of rows) {
    const [tasks] = await pool.query(
      'SELECT task, COUNT(*) AS total, SUM(agreed) AS agreed FROM ai_evaluations WHERE run_id = ? GROUP BY task',
      [r.run_id]
    );
    runs.push({
      runId: r.run_id, mode: r.mode, at: r.at, cases: Number(r.cases), agreed: Number(r.agreed),
      tasks: tasks.map((t) => ({ task: t.task, total: Number(t.total), agreed: Number(t.agreed), accuracy: Number((Number(t.agreed) / Number(t.total)).toFixed(3)) })),
    });
  }
  return runs;
}

async function getRunCases(runId) {
  const [rows] = await pool.query('SELECT task, case_id, expected, actual, agreed, confidence FROM ai_evaluations WHERE run_id = ? ORDER BY id', [runId]);
  return rows;
}

module.exports = { runEvaluation, listRuns, getRunCases };
