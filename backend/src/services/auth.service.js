const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const userModel = require('../models/user.model');
const authTokens = require('./authTokens.service');
const mailer = require('./notification/mailer');
const auditService = require('./audit/audit.service');
const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/constants');

const SALT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

// Never return secrets or security bookkeeping to the client.
function sanitizeUser(user) {
  const { password_hash, failed_login_attempts, locked_until, ...publicUser } = user;
  return publicUser;
}

async function sendVerificationEmail(user) {
  if (!mailer.isEnabled()) return false;
  const token = await authTokens.issue(user.id, 'EMAIL_VERIFY');
  const link = `${env.frontendUrl}/verify-email?token=${token}`;
  return mailer.sendMail({
    to: user.email,
    subject: 'Verify your Civic Connect email',
    text: `Hi ${user.name},\n\nConfirm your email address so we can send you updates about your complaints:\n${link}\n\nThis link expires in 24 hours. If you did not create an account, ignore this email.\n\n- Civic Connect`,
  });
}

async function register({ name, email, password, phone }) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // Public registration is always CITIZEN. OFFICER/ADMIN accounts are provisioned via seed/admin tools,
  // never accepted from the frontend (rule: never trust role information sent from the client).
  const user = await userModel.create({ name, email, passwordHash, phone, role: ROLES.CITIZEN });
  sendVerificationEmail(user).catch(() => {}); // best-effort; registration never fails on email
  const token = signToken(user);
  return { user, token };
}

/**
 * Login with brute-force protection: after MAX_FAILED_ATTEMPTS wrong passwords the account is
 * locked for LOCK_MINUTES (a correct password during the lock is also refused). The counter
 * resets on success. Unknown emails get the same generic error as a wrong password.
 */
async function login({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) {
    // Burn comparable time so response timing does not reveal whether the email exists.
    await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuuWQVq3m2G1kWq9eQf1y7wS0m1s2c3d4e');
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.locked_until) - Date.now()) / 60000));
    throw new AppError(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`, 429);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await userModel.recordFailedLogin(user.id, 0, new Date(Date.now() + LOCK_MINUTES * 60000));
      await auditService.record({ actor: null, action: 'ACCOUNT_LOCKED', entityType: 'user', entityId: user.id, next: { lockMinutes: LOCK_MINUTES } });
    } else {
      await userModel.recordFailedLogin(user.id, attempts, null);
    }
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.failed_login_attempts || user.locked_until) await userModel.clearLoginFailures(user.id);
  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

/** Always resolves the same way, so the endpoint cannot be used to discover registered emails. */
async function requestPasswordReset(email) {
  const user = await userModel.findByEmail(email);
  if (!user || !mailer.isEnabled()) return { emailEnabled: mailer.isEnabled() };
  const token = await authTokens.issue(user.id, 'PASSWORD_RESET');
  const link = `${env.frontendUrl}/reset-password?token=${token}`;
  await mailer.sendMail({
    to: user.email,
    subject: 'Reset your Civic Connect password',
    text: `Hi ${user.name},\n\nUse this link to choose a new password:\n${link}\n\nIt expires in 1 hour and can be used once. If you did not ask for this, ignore this email - your password stays unchanged.\n\n- Civic Connect`,
  });
  await auditService.record({ actor: null, action: 'PASSWORD_RESET_REQUESTED', entityType: 'user', entityId: user.id });
  return { emailEnabled: true };
}

async function resetPassword(token, newPassword) {
  const userId = await authTokens.consume(token, 'PASSWORD_RESET');
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userModel.setPassword(userId, passwordHash); // also clears any lockout
  await auditService.record({ actor: null, action: 'PASSWORD_RESET_COMPLETED', entityType: 'user', entityId: userId });
}

async function verifyEmail(token) {
  const userId = await authTokens.consume(token, 'EMAIL_VERIFY');
  await userModel.markEmailVerified(userId);
  await auditService.record({ actor: null, action: 'EMAIL_VERIFIED', entityType: 'user', entityId: userId });
}

module.exports = { register, login, signToken, requestPasswordReset, resetPassword, verifyEmail, sendVerificationEmail, sanitizeUser };
