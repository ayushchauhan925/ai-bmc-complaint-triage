const env = require('../../config/env');
const logger = require('../../utils/logger');

let transporter = null;

const isEnabled = () => Boolean(env.email.host);

/**
 * Sends a transactional email (password reset, verification). Returns true if handed to the
 * SMTP server, false if email is disabled or sending failed - it never throws, and never
 * logs message bodies (they contain one-time links).
 */
async function sendMail({ to, subject, text, html }) {
  if (!isEnabled()) return false;
  try {
    if (!transporter) {
      // eslint-disable-next-line global-require
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        host: env.email.host,
        port: env.email.port,
        secure: env.email.port === 465,
        auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined,
      });
    }
    await transporter.sendMail({ from: env.email.from, to, subject, text, html });
    return true;
  } catch (err) {
    logger.warn('Transactional email failed.', { error: err.message });
    return false;
  }
}

module.exports = { sendMail, isEnabled };
