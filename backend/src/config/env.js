require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
    name: required('DB_NAME', 'bmc_triage'),
    // Managed MySQL providers (Aiven, PlanetScale, etc.) require TLS. Set DB_SSL_MODE=REQUIRED
    // (or anything truthy) to enable it - local MySQL leaves this unset.
    sslMode: process.env.DB_SSL_MODE || '',
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Optional email channel (nodemailer/SMTP). Disabled unless SMTP_HOST is set.
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Civic Connect <no-reply@civic-connect.local>',
    notifyTypes: (process.env.EMAIL_NOTIFY_TYPES || 'SLA_ESCALATION,ESCALATION,COMPLAINT_ASSIGNED')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  },

  // Background jobs (SLA/escalation/anomaly scans, AI retries) run in-process. Disable with
  // ENABLE_BACKGROUND_JOBS=false (e.g. when running several instances or in tests).
  jobsEnabled: process.env.ENABLE_BACKGROUND_JOBS !== 'false' && process.env.NODE_ENV !== 'test',
  // Apply pending SQL migrations on boot so a deploy is always consistent with its schema.
  // Migrations are additive and tracked in _migrations; set AUTO_MIGRATE=false to opt out.
  autoMigrate: process.env.AUTO_MIGRATE !== 'false' && process.env.NODE_ENV !== 'test',

  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

module.exports = env;
