const OpenAI = require('openai');
const env = require('./env');

let client = null;

function getOpenAIClient() {
  if (!env.openai.apiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: env.openai.apiKey });
  }
  return client;
}

module.exports = { getOpenAIClient };
