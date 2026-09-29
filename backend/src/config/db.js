const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  // Managed MySQL (e.g. Aiven) requires TLS. rejectUnauthorized: false trusts the
  // provider's certificate without pinning a CA bundle - encrypted in transit, not
  // certificate-verified. Fine for a hackathon demo; pin the provider's CA cert for
  // production hardening.
  ...(env.db.sslMode ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection };
