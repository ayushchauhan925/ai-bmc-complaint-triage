const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(150),
  email: z.string().trim().email('A valid email is required.').max(190),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal('').transform(() => undefined)),
});

const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

module.exports = { registerSchema, loginSchema };
