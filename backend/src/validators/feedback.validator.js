const { z } = require('zod');

const feedbackSchema = z.object({
  resolved: z.boolean(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

module.exports = { feedbackSchema };
