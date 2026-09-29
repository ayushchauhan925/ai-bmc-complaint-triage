const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const promptService = require('./prompt.service');
const { validateAnalysisResponse } = require('./aiResponseParser');
const logger = require('../../utils/logger');

const MAX_RETRIES = 1;

async function callModel(messages) {
  const client = getOpenAIClient();
  if (!client) {
    return { ok: false, reason: 'OPENAI_API_KEY not configured.' };
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: env.openai.visionModel,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 600,
      });
      const rawText = completion.choices[0]?.message?.content || '';
      return { ok: true, rawText };
    } catch (err) {
      lastError = err;
      logger.warn('OpenAI analysis call failed, will retry if attempts remain.', {
        attempt,
        error: err.message,
      });
    }
  }
  return { ok: false, reason: lastError?.message || 'Unknown AI error' };
}

/**
 * Analyzes complaint text + optional images via OpenAI vision model.
 * Returns a normalized result object; never throws - callers must check `success`
 * so the rest of the pipeline (priority, routing) can proceed with sane fallbacks
 * even when the AI call fails (rule: app stays functional if AI fails).
 */
async function analyzeComplaint({ description, imageUrls = [] }) {
  // Images live on Cloudinary at a public HTTPS URL, so they're passed straight through -
  // no local file read / base64 conversion needed (see cloudinary.service.js).
  const messages = [
    { role: 'system', content: promptService.buildAnalysisSystemPrompt() },
    { role: 'user', content: promptService.buildAnalysisUserContent(description, imageUrls) },
  ];

  const modelResult = await callModel(messages);
  if (!modelResult.ok) {
    return { success: false, failureReason: modelResult.reason };
  }

  const validated = validateAnalysisResponse(modelResult.rawText);
  if (!validated.success) {
    logger.warn('AI response failed schema validation.', { error: validated.error });
    return { success: false, failureReason: 'AI returned an unexpected response format.' };
  }

  return { success: true, analysis: validated.data };
}

module.exports = { analyzeComplaint };
