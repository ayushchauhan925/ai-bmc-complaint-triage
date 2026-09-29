const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const embeddingModel = require('../../models/embedding.model');
const logger = require('../../utils/logger');

async function generateEmbedding(text) {
  const client = getOpenAIClient();
  if (!client) {
    return { success: false, failureReason: 'OPENAI_API_KEY not configured.' };
  }
  try {
    const response = await client.embeddings.create({
      model: env.openai.embeddingModel,
      input: text.slice(0, 8000),
    });
    return { success: true, embedding: response.data[0].embedding };
  } catch (err) {
    logger.warn('Embedding generation failed.', { error: err.message });
    return { success: false, failureReason: err.message };
  }
}

async function generateAndStoreEmbedding(complaintId, text) {
  const result = await generateEmbedding(text);
  if (!result.success) return result;
  await embeddingModel.upsert(complaintId, result.embedding, env.openai.embeddingModel);
  return result;
}

module.exports = { generateEmbedding, generateAndStoreEmbedding };
