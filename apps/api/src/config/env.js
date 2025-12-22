// Load environment variables
// Important: Our .env file is inside src/.env, not at project root
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

// Determine which embedding service will be used (for dimension matching)
// Check if Cohere API key exists (either as COHERE_API_KEY or in OPENAI_API_KEY)
const cohereApiKeyEnv = process.env.COHERE_API_KEY;
const openaiApiKeyEnv = process.env.OPENAI_API_KEY;
const hasCohereKey = !!(cohereApiKeyEnv || (openaiApiKeyEnv && openaiApiKeyEnv.includes && openaiApiKeyEnv.includes('Tsl0Kl2dEK')));
const cohereApiKey = cohereApiKeyEnv || (openaiApiKeyEnv && openaiApiKeyEnv.includes && openaiApiKeyEnv.includes('Tsl0Kl2dEK') ? openaiApiKeyEnv : null);
const useCohere = hasCohereKey;

const config = {
  // Backend API should use port 4000 (ignore PORT env var, use API_PORT if set)
  port: process.env.API_PORT ? parseInt(process.env.API_PORT) : 4000,
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/chatbot",
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT || "us-east-1",
    indexName: process.env.PINECONE_INDEX_NAME || "chatbot-index",
    // Auto-detect dimension: Cohere (1024) > OpenAI (1536) > default (1536)
    dimension: parseInt(process.env.PINECONE_DIMENSION) || (useCohere ? 1024 : 1536)
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
    embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION) || 1536
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY
  },
  cohere: {
    apiKey: cohereApiKey,
    embeddingModel: process.env.COHERE_EMBEDDING_MODEL || "embed-english-v3.0",
    embeddingDimension: parseInt(process.env.COHERE_EMBEDDING_DIMENSION) || 1024 // Cohere v3.0 default is 1024
  }
};

module.exports = config;