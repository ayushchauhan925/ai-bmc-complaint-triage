const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const promptService = require('./prompt.service');
const { validateGuidedAssistResponse } = require('./aiResponseParser');
const logger = require('../../utils/logger');

// Section 1: guided complaint assistant. One-shot (not a chatbot) - takes a draft
// description and returns follow-up questions + a best-effort structured suggestion the
// citizen can review before submitting. Never decides final category/priority/routing.
async function getGuidedAssistance(draftText) {
  const client = getOpenAIClient();
  if (!client) {
    return { success: false, failureReason: 'OPENAI_API_KEY not configured.' };
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.openai.textModel,
      messages: [
        { role: 'system', content: promptService.buildGuidedAssistSystemPrompt() },
        { role: 'user', content: promptService.buildGuidedAssistUserContent(draftText) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 350,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const validated = validateGuidedAssistResponse(rawText);
    if (!validated.success) {
      return { success: false, failureReason: 'AI returned an unexpected response format.' };
    }
    return { success: true, assistance: validated.data };
  } catch (err) {
    logger.warn('Guided assistant call failed.', { error: err.message });
    return { success: false, failureReason: err.message };
  }
}

module.exports = { getGuidedAssistance };
