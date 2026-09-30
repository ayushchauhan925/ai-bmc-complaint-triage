const mysql = require('mysql2/promise');
const env = require('./env');
const { buildSslOptions } = require('./sslOptions');

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
  // Managed MySQL (e.g. Aiven) requires TLS. Without DB_SSL_CA the connection is encrypted
  // but the certificate is not verified; set DB_SSL_CA to verify it (see sslOptions.js).
  ...buildSslOptions(env.db),
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
