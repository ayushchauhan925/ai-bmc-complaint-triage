const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const userModel = require('../models/user.model');
const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/constants');

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
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
  const token = signToken(user);
  return { user, token };
}

async function login({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password.', 401);
  }
  const token = signToken(user);
  const { password_hash, ...publicUser } = user;
  return { user: publicUser, token };
}

module.exports = { register, login, signToken };
