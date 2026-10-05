const { z } = require('zod');

const id = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().positive());
const optionalId = z.preprocess((v) => (v === '' || v === undefined ? undefined : v === null ? null : Number(v)), z.number().int().positive().nullable().optional());

const officerCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(150),
  email: z.string().trim().email('A valid email is required.').max(190),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal('').transform(() => undefined)),
  department_id: id,
  ward_id: optionalId,
});

const officerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional().or(z.literal('').transform(() => null)),
  department_id: id.optional(),
  ward_id: optionalId,
  is_active: z.boolean().optional(),
  // When deactivating (or moving departments), also release the officer's open complaints back to the queue.
  release_assignments: z.boolean().optional(),
});

const officerPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
});

const departmentUpdateSchema = z.object({
  description: z.string().trim().min(3).max(500).optional(),
  contact_email: z.string().trim().email().max(190).nullable().optional().or(z.literal('').transform(() => null)),
  contact_phone: z.string().trim().min(5).max(30).nullable().optional().or(z.literal('').transform(() => null)),
  is_active: z.boolean().optional(),
  // Required to deactivate a department that still has open complaints.
  reassign_to_department_id: optionalId,
});

module.exports = { officerCreateSchema, officerUpdateSchema, officerPasswordSchema, departmentUpdateSchema };
