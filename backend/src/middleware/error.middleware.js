const logger = require('../utils/logger');
const env = require('../config/env');
const metrics = require('../services/observability/metrics.service');

function notFoundHandler(req, res, next) {
  res.status(404).json({ success: false, message: 'Resource not found.' });
}

function isDatabaseError(err) {
  return typeof err.code === 'string' && (err.code.startsWith('ER_') || ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT'].includes(err.code));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && err.isOperational ? err.statusCode : 500;

  if (statusCode >= 500) {
    metrics.recordError(isDatabaseError(err) ? 'database' : 'api', err.message, { path: req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched' });
    logger.error(err.message, { stack: err.stack, path: req.originalUrl?.split('?')[0], method: req.method, requestId: req.id });
  } else {
    logger.warn(err.message, { path: req.originalUrl?.split('?')[0], method: req.method, requestId: req.id });
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Something went wrong. Please try again shortly.' : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(statusCode >= 500 && req.id ? { requestId: req.id } : {}),
    ...(env.nodeEnv !== 'production' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
