const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const promptService = require('./prompt.service');
const { validateBeforeAfterResponse } = require('./aiResponseParser');
const logger = require('../../utils/logger');

// Section 21: before/after resolution verification. Advisory only - admin can always override.
async function verifyBeforeAfter({ description, beforeImageUrl, afterImageUrl }) {
  const client = getOpenAIClient();
  if (!client) {
    return { success: false, failureReason: 'OPENAI_API_KEY not configured.' };
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.openai.visionModel,
      messages: [
        { role: 'system', content: promptService.buildBeforeAfterSystemPrompt() },
        { role: 'user', content: promptService.buildBeforeAfterUserContent(description, beforeImageUrl, afterImageUrl) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 300,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const validated = validateBeforeAfterResponse(rawText);
    if (!validated.success) {
      return { success: false, failureReason: 'AI returned an unexpected response format.' };
    }
    return { success: true, result: validated.data };
  } catch (err) {
    logger.warn('Before/after verification call failed.', { error: err.message });
    return { success: false, failureReason: err.message };
  }
}

module.exports = { verifyBeforeAfter };
