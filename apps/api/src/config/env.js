require("dotenv").config();

const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/chatbot",
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT || "us-east-1",
    indexName: process.env.PINECONE_INDEX_NAME || "chatbot-index",
    dimension: parseInt(process.env.PINECONE_DIMENSION) || 1536
  }
};

module.exports = config;