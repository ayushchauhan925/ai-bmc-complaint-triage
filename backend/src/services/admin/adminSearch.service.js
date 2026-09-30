const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const promptService = require('../ai/prompt.service');
const { validateAdminSearchFilterResponse } = require('../ai/aiResponseParser');
const complaintModel = require('../../models/complaint.model');
const departmentModel = require('../../models/department.model');
const wardModel = require('../../models/ward.model');
const logger = require('../../utils/logger');
const {
  ADMIN_SEARCH_ALLOWED_FIELDS,
  CATEGORIES,
  COMPLAINT_STATUS,
} = require('../../utils/constants');

function describeAllowedFields() {
  return Object.entries(ADMIN_SEARCH_ALLOWED_FIELDS)
    .map(([field, spec]) => {
      if (spec.type === 'enum' && spec.values) return `"${field}": one of ${spec.values.join(', ')}`;
      if (spec.type === 'enum[]' && spec.values) return `"${field}": array, subset of ${spec.values.join(', ')}`;
      return `"${field}": ${spec.type}`;
    })
    .join('\n');
}

/**
 * Section 9: AI admin natural-language search. The LLM NEVER produces SQL - it only
 * produces a JSON filter object, which is then re-validated field-by-field against
 * ADMIN_SEARCH_ALLOWED_FIELDS (an explicit allowlist) before anything touches the
 * database. Any field/value outside the allowlist is silently dropped, never executed.
 */
async function naturalLanguageToFilters(query) {
  const client = getOpenAIClient();
  if (!client) {
    return { success: false, failureReason: 'OPENAI_API_KEY not configured.' };
  }

  try {
    const completion = await client.chat.completions.create({
      useCase: 'admin_search',
      model: env.openai.textModel,
      messages: [
        { role: 'system', content: promptService.buildAdminSearchSystemPrompt(describeAllowedFields()) },
        { role: 'user', content: promptService.buildAdminSearchUserContent(query) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 300,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const validated = validateAdminSearchFilterResponse(rawText);
    if (!validated.success) {
      return { success: false, failureReason: 'AI returned an unexpected response format.' };
    }
    return { success: true, rawFilters: validated.data };
  } catch (err) {
    logger.warn('Admin AI search call failed.', { error: err.message });
    return { success: false, failureReason: err.message };
  }
}

/**
 * Re-validates every field of the AI's raw filter object against the allowlist, resolves
 * department_code/ward_code to their live database ids, and returns only safe, known-good
 * filters. Anything that doesn't pass is dropped (never throws, never passes through).
 */
async function sanitizeFilters(rawFilters) {
  const safe = {};
  const dropped = [];

  const isValidDateString = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  if (rawFilters.category && CATEGORIES.includes(rawFilters.category)) {
    safe.category = rawFilters.category;
  } else if (rawFilters.category) {
    dropped.push('category');
  }

  if (Array.isArray(rawFilters.status)) {
    const validStatuses = rawFilters.status.filter((s) => Object.values(COMPLAINT_STATUS).includes(s));
    if (validStatuses.length) safe.status = validStatuses;
    if (validStatuses.length !== rawFilters.status.length) dropped.push('status');
  }

  if (Array.isArray(rawFilters.priority_level)) {
    const valid = rawFilters.priority_level.filter((p) => ADMIN_SEARCH_ALLOWED_FIELDS.priority_level.values.includes(p));
    if (valid.length) safe.priority_level = valid;
  }

  if (Array.isArray(rawFilters.sla_status)) {
    const valid = rawFilters.sla_status.filter((s) => ADMIN_SEARCH_ALLOWED_FIELDS.sla_status.values.includes(s));
    if (valid.length) safe.sla_status = valid;
  }

  if (rawFilters.department_code) {
    const dept = await departmentModel.findByCode(rawFilters.department_code.toUpperCase());
    if (dept) safe.department_id = dept.id;
    else dropped.push('department_code');
  }

  if (rawFilters.ward_code) {
    const wards = await wardModel.findAll();
    const ward = wards.find((w) => w.ward_code.toUpperCase() === rawFilters.ward_code.toUpperCase());
    if (ward) safe.ward_id = ward.id;
    else dropped.push('ward_code');
  }

  if (typeof rawFilters.near_school === 'boolean') safe.near_school = rawFilters.near_school;
  if (typeof rawFilters.near_hospital === 'boolean') safe.near_hospital = rawFilters.near_hospital;
  if (typeof rawFilters.review_required === 'boolean') safe.review_required = rawFilters.review_required;

  if (typeof rawFilters.min_related_count === 'number' && rawFilters.min_related_count > 0) {
    safe.min_related_count = Math.min(Math.floor(rawFilters.min_related_count), 10000);
  }

  if (isValidDateString(rawFilters.date_from)) safe.date_from = rawFilters.date_from;
  else if (rawFilters.date_from) dropped.push('date_from');

  if (isValidDateString(rawFilters.date_to)) safe.date_to = rawFilters.date_to;
  else if (rawFilters.date_to) dropped.push('date_to');

  const limit = typeof rawFilters.limit === 'number' ? Math.max(1, Math.min(Math.floor(rawFilters.limit), 100)) : 20;

  return { safeFilters: safe, dropped, limit };
}

async function runSearch(query) {
  const aiResult = await naturalLanguageToFilters(query);
  if (!aiResult.success) {
    return { success: false, failureReason: aiResult.failureReason };
  }

  const { safeFilters, dropped, limit } = await sanitizeFilters(aiResult.rawFilters);
  const result = await complaintModel.list(safeFilters, { page: 1, limit });

  return {
    success: true,
    rawFilters: aiResult.rawFilters,
    appliedFilters: safeFilters,
    droppedFields: dropped,
    results: result.rows,
    total: result.total,
  };
}

module.exports = { naturalLanguageToFilters, sanitizeFilters, runSearch };
