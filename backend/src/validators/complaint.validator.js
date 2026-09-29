const { z } = require('zod');

const coordinate = (min, max) =>
  z.preprocess((v) => (typeof v === 'string' ? parseFloat(v) : v), z.number().min(min).max(max));

const createComplaintSchema = z.object({
  description: z.string().trim().min(5, 'Please describe the issue in a bit more detail.').max(2000),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  address: z.string().trim().max(255).optional().or(z.literal('').transform(() => undefined)),
});

const updateComplaintSchema = z.object({
  category: z.string().trim().max(50).optional(),
  subcategory: z.string().trim().max(50).optional(),
  department_id: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().int().optional()),
  ward_id: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().int().optional()),
  address: z.string().trim().max(255).optional(),
  review_required: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.string().trim().min(2).max(30),
  notes: z.string().trim().max(500).optional(),
});

const assignSchema = z.object({
  department_id: z.preprocess((v) => Number(v), z.number().int()),
  officer_id: z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : Number(v)), z.number().int().optional()),
});

const duplicateCheckSchema = z.object({
  description: z.string().trim().min(5, 'Please describe the issue in a bit more detail.').max(2000),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
});

const reopenSchema = z.object({
  reason: z.string().trim().max(1000).optional().or(z.literal('').transform(() => undefined)),
});

const guidedAssistSchema = z.object({
  draft: z.string().trim().min(3, 'Please write at least a short draft.').max(1000),
});

module.exports = {
  createComplaintSchema,
  updateComplaintSchema,
  updateStatusSchema,
  assignSchema,
  duplicateCheckSchema,
  reopenSchema,
  guidedAssistSchema,
};
