const express = require('express');
const complaintController = require('../controllers/complaint.controller');
const decisionController = require('../controllers/decision.controller');
const reviewController = require('../controllers/review.controller');
const feedbackController = require('../controllers/feedback.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { upload, verifyImageContent } = require('../middleware/upload.middleware');
const {
  createComplaintSchema,
  updateComplaintSchema,
  updateStatusSchema,
  duplicateCheckSchema,
  reopenSchema,
  guidedAssistSchema,
} = require('../validators/complaint.validator');
const { feedbackSchema } = require('../validators/feedback.validator');
const { reviewSchema } = require('../validators/review.validator');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/',
  roleMiddleware(ROLES.CITIZEN),
  upload.array('images', 5),
  verifyImageContent,
  validateBody(createComplaintSchema),
  complaintController.create
);

// Section 1: guided complaint assistant (one-shot, not a chatbot).
router.post(
  '/ai-assist',
  roleMiddleware(ROLES.CITIZEN),
  validateBody(guidedAssistSchema),
  complaintController.guidedAssist
);

// Section 16: pre-submission duplicate warning.
router.post(
  '/duplicate-check',
  roleMiddleware(ROLES.CITIZEN),
  validateBody(duplicateCheckSchema),
  complaintController.duplicateCheck
);

router.get('/', complaintController.list);
router.get('/:id', complaintController.getOne);

router.patch(
  '/:id',
  roleMiddleware(ROLES.ADMIN),
  validateBody(updateComplaintSchema),
  complaintController.update
);

router.patch(
  '/:id/status',
  roleMiddleware(ROLES.ADMIN, ROLES.OFFICER),
  validateBody(updateStatusSchema),
  complaintController.updateStatus
);

router.post('/:id/analyze', roleMiddleware(ROLES.ADMIN), complaintController.analyze);
router.post('/:id/verify-image', roleMiddleware(ROLES.ADMIN), complaintController.verifyImage);
router.post('/:id/ai-enrich', roleMiddleware(ROLES.ADMIN), complaintController.aiEnrich);
router.post('/:id/evidence-analysis', roleMiddleware(ROLES.ADMIN), complaintController.evidenceAnalysis);
router.post('/:id/duplicates', complaintController.getDuplicates);

// Intelligence read APIs. Timeline/SLA/duplicates are visible to the complaint owner (with
// internal detail removed for citizens); evidence, decision trace and reviews are staff-only.
router.get('/:id/timeline', decisionController.getTimeline);
router.get('/:id/sla', decisionController.getSla);
router.get('/:id/duplicates', decisionController.getDuplicates);
router.get('/:id/evidence', roleMiddleware(ROLES.ADMIN, ROLES.OFFICER), decisionController.getEvidence);
router.get('/:id/decision-trace', roleMiddleware(ROLES.ADMIN, ROLES.OFFICER), decisionController.getDecisionTrace);
// Human-in-the-loop: approve / correct / false-positive / confirm or reject a duplicate.
router.post('/:id/review', roleMiddleware(ROLES.ADMIN, ROLES.OFFICER), validateBody(reviewSchema), reviewController.submitReview);
router.get('/:id/reviews', roleMiddleware(ROLES.ADMIN, ROLES.OFFICER), reviewController.listReviews);
router.get('/:id/similar', complaintController.getSimilar);
router.post(
  '/:id/reopen',
  roleMiddleware(ROLES.CITIZEN),
  upload.single('image'),
  verifyImageContent,
  validateBody(reopenSchema),
  complaintController.reopen
);
router.post(
  '/:id/feedback',
  roleMiddleware(ROLES.CITIZEN),
  validateBody(feedbackSchema),
  feedbackController.submit
);

module.exports = router;
