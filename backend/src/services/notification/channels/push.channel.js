const env = require('../../../config/env');
const pushModel = require('../../../models/pushSubscription.model');

let configured = false;
let webpush = null;

function getWebPush() {
  if (!webpush) {
    // eslint-disable-next-line global-require
    webpush = require('web-push');
  }
  if (!configured) {
    webpush.setVapidDetails(env.push.subject, env.push.publicKey, env.push.privateKey);
    configured = true;
  }
  return webpush;
}

// Browser push mirrors in-app notifications to the user's subscribed devices. Enabled only when
// VAPID keys are configured. Dead subscriptions (HTTP 404/410 from the push service) are pruned.
module.exports = {
  name: 'push',
  isEnabled: () => Boolean(env.push.publicKey && env.push.privateKey),
  async send({ userId, title, message, relatedComplaintId = null }) {
    const subs = await pushModel.listForUser(userId);
    if (subs.length === 0) return { delivered: false, skipped: 'no-subscription' };

    const wp = getWebPush();
    const payload = JSON.stringify({ title, body: message, url: relatedComplaintId ? `/complaints/${relatedComplaintId}` : '/' });
    let delivered = 0;
    for (const s of subs) {
      try {
        await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 });
        delivered += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await pushModel.removeByEndpoint(s.endpoint);
      }
    }
    return { delivered: delivered > 0, devices: delivered };
  },
};
