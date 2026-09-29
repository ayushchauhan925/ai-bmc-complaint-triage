const logger = require('../utils/logger');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  res.status(404).json({ success: false, message: 'Resource not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && err.isOperational ? err.statusCode : 500;

  if (statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
  } else {
    logger.warn(err.message, { path: req.originalUrl, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Something went wrong. Please try again shortly.' : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(env.nodeEnv !== 'production' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
