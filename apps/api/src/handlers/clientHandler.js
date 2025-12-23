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
  // Detect topic intent
  const topicIntent = detectTopicIntent(normalizedMessage);
  
  // Get canonical question
  const canonicalNormalizedQuestion =
    (topicIntent && INTENT_TO_CANONICAL_QUESTION[topicIntent]) ||
    normalizedMessage;
  
  const normalizedQuestion = canonicalNormalizedQuestion;
  const questionHash = generateQuestionHash(normalizedQuestion);
  
  // Try exact match first
  let qaPair = await searchMongoDBQA(normalizedMessage, audienceFilter, userRole, message);
  
  // If exact match fails, try keyword-based fuzzy search
  if (!qaPair) {
    console.log("⚠️  Exact match failed, trying keyword-based fuzzy search in MongoDB...");
    qaPair = await searchMongoDBByKeywords(normalizedMessage, audienceFilter, {
      skipFAQCheck: false,
      prioritizeFounder: true
    });
  }
  
  if (qaPair) {
    return {
      response: qaPair.answer,
      context: { type: "qa", answer: qaPair.answer }
    };
  }
  
  // Try semantic search in Pinecone
  console.log("⚠️  Exact match not found, trying semantic search in Pinecone 'qa' namespace...");
  const semanticQA = await searchCSVQA(canonicalNormalizedQuestion, userRole);
  
  if (
    semanticQA &&
    semanticQA.score > 0.8 &&
    hasMeaningfulOverlap(message, semanticQA.question)
  ) {
    console.log(`✅ Using semantic CSV Q&A match with score: ${semanticQA.score}`);
    return {
      response: semanticQA.answer,
      context: { type: "qa", answer: semanticQA.answer }
    };
  }
  
  // Try MongoDB keyword search as fallback
  console.log("⚠️  Pinecone search failed, trying MongoDB keyword search as fallback...");
  const fallbackQAPair = await searchMongoDBByKeywords(normalizedMessage, audienceFilter, {
    skipFAQCheck: false,
    prioritizeFounder: true
  });
  
  if (fallbackQAPair) {
    console.log(`✅ Found Q&A via MongoDB keyword fallback: "${fallbackQAPair.question.substring(0, 60)}..."`);
    return {
      response: fallbackQAPair.answer,
      context: { type: "qa", answer: fallbackQAPair.answer, source: "mongodb_keyword_fallback" }
    };
  }
  
  // Fall back to document RAG search
  console.log("⚠️  No reliable CSV Q&A match found, falling back to document RAG...");
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
