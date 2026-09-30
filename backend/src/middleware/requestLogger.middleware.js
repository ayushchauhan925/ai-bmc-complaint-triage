const crypto = require('crypto');
const metrics = require('../services/observability/metrics.service');
const logger = require('../utils/logger');

const SLOW_REQUEST_MS = 1500;

/**
 * Adds a request id (echoed as X-Request-Id, so a user-reported failure can be found in the
 * logs) and records latency + status metrics per route *pattern* ("GET /api/complaints/:id",
 * never the concrete URL, to keep cardinality bounded). Logs one structured line per request
 * with method, route, status, duration and user id only - never bodies, query strings,
 * headers or tokens.
 */
function requestLogger(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const routePattern = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const key = `${req.method} ${routePattern}`;

    metrics.observeLatency('http', ms);
    metrics.observeLatency(`http ${key}`, ms);
    metrics.increment(`http.status.${Math.floor(res.statusCode / 100)}xx`);

    if (req.path === '/health' || process.env.NODE_ENV === 'test') return;
    const meta = { requestId: req.id, method: req.method, route: routePattern, status: res.statusCode, ms: Math.round(ms), userId: req.user?.id ?? null };
    if (res.statusCode >= 500) logger.error('Request failed.', meta);
    else if (ms >= SLOW_REQUEST_MS) logger.warn('Slow request.', meta);
    else logger.info('Request completed.', meta);
  });

  next();
}

module.exports = { requestLogger };
