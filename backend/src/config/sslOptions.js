const fs = require('fs');

/**
 * TLS options for the MySQL connection.
 *  - DB_SSL_MODE unset            -> no TLS (local MySQL)
 *  - DB_SSL_MODE set, no DB_SSL_CA -> encrypted, certificate NOT verified (previous behaviour)
 *  - DB_SSL_MODE set + DB_SSL_CA   -> encrypted AND the server certificate is verified against
 *                                     the provider's CA (PEM text, or a path to a .pem file)
 */
function buildSslOptions({ sslMode, sslCa }) {
  if (!sslMode) return {};
  if (!sslCa) return { ssl: { rejectUnauthorized: false } };

  let ca = sslCa;
  if (!sslCa.includes('BEGIN CERTIFICATE')) {
    ca = fs.readFileSync(sslCa, 'utf8');
  }
  // Allow the PEM to be supplied as a single-line env var with literal "\n" sequences.
  ca = ca.replace(/\\n/g, '\n');
  return { ssl: { ca, rejectUnauthorized: true } };
}

module.exports = { buildSslOptions };
