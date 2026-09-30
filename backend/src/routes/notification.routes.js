const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { z } = require('zod');

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(255), auth: z.string().min(5).max(255) }),
});
const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

const router = express.Router();

router.use(authMiddleware);
router.get('/', notificationController.list);
router.get('/push', notificationController.pushStatus);
router.post('/push/subscribe', validateBody(subscribeSchema), notificationController.subscribePush);
router.post('/push/unsubscribe', validateBody(unsubscribeSchema), notificationController.unsubscribePush);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
