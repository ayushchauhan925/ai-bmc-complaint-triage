const express = require('express');
const opsController = require('../controllers/ops.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(ROLES.ADMIN));
router.get('/', opsController.listEscalations);
router.post('/run', opsController.runEscalations);
router.patch('/:id/acknowledge', opsController.acknowledgeEscalation);

module.exports = router;
