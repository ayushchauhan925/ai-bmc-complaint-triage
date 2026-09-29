const AppError = require('../utils/AppError');

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Validation failed.', 400, details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
