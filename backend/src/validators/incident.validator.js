const { z } = require('zod');
const { CATEGORIES } = require('../utils/constants');

const coordinate = (min, max) =>
  z.preprocess((v) => (typeof v === 'string' ? parseFloat(v) : v), z.number().min(min).max(max));

const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(255),
  category: z.enum(CATEGORIES),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  department_id: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().int().optional()),
});

const updateIncidentSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});

const addComplaintSchema = z.object({
  complaint_id: z.preprocess((v) => Number(v), z.number().int()),
});

const mergeIncidentSchema = z.object({
  source_incident_id: z.preprocess((v) => Number(v), z.number().int()),
});

module.exports = { createIncidentSchema, updateIncidentSchema, addComplaintSchema, mergeIncidentSchema };
