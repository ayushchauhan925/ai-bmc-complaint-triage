const notificationService = require('../services/notification/notification.service');
const pushModel = require('../models/pushSubscription.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const env = require('../config/env');

const list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listForUser(req.user.id, {
    unreadOnly: req.query.unread === 'true',
  });
  res.status(200).json({ success: true, data: { notifications } });
});

const markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.params.id, req.user.id);
  res.status(200).json({ success: true });
});

const pushEnabled = () => Boolean(env.push.publicKey && env.push.privateKey);

const subscribePush = asyncHandler(async (req, res) => {
  if (!pushEnabled()) throw new AppError('Push notifications are not enabled on this server.', 503);
  const { endpoint, keys } = req.body;
  await pushModel.upsert(req.user.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
  res.status(201).json({ success: true });
});

const unsubscribePush = asyncHandler(async (req, res) => {
  await pushModel.remove(req.user.id, req.body.endpoint);
  res.status(200).json({ success: true });
});

const pushStatus = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { enabled: pushEnabled(), publicKey: pushEnabled() ? env.push.publicKey : null, subscriptions: await pushModel.countForUser(req.user.id) } });
});

module.exports = { list, markRead, subscribePush, unsubscribePush, pushStatus };
