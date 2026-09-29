const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authMiddleware = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Authentication required.', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    throw new AppError('Invalid or expired session. Please log in again.', 401);
  }

  // Always re-fetch the current role from the database rather than trusting the token's
  // cached role indefinitely stale, and never trust anything the client claims about itself.
  const user = await userModel.findById(payload.sub);
  if (!user) {
    throw new AppError('Account no longer exists.', 401);
  }

  req.user = user;
  next();
});

function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}

module.exports = { authMiddleware, roleMiddleware };
