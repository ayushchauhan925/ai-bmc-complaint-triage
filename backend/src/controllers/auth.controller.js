const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const mailer = require('../services/notification/mailer');
const env = require('../config/env');

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ success: true, data: { user, token } });
});

const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.status(200).json({ success: true, data: { user, token } });
});

const me = asyncHandler(async (req, res) => {
  const { password_hash, failed_login_attempts, locked_until, ...publicUser } = req.user;
  res.status(200).json({ success: true, data: { user: publicUser } });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  // Identical response whether or not the email is registered.
  res.status(200).json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ success: true, message: 'Your password has been updated. You can now sign in.' });
});

const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  res.status(200).json({ success: true, message: 'Your email address is verified.' });
});

const resendVerification = asyncHandler(async (req, res) => {
  if (req.user.email_verified_at) return res.status(200).json({ success: true, message: 'Your email is already verified.' });
  const sent = await authService.sendVerificationEmail(req.user);
  res.status(200).json({ success: true, message: sent ? 'Verification email sent.' : 'Email is not available right now.', data: { sent } });
});

// Tells the UI which optional capabilities this deployment has, so it never offers a broken flow.
const config = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { emailEnabled: mailer.isEnabled(), pushPublicKey: env.push.publicKey || null } });
});

module.exports = { register, login, me, forgotPassword, resetPassword, verifyEmail, resendVerification, config };
