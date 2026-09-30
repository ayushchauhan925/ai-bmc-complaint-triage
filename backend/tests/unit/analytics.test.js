const { scoreAgainstBaseline } = require('../../src/services/analytics/anomaly.service');
const { holtForecast } = require('../../src/services/analytics/forecast.service');
const { dbscan } = require('../../src/utils/geo');
const { textSimilarity } = require('../../src/utils/textSimilarity');
const { computeTrend, computeExtent } = require('../../src/services/complaint/incidentIntelligence.service');
const { sanitize } = require('../../src/services/audit/audit.service');
const { slaSnapshot, computeSlaStatus, calculateSlaDeadline } = require('../../src/services/complaint/sla.service');
const { detectImageType, readDimensions } = require('../../src/utils/imageFormat');

describe('anomaly scoring (robust z-score)', () => {
  const steady = [10, 9, 11, 10, 12, 8, 10, 11, 9, 10, 10, 12, 9, 11];

  test('flags a genuine surge: 10/day baseline -> 75 observed', () => {
    const r = scoreAgainstBaseline(75, steady);
    expect(r.status).toBe('anomaly');
    expect(r.score).toBeGreaterThan(10);
    expect(r.baseline.median).toBe(10);
    expect(r.observed).toBe(75);
  });

  test('does not flag ordinary day-to-day variation', () => {
    expect(scoreAgainstBaseline(13, steady).status).toBe('normal');
    expect(scoreAgainstBaseline(7, steady).status).toBe('normal');
  });

  test('does not flag tiny absolute counts even when the ratio is large (0 -> 3)', () => {
    const sparse = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0];
    expect(scoreAgainstBaseline(3, sparse).status).toBe('normal');
  });

  test('a previous spike does not desensitise the detector (median/MAD are robust)', () => {
    const withSpike = [...steady, 60, 10, 11];
    expect(scoreAgainstBaseline(70, withSpike).status).toBe('anomaly');
  });

  test('refuses to score with too little history', () => {
    const r = scoreAgainstBaseline(50, [10, 10, 10]);
    expect(r.status).toBe('insufficient_data');
    expect(r.requiredDays).toBeGreaterThan(3);
  });

  test('a drop is not reported as a surge', () => {
    expect(scoreAgainstBaseline(0, steady).status).toBe('normal');
  });
});

describe('forecasting (Holt linear trend)', () => {
  test('says unavailable - and returns no forecast - with insufficient history', () => {
    const r = holtForecast([3, 4, 5, 4, 6]);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/at least 14 days/);
    expect(r.forecast).toBeUndefined();
  });

  test('says unavailable when there are enough days but almost no activity', () => {
    const r = holtForecast([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/with activity/);
  });

  test('extrapolates an upward trend with widening prediction intervals', () => {
    const series = Array.from({ length: 30 }, (_, i) => 10 + i * 0.5 + (i % 3 === 0 ? 1 : -0.5));
    const r = holtForecast(series, 7);
    expect(r.available).toBe(true);
    expect(r.forecast).toHaveLength(7);
    expect(r.forecast[6].value).toBeGreaterThan(r.forecast[0].value - 1);
    expect(r.forecast[0].value).toBeGreaterThan(20);
    const w0 = r.forecast[0].upper - r.forecast[0].lower;
    const w6 = r.forecast[6].upper - r.forecast[6].lower;
    expect(w6).toBeGreaterThan(w0);
    expect(r.forecast.every((f) => f.lower <= f.value && f.value <= f.upper && f.lower >= 0)).toBe(true);
  });

  test('never forecasts negative volumes', () => {
    const series = Array.from({ length: 20 }, (_, i) => Math.max(0, 20 - i * 1.5));
    const r = holtForecast(series, 7);
    expect(r.forecast.every((f) => f.value >= 0)).toBe(true);
  });

  test('includes an honest backtest against a naive baseline when history allows', () => {
    const series = Array.from({ length: 40 }, (_, i) => 12 + (i % 7));
    const r = holtForecast(series);
    expect(r.backtest).toEqual(expect.objectContaining({ holdoutDays: 7, maeModel: expect.any(Number), maeNaive: expect.any(Number) }));
  });
});

describe('DBSCAN geographic clustering', () => {
  // ~11 m per 0.0001 deg latitude.
  const line = Array.from({ length: 8 }, (_, i) => ({ id: i, latitude: 19.0 + i * 0.0015, longitude: 72.9 })); // ~167 m apart
  const elsewhere = [0, 1, 2].map((i) => ({ id: 100 + i, latitude: 19.5 + i * 0.0002, longitude: 73.1 }));

  test('chains an elongated problem (potholes along a road) into ONE cluster', () => {
    const { clusters } = dbscan(line, 250, 3);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(8);
  });

  test('keeps distant groups separate and reports isolated points as noise', () => {
    const lone = { id: 999, latitude: 20.5, longitude: 74.0 };
    const { clusters, noise } = dbscan([...line, ...elsewhere, lone], 250, 3);
    expect(clusters).toHaveLength(2);
    expect(noise.map((p) => p.id)).toEqual([999]);
  });

  test('requires minPts - two nearby reports are not a hotspot', () => {
    const { clusters, noise } = dbscan(elsewhere.slice(0, 2), 250, 3);
    expect(clusters).toHaveLength(0);
    expect(noise).toHaveLength(2);
  });

  test('handles empty input', () => {
    expect(dbscan([], 100, 3)).toEqual({ clusters: [], noise: [] });
  });
});

describe('lexical text similarity', () => {
  test('paraphrases score high, unrelated text scores low', () => {
    const high = textSimilarity('Large pothole near market gate', 'Big pothole close to market gate');
    const low = textSimilarity('Large pothole near market gate', 'Streetlight not working at night');
    expect(high).toBeGreaterThan(0.4);
    expect(low).toBeLessThan(0.15);
    expect(high).toBeGreaterThan(low);
  });

  test('is tolerant of spelling variants and works for Devanagari', () => {
    expect(textSimilarity('potholes on road', 'pot hole on the road')).toBeGreaterThan(0.25);
    expect(textSimilarity('रस्त्यावर मोठा खड्डा आहे', 'रस्त्यावर मोठा खड्डा पडला आहे')).toBeGreaterThan(0.5);
  });

  test('empty / stopword-only text is 0, never NaN', () => {
    expect(textSimilarity('', 'abc')).toBe(0);
    expect(textSimilarity('the a an', 'the a an')).toBe(0);
  });
});

describe('incident intelligence', () => {
  const H = 3600 * 1000;
  const now = Date.now();

  test('trend is INSUFFICIENT_DATA with fewer than 3 reports, never guessed', () => {
    expect(computeTrend([new Date(now), new Date(now - H)], now).label).toBe('INSUFFICIENT_DATA');
  });

  test('detects a rising incident (more reports in the last 24h than the 24h before)', () => {
    const times = [1, 2, 3, 4, 5].map((h) => new Date(now - h * H)).concat([new Date(now - 30 * H)]);
    const t = computeTrend(times, now);
    expect(t.label).toBe('RISING');
    expect(t.last24h).toBe(5);
    expect(t.previous24h).toBe(1);
  });

  test('detects a falling incident', () => {
    const times = [new Date(now - 2 * H)].concat([26, 27, 28, 30, 35].map((h) => new Date(now - h * H)));
    expect(computeTrend(times, now).label).toBe('FALLING');
  });

  test('extent gives centroid and the radius that contains every complaint', () => {
    const e = computeExtent([
      { latitude: 19.0, longitude: 72.9 },
      { latitude: 19.001, longitude: 72.9 },
    ]);
    expect(e.centroid.latitude).toBeCloseTo(19.0005, 4);
    expect(e.radiusMeters).toBeGreaterThan(40);
    expect(e.radiusMeters).toBeLessThan(70);
    expect(e.bounds.maxLat).toBe(19.001);
    expect(computeExtent([])).toBeNull();
  });
});

describe('audit sanitisation', () => {
  test('redacts credential-like keys at any depth and truncates long strings', () => {
    const out = sanitize({ password: 'x', nested: { apiKey: 'abc', token: 't', ok: 'fine' }, long: 'y'.repeat(2000), list: [{ secret: 's' }] });
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.apiKey).toBe('[REDACTED]');
    expect(out.nested.token).toBe('[REDACTED]');
    expect(out.nested.ok).toBe('fine');
    expect(out.long.length).toBeLessThan(600);
    expect(out.list[0].secret).toBe('[REDACTED]');
  });
});

describe('SLA engine', () => {
  const created = new Date(Date.now() - 10 * 3600 * 1000);

  test('uses the snapshot hours from the policy, not just the defaults', () => {
    const deadline = calculateSlaDeadline('LOW', created, 5);
    expect(deadline.getTime() - created.getTime()).toBe(5 * 3600 * 1000);
  });

  test('breached vs approaching vs on track follow the stored deadline and warning ratio', () => {
    const base = { priorityLevel: 'HIGH', createdAt: created, status: 'ASSIGNED' };
    expect(computeSlaStatus({ ...base, slaHours: 8, slaDeadline: new Date(created.getTime() + 8 * 3600 * 1000) })).toBe('BREACHED');
    expect(computeSlaStatus({ ...base, slaHours: 12, slaDeadline: new Date(created.getTime() + 12 * 3600 * 1000), warningPct: 0.8 })).toBe('APPROACHING');
    expect(computeSlaStatus({ ...base, slaHours: 48, slaDeadline: new Date(created.getTime() + 48 * 3600 * 1000) })).toBe('ON_TRACK');
  });

  test('snapshot reports remaining time, breach flags and resolution time', () => {
    const open = slaSnapshot({ created_at: created, sla_deadline: new Date(Date.now() + 2 * 3600 * 1000), sla_hours: 12, status: 'ASSIGNED', priority_level: 'HIGH' });
    expect(open.remainingMs).toBeGreaterThan(0);
    expect(open.breached).toBe(false);
    const late = slaSnapshot({ created_at: created, sla_deadline: new Date(created.getTime() + 4 * 3600 * 1000), sla_hours: 4, status: 'RESOLVED', resolved_at: new Date(), priority_level: 'HIGH' });
    expect(late.status).toBe('COMPLETED_AFTER_SLA');
    expect(late.breached).toBe(true);
    expect(late.resolutionMs).toBeGreaterThan(9 * 3600 * 1000);
    expect(late.remainingMs).toBeNull();
  });
});

describe('image format sniffing', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8), Buffer.from([0, 0, 1, 0, 0, 0, 0, 200])]);

  test('detects real formats from magic bytes and rejects text pretending to be an image', () => {
    expect(detectImageType(png)).toBe('png');
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('jpeg');
    expect(detectImageType(Buffer.from('this is not an image at all'))).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
  });

  test('reads pixel dimensions from the header without decoding', () => {
    expect(readDimensions(png)).toEqual({ width: 256, height: 200 });
    expect(readDimensions(Buffer.from('nope nope nope nope'))).toBeNull();
  });
});

describe('notification abstraction isolates channel failures', () => {
  test('a failing channel never throws into the caller and other channels still deliver', async () => {
    jest.resetModules();
    const sent = [];
    jest.doMock('../../src/services/notification/channels/inApp.channel', () => ({
      name: 'in_app', isEnabled: () => true, send: async (p) => { sent.push(p.type); return { delivered: true }; },
    }));
    jest.doMock('../../src/services/notification/channels/email.channel', () => ({
      name: 'email', isEnabled: () => true, send: async () => { throw new Error('smtp down'); },
    }));
    const svc = require('../../src/services/notification/notification.service');
    const out = await svc.notify({ userId: 1, title: 't', message: 'm', type: 'SLA_ESCALATION' });
    expect(out.in_app.delivered).toBe(true);
    expect(out.email.delivered).toBe(false);
    expect(out.email.error).toBe('smtp down');
    expect(sent).toEqual(['SLA_ESCALATION']);
    jest.dontMock('../../src/services/notification/channels/inApp.channel');
    jest.dontMock('../../src/services/notification/channels/email.channel');
  });
});
