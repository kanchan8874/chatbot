/**
 * Client/General Query Handler
 * Handles general client queries (services, company info, etc.)
 */

const QAPair = require("../database/models/QAPair");
const { normalizeText, generateQuestionHash, hasMeaningfulOverlap } = require('../utils/textProcessing');
const { detectTopicIntent, INTENT_TO_CANONICAL_QUESTION } = require('../utils/intentDetection');
const { searchCSVQA, searchMongoDBByKeywords, searchMongoDBQA, searchDocuments } = require('../utils/searchUtils');
const llmService = require("../services/llmService");
const freeLLMService = require("../services/freeLLMService");

/**
 * Generate LLM response
 */
async function generateLLMResponse(question, context, userRole) {
  try {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      return await llmService.generateResponse(question, context, userRole);
    } else {
      console.log("📝 Using free Groq LLM service...");
      return await freeLLMService.generateResponse(question, context, userRole);
    }
  } catch (error) {
    console.error("❌ Error generating LLM response:", error.message);
    if (context.type === "qa") {
      return context.answer;
    }
    return "I encountered an error processing your request. Please try again.";
  }
}

/**
 * Handle client/general queries
 */
async function handleClientQuery(message, normalizedMessage, userRole, audienceFilter) {
  // 1) Detect topic intent and build canonical CSV question
  const topicIntent = detectTopicIntent(normalizedMessage);
  const canonicalNormalizedQuestion =
    (topicIntent && INTENT_TO_CANONICAL_QUESTION[topicIntent]) ||
    normalizedMessage;
  
  // 2) STRICT CSV MATCHING (HIGH‑CONFIDENCE ONLY)
  // 2.1 Exact/hash match in MongoDB
  let qaPair = await searchMongoDBQA(normalizedMessage, audienceFilter, userRole, message);
  
  if (qaPair) {
    console.log(`✅ Using exact/hash CSV Q&A match: "${qaPair.question.substring(0, 60)}..."`);
    return {
      response: qaPair.answer,
      context: { type: "qa", answer: qaPair.answer }
    };
  }
  
  // 2.2 High-confidence semantic CSV match in Pinecone ("qa" namespace)
  console.log("⚠️  Exact match not found, trying semantic CSV Q&A search in Pinecone 'qa' namespace...");
  const semanticQA = await searchCSVQA(canonicalNormalizedQuestion, userRole);
  
  if (
    semanticQA &&
    semanticQA.score &&
    semanticQA.score >= 0.82 &&
    hasMeaningfulOverlap(message, semanticQA.question)
  ) {
    console.log(`✅ Using HIGH‑confidence semantic CSV Q&A match with score: ${semanticQA.score}`);
    return {
      response: semanticQA.answer,
      context: { type: "qa", answer: semanticQA.answer }
    };
  }
  
  // 2.3 STRICT keyword-based search as last CSV attempt
  console.log("⚠️  No high-confidence semantic CSV match, trying STRICT keyword-based CSV search...");
  qaPair = await searchMongoDBByKeywords(normalizedMessage, audienceFilter, {
    skipFAQCheck: false,
    prioritizeFounder: true
  });
  
  if (qaPair) {
    console.log(`✅ Using STRICT keyword-based CSV match: "${qaPair.question.substring(0, 60)}..."`);
    return {
      response: qaPair.answer,
      context: { type: "qa", answer: qaPair.answer }
    };
  }
  
  // 3) CSV FAILED → DOCUMENT RAG
  console.log("⚠️  No high-confidence CSV Q&A match found, falling back to document RAG...");
  const chunks = await searchDocuments(
    message,
    userRole,
    userRole === "employee" ? "employee_docs" : "public_docs"
  );
  
  const goodChunks =
    chunks && chunks.length > 0 && chunks[0].score > 0.5
      ? chunks.filter((chunk) => chunk.score > 0.5)
      : [];
  
  if (goodChunks.length > 0) {
    const context = { type: "document", chunks: goodChunks };
    const response = await generateLLMResponse(message, context, userRole);
    return {
      response,
      context
    };
  }
  
  // No relevant data found
  return {
    response: "I couldn't find relevant information for this query. Please ask about Mobiloitte's services, solutions, or processes.",
    context: { type: "no_data_found" }
  };
}

module.exports = {
  handleClientQuery
};
