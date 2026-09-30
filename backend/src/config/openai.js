const OpenAI = require('openai');
const env = require('./env');
const aiUsage = require('../services/ai/aiUsage.service');

let client = null;

// Wraps a single OpenAI call so every use case is measured (latency, tokens, estimated
// cost, failures) in one place. `useCase` is our own label - it is stripped before the
// request is sent to OpenAI. Errors are re-thrown unchanged so callers keep their existing
// graceful-degradation handling.
async function tracked(useCase, params, invoke) {
  const startedAt = Date.now();
  try {
    const result = await invoke();
    aiUsage.record({
      useCase,
      model: params.model,
      usage: result?.usage,
      latencyMs: Date.now() - startedAt,
      success: true,
    });
    return result;
  } catch (err) {
    aiUsage.record({
      useCase,
      model: params.model,
      usage: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      error: err.message,
    });
    throw err;
  }
}

function instrument(raw) {
  return {
    chat: {
      completions: {
        create: ({ useCase = 'unlabelled', ...params }) =>
          tracked(useCase, params, () => raw.chat.completions.create(params)),
      },
    },
    embeddings: {
      create: ({ useCase = 'unlabelled', ...params }) =>
        tracked(useCase, params, () => raw.embeddings.create(params)),
    },
  };
}

function getOpenAIClient() {
  if (!env.openai.apiKey) return null;
  if (!client) {
    client = instrument(new OpenAI({ apiKey: env.openai.apiKey }));
  }
  return client;
}

module.exports = { getOpenAIClient };
