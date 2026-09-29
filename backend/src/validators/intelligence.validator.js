const { z } = require('zod');

const aiSearchSchema = z.object({
  query: z.string().trim().min(3, 'Please describe what you are looking for.').max(500),
});

module.exports = { aiSearchSchema };
