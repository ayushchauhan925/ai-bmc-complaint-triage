const { z } = require('zod');
const { CATEGORIES } = require('../utils/constants');

const slaPolicySchema = z.object({
  priority_level: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum(CATEGORIES).optional(),
  target_hours: z.preprocess((v) => Number(v), z.number().int().min(1).max(24 * 90)),
  warning_pct: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().gt(0).lt(1).optional()),
  is_active: z.boolean().optional(),
});

const evaluationSchema = z.object({ mode: z.enum(['deterministic', 'live']).optional() });

module.exports = { slaPolicySchema, evaluationSchema };
