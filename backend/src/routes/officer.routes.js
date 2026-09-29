const express = require('express');
const officerController = require('../controllers/officer.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(ROLES.OFFICER));

router.get('/complaints', officerController.listAssigned);
router.patch('/complaints/:id/accept', officerController.accept);
router.patch('/complaints/:id/start', officerController.start);
router.post('/complaints/:id/resolution-image', upload.single('image'), officerController.uploadResolutionImage);
router.patch('/complaints/:id/resolve', officerController.resolve);
router.get('/ai-assistance/:id', officerController.getAiAssistance);

module.exports = router;
