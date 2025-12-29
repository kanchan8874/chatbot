require("dotenv").config();

const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/chatbot",
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT || "us-east-1",
    indexName: process.env.PINECONE_INDEX_NAME || "chatbot-index",
    dimension: parseInt(process.env.PINECONE_DIMENSION) || 1536
  },
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
    embeddingModel: process.env.COHERE_EMBEDDING_MODEL || "embed-english-v3.0",
    embeddingDimension: parseInt(process.env.COHERE_EMBEDDING_DIMENSION) || 1024
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    embeddingDimension: parseInt(process.env.OPENAI_EMBEDDING_DIMENSION) || 1536
  }
};

module.exports = config;