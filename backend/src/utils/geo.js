const { haversineDistanceMeters } = require('./vectorMath');

/**
 * DBSCAN density clustering for geographic points, using a uniform grid index so neighbour
 * lookup is ~O(n) rather than O(n^2). A point is a "core" point when at least `minPts`
 * points (itself included) lie within `epsMeters`; clusters grow through core points, so an
 * elongated problem (e.g. a road with many potholes) becomes ONE hotspot instead of being
 * cut into arbitrary circles the way seed-based greedy clustering would.
 *
 * points: [{ latitude, longitude, ...anything }]  ->  array of clusters (arrays of points).
 * Noise points (not density-reachable) are returned separately and never fabricated into clusters.
 */
function dbscan(points, epsMeters, minPts) {
  const n = points.length;
  if (n === 0) return { clusters: [], noise: [] };

  const latStep = epsMeters / 111000;
  const meanLat = points.reduce((s, p) => s + Number(p.latitude), 0) / n;
  const lngStep = epsMeters / (111000 * Math.max(Math.cos((meanLat * Math.PI) / 180), 0.01));

  const grid = new Map();
  const keyOf = (p) => `${Math.floor(Number(p.latitude) / latStep)}:${Math.floor(Number(p.longitude) / lngStep)}`;
  points.forEach((p, i) => {
    const k = keyOf(p);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });

  function neighbours(i) {
    const p = points[i];
    const cy = Math.floor(Number(p.latitude) / latStep);
    const cx = Math.floor(Number(p.longitude) / lngStep);
    const out = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bucket = grid.get(`${cy + dy}:${cx + dx}`);
        if (!bucket) continue;
        for (const j of bucket) {
          if (haversineDistanceMeters(Number(p.latitude), Number(p.longitude), Number(points[j].latitude), Number(points[j].longitude)) <= epsMeters) {
            out.push(j);
          }
        }
      }
    }
    return out;
  }

  const UNVISITED = 0;
  const NOISE = -1;
  const label = new Array(n).fill(UNVISITED);
  let clusterId = 0;

  for (let i = 0; i < n; i += 1) {
    if (label[i] !== UNVISITED) continue;
    const seeds = neighbours(i);
    if (seeds.length < minPts) {
      label[i] = NOISE;
      continue;
    }
    clusterId += 1;
    label[i] = clusterId;
    const queue = seeds.filter((j) => j !== i);
    while (queue.length) {
      const j = queue.pop();
      if (label[j] === NOISE) label[j] = clusterId; // border point
      if (label[j] !== UNVISITED) continue;
      label[j] = clusterId;
      const jn = neighbours(j);
      if (jn.length >= minPts) queue.push(...jn);
    }
  }

  const clusters = Array.from({ length: clusterId }, () => []);
  const noise = [];
  label.forEach((l, i) => {
    if (l > 0) clusters[l - 1].push(points[i]);
    else noise.push(points[i]);
  });
  return { clusters, noise };
}

function centroidOf(points) {
  const lat = points.reduce((s, p) => s + Number(p.latitude), 0) / points.length;
  const lng = points.reduce((s, p) => s + Number(p.longitude), 0) / points.length;
  return { latitude: lat, longitude: lng };
}

function radiusOf(points, centre) {
  return Math.max(0, ...points.map((p) => haversineDistanceMeters(centre.latitude, centre.longitude, Number(p.latitude), Number(p.longitude))));
}

module.exports = { dbscan, centroidOf, radiusOf };
