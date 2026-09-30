const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { requestLogger } = require('./middleware/requestLogger.middleware');

const app = express();

// Render (and most PaaS hosts) terminate TLS and proxy requests to the app over an
// internal network, setting X-Forwarded-For/X-Forwarded-Proto. Without `trust proxy`,
// express-rate-limit v7 refuses to start key-ing by IP (it throws on an unexpected
// X-Forwarded-For header by default) and req.ip/req.secure would be wrong behind the proxy.
app.set('trust proxy', 1);

app.use(requestLogger);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS_ORIGIN may be a single URL or a comma-separated list (e.g. a Vercel production
// domain plus a preview domain). Local dev origins are always allowed in addition, so
// `npm run dev` keeps working regardless of what CORS_ORIGIN is set to.
const configuredOrigins = env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...(env.isProduction ? [] : devOrigins)]));

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (server-to-server calls, curl, health checks) - allow.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError('This origin is not permitted to access the API.', 403));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (!env.isProduction) {
  app.use(morgan('dev'));
}

// Plain, dependency-free health check for Render's health check / uptime monitors -
// intentionally does not touch the database or OpenAI so it stays fast and reliable.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'BMC Complaint Triage API' });
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Production: 300 requests / 15 min / IP. Raised under test, where one IP drives a whole suite.
  limit: env.nodeEnv === 'test' ? 100000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  // JSON like every other API error, so the UI can show it instead of a misleading fallback.
  message: { success: false, message: 'Too many requests. Please wait a moment and try again.' },
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Production: 20 attempts / 15 min / IP. The test suite creates many accounts from one IP.
  limit: env.nodeEnv === 'test' ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Endpoints that trigger paid OpenAI calls get a much tighter per-client budget than the
// general API limiter, so a script cannot turn them into a cost/DoS vector.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please slow down.' },
});
app.use('/api/complaints/ai-assist', aiLimiter);
app.use('/api/complaints/duplicate-check', aiLimiter);
app.use('/api/admin/ai-search', aiLimiter);
app.use('/api/admin/search/semantic', aiLimiter);
app.use('/api/admin/situation-report', aiLimiter);
app.use('/api/admin/evaluations', aiLimiter);

// Uploaded images are stored on Cloudinary (see services/upload/cloudinary.service.js),
// not on local disk, so there is no /uploads static route to serve.
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
