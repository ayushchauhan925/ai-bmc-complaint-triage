const express = require('express');
const opsController = require('../controllers/ops.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { slaPolicySchema } = require('../validators/ops.validator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(ROLES.ADMIN));
router.get('/', opsController.slaOverview);
router.put('/policies', validateBody(slaPolicySchema), opsController.upsertSlaPolicy);

module.exports = router;
