const Jimp = require('jimp');
const { pool } = require('../../config/db');
const { readDimensions } = require('../../utils/imageFormat');
const { haversineDistanceMeters } = require('../../utils/vectorMath');
const { DUPLICATE_DETECTION } = require('../../utils/constants');
const logger = require('../../utils/logger');
const metrics = require('../observability/metrics.service');

// Refuse to decode absurdly large images (decompression-bomb guard) - the upload itself is
// still accepted; only the local analysis is skipped.
const MAX_PIXELS = 40 * 1000 * 1000;

/**
 * Local (non-LLM) image analysis: a 64-bit difference hash for perceptual similarity plus
 * simple sharpness/brightness measurements. These are honest, reproducible computations -
 * they say nothing about *what* is in the photo (that is the vision model's job) and are
 * reported as "measured", never as understanding.
 *
 * Returns { analysed: false, reason } when the image cannot be reliably decoded.
 */
async function analyzeBuffer(buffer) {
  try {
    const dims = readDimensions(buffer);
    if (dims && dims.width * dims.height > MAX_PIXELS) {
      return { analysed: false, reason: 'Image dimensions too large for local analysis.' };
    }

    const image = await Jimp.read(buffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // dHash: 9x8 greyscale, one bit per "left pixel brighter than right neighbour".
    const small = image.clone().resize(9, 8).greyscale();
    let bits = '';
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = Jimp.intToRGBA(small.getPixelColor(x, y)).r;
        const right = Jimp.intToRGBA(small.getPixelColor(x + 1, y)).r;
        bits += left > right ? '1' : '0';
      }
    }
    let phash = '';
    for (let i = 0; i < 64; i += 4) phash += parseInt(bits.slice(i, i + 4), 2).toString(16);

    // Sharpness: variance of the Laplacian on a normalised 256px-wide greyscale copy
    // (low variance = few edges = blurry). Brightness: mean grey level, 0-100.
    const norm = image.clone().resize(256, Jimp.AUTO).greyscale();
    const w = norm.bitmap.width;
    const h = norm.bitmap.height;
    const grey = new Float32Array(w * h);
    let sum = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const v = Jimp.intToRGBA(norm.getPixelColor(x, y)).r;
        grey[y * w + x] = v;
        sum += v;
      }
    }
    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x;
        const lap = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
        lapSum += lap;
        lapSq += lap * lap;
        n += 1;
      }
    }
    const blurScore = n > 0 ? lapSq / n - (lapSum / n) ** 2 : 0;

    return {
      analysed: true,
      phash,
      blurScore: Number(blurScore.toFixed(2)),
      brightness: Number(((sum / (w * h)) / 255 * 100).toFixed(2)),
      width,
      height,
    };
  } catch (err) {
    metrics.recordError('image', `image analysis failed: ${err.message}`);
    logger.warn('Local image analysis failed; continuing without it.', { error: err.message });
    return { analysed: false, reason: 'Image could not be decoded for local analysis.' };
  }
}

function popcount64(hexA, hexB) {
  let x = BigInt(`0x${hexA}`) ^ BigInt(`0x${hexB}`);
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** 0..1 perceptual similarity between two 16-hex-char hashes (1 = identical picture). */
function hashSimilarity(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== 16 || hexB.length !== 16) return 0;
  return 1 - popcount64(hexA, hexB) / 64;
}

/**
 * Finds earlier complaints whose photos are perceptually near-identical to any of these
 * hashes. Compared in Node against recent hashes only (bounded scan; no vector index).
 */
async function findSimilarImages({ phashes, excludeComplaintId, sinceDays = 30, minSimilarity = DUPLICATE_DETECTION.imageDuplicateSimilarity }) {
  const valid = (phashes || []).filter(Boolean);
  if (valid.length === 0) return [];

  const [rows] = await pool.query(
    `SELECT i.complaint_id, i.phash, c.latitude, c.longitude, c.complaint_number
     FROM complaint_images i JOIN complaints c ON c.id = i.complaint_id
     WHERE i.phash IS NOT NULL AND i.complaint_id != ?
       AND i.uploaded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY i.id DESC LIMIT 3000`,
    [excludeComplaintId || 0, sinceDays]
  );

  const best = new Map();
  for (const row of rows) {
    for (const h of valid) {
      const sim = hashSimilarity(h, row.phash);
      if (sim >= minSimilarity && sim > (best.get(row.complaint_id)?.similarity || 0)) {
        best.set(row.complaint_id, {
          complaintId: row.complaint_id,
          complaintNumber: row.complaint_number,
          similarity: sim,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Similarity of this complaint's photos to a specific set of candidate complaints' photos
 * (used to enrich text/semantic duplicate candidates with visual similarity).
 */
async function similarityToCandidates(phashes, candidateComplaintIds) {
  const result = new Map();
  const valid = (phashes || []).filter(Boolean);
  if (valid.length === 0 || candidateComplaintIds.length === 0) return result;
  const [rows] = await pool.query(
    `SELECT complaint_id, phash FROM complaint_images WHERE phash IS NOT NULL AND complaint_id IN (${candidateComplaintIds.map(() => '?').join(',')})`,
    candidateComplaintIds
  );
  for (const row of rows) {
    for (const h of valid) {
      const sim = hashSimilarity(h, row.phash);
      if (sim > (result.get(row.complaint_id) ?? -1)) result.set(row.complaint_id, sim);
    }
  }
  return result;
}

/** Splits similar-photo matches into same-place (likely same incident) vs elsewhere (suspicious reuse). */
function classifyReuse(matches, latitude, longitude, sameSpotMeters = 500) {
  const sameSpot = [];
  const elsewhere = [];
  for (const m of matches) {
    const d = haversineDistanceMeters(latitude, longitude, m.latitude, m.longitude);
    (d <= sameSpotMeters ? sameSpot : elsewhere).push({ ...m, distanceMeters: Math.round(d) });
  }
  return { sameSpot, elsewhere };
}

module.exports = { analyzeBuffer, hashSimilarity, findSimilarImages, similarityToCandidates, classifyReuse };
