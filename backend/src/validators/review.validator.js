const { z } = require('zod');
const { CATEGORIES } = require('../utils/constants');

const optionalInt = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().positive().optional());

const reviewSchema = z
  .object({
    action: z.enum(['APPROVE', 'CORRECT', 'FALSE_POSITIVE', 'CONFIRM_DUPLICATE', 'REJECT_DUPLICATE']),
    category: z.enum(CATEGORIES).optional(),
    priority_level: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    department_id: optionalInt,
    related_complaint_id: optionalInt,
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'CORRECT' && !v.category && !v.priority_level && !v.department_id) {
      ctx.addIssue({ code: 'custom', message: 'Provide a corrected category, priority or department.', path: ['action'] });
    }
    if ((v.action === 'CONFIRM_DUPLICATE' || v.action === 'REJECT_DUPLICATE') && !v.related_complaint_id) {
      ctx.addIssue({ code: 'custom', message: 'related_complaint_id is required.', path: ['related_complaint_id'] });
    }
  });

module.exports = { reviewSchema };
