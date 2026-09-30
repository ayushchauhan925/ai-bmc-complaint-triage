const env = require('../../../config/env');
const userModel = require('../../../models/user.model');

let transporter = null;

function getTransporter() {
  if (!env.email.host) return null;
  if (!transporter) {
    // Lazy require so nodemailer is only loaded when SMTP is actually configured.
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined,
    });
  }
  return transporter;
}

// Email mirrors only the notification types worth interrupting someone for (configurable
// via EMAIL_NOTIFY_TYPES), so routine in-app updates do not become inbox noise.
module.exports = {
  name: 'email',
  isEnabled: () => Boolean(env.email.host),
  async send({ userId, title, message, type }) {
    if (!env.email.notifyTypes.includes(type)) return { delivered: false, skipped: 'type-not-emailed' };
    const user = await userModel.findById(userId);
    if (!user?.email) return { delivered: false, skipped: 'no-recipient' };
    await getTransporter().sendMail({
      from: env.email.from,
      to: user.email,
      subject: title,
      text: `${message}\n\n- Civic Connect`,
    });
    return { delivered: true };
  },
};
