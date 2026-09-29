const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const promptService = require('./prompt.service');
const { validateOfficerChecklistResponse } = require('./aiResponseParser');
const logger = require('../../utils/logger');

// Section 12: Officer AI Copilot - advisory inspection/evidence/resolution checklist.
async function generateChecklist(complaint) {
  const client = getOpenAIClient();
  if (!client) {
    return { success: false, failureReason: 'OPENAI_API_KEY not configured.' };
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.openai.textModel,
      messages: [
        { role: 'system', content: promptService.buildOfficerChecklistSystemPrompt() },
        { role: 'user', content: promptService.buildOfficerChecklistUserContent(complaint) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 400,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const validated = validateOfficerChecklistResponse(rawText);
    if (!validated.success) {
      return { success: false, failureReason: 'AI returned an unexpected response format.' };
    }
    return { success: true, checklist: validated.data };
  } catch (err) {
    logger.warn('Officer checklist generation failed.', { error: err.message });
    return { success: false, failureReason: err.message };
  }
}

module.exports = { generateChecklist };
