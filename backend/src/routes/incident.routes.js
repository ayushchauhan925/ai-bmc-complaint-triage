const express = require('express');
const incidentController = require('../controllers/incident.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { createIncidentSchema, updateIncidentSchema, addComplaintSchema, mergeIncidentSchema } = require('../validators/incident.validator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authMiddleware);

router.get('/', roleMiddleware(ROLES.ADMIN, ROLES.OFFICER), incidentController.list);
router.get('/:id', roleMiddleware(ROLES.ADMIN, ROLES.OFFICER), incidentController.getOne);

router.use(roleMiddleware(ROLES.ADMIN));
router.post('/', validateBody(createIncidentSchema), incidentController.create);
router.patch('/:id', validateBody(updateIncidentSchema), incidentController.update);
router.post('/:id/complaints', validateBody(addComplaintSchema), incidentController.addComplaint);
router.delete('/:id/complaints/:complaintId', incidentController.removeComplaint);
router.post('/:id/merge', validateBody(mergeIncidentSchema), incidentController.merge);

module.exports = router;
