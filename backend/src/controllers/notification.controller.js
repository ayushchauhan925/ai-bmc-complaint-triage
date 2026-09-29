const notificationService = require('../services/notification/notification.service');
const asyncHandler = require('../utils/asyncHandler');

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

module.exports = { list, markRead };
