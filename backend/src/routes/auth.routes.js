const express = require('express');
const authController = require('../controllers/auth.controller');
const { validateBody } = require('../middleware/validate.middleware');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } = require('../validators/auth.validator');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.get('/me', authMiddleware, authController.me);
router.get('/config', authController.config);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', validateBody(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', authMiddleware, authController.resendVerification);

module.exports = router;
