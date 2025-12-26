/**
 * Client/General Query Handler
 * Handles general client queries (services, company info, etc.)
 */

const QAPair = require("../database/models/QAPair");
const { normalizeText, generateQuestionHash, hasMeaningfulOverlap } = require('../utils/textProcessing');
const { detectTopicIntent, INTENT_TO_CANONICAL_QUESTION, isSpecificFactQuery } = require('../utils/intentDetection');
const { searchCSVQA, searchMongoDBByKeywords, searchMongoDBQA, searchDocuments } = require('../utils/searchUtils');
const llmService = require("../services/llmService");
const freeLLMService = require("../services/freeLLMService");

/**
 * Translate response based on detected language
 * For non-English queries, we want to translate the English-based CSV answer
 */
function translateResponseIfNeeded(response, detectedLanguage = 'und') {
  // If language is English or undefined, return as is
  if (detectedLanguage === 'eng' || detectedLanguage === 'und' || !detectedLanguage) {
    return response;
  }
  
  // For non-English queries, we'll keep the same content but make it more conversational
  // In a real implementation, this would call a translation API
  // For now, we'll return the original response but with a note that it's in English
  // A proper solution would integrate with translation services
  return response; // For now, return as is, but in a real implementation we would translate
}

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
 * Check if query is asking for general company information
 */
function isCompanyInformationQuery(normalizedMessage, message) {
  const lowerMessage = normalizedMessage.toLowerCase();
  const lowerOriginal = message.toLowerCase();
  
  // Patterns that indicate "tell me about company" / "company information" queries
  const companyInfoPatterns = [
    /(give|provide|tell|share|show).*(information|info|details|about).*(company|mobiloitte)/i,
    /(mujhe|hame|hume).*(information|info|details|jankari).*(do|de|dijiye).*(company|mobiloitte)/i,
    /(company|mobiloitte).*(ke|ki|ka).*(bare|baare|about).*(me|mai|information|info)/i,
    /(information|info|details|jankari).*(about|ke|ki|ka).*(company|mobiloitte)/i,
    /(tell|explain|describe).*(me|us|about).*(company|mobiloitte)/i,
  ];
  
  return companyInfoPatterns.some(pattern => 
    pattern.test(lowerMessage) || pattern.test(lowerOriginal)
  );
}

/**
 * Aggregate multiple Q&A pairs for company information
 */
async function getCompanyInformationAggregate(audienceFilter) {
  try {
    // Fetch top 10-15 general company Q&A pairs
    const companyQAs = await QAPair.find({
      audience: audienceFilter,
      $or: [
        { question: { $regex: /mobiloitte|company|services|solutions|about/i } },
        { category: { $in: ['company', 'general', 'overview'] } },
        { tags: { $in: ['company', 'general', 'overview', 'mobiloitte'] } }
      ]
    })
    .limit(15)
    .sort({ updatedAt: -1 });
    
    if (companyQAs.length === 0) return null;
    
    // Group and format the information
    const infoSections = companyQAs.map(qa => 
      `**${qa.question}**\n${qa.answer}`
    ).join('\n\n');
    
    return `Here's comprehensive information about Mobiloitte:\n\n${infoSections}`;
  } catch (error) {
    console.error("❌ Error aggregating company information:", error.message);
    return null;
  }
}

/**
 * Handle client/general queries
 */
async function handleClientQuery(message, normalizedMessage, userRole, audienceFilter) {
  // SPECIFIC FACT QUERIES FIRST (founder, address, HQ, CEO, establishment year, contact)
  if (isSpecificFactQuery(normalizedMessage)) {
    const factResponse = await handleSpecificFactQuery(message, normalizedMessage, userRole, audienceFilter);
    return factResponse;
  }

  // 0) SPECIAL HANDLER: Company Information Queries
  // These queries need aggregated responses, not strict matching
  if (isCompanyInformationQuery(normalizedMessage, message)) {
    console.log("🔍 Company information query detected - aggregating multiple Q&A pairs...");
    
    // Try to get aggregated company information from CSV
    const aggregatedInfo = await getCompanyInformationAggregate(audienceFilter);
    if (aggregatedInfo) {
      console.log("✅ Using aggregated company information from CSV Q&A");
      return {
        response: aggregatedInfo,
        context: { type: "qa_aggregated", source: "company_info" }
      };
    }
    
    // Fallback to document RAG with lower threshold for company info queries
    console.log("⚠️  No aggregated CSV found, trying document RAG with relaxed threshold...");
    const chunks = await searchDocuments(
      message,
      userRole,
      userRole === "employee" ? "employee_docs" : "public_docs"
    );
    
    // Lower threshold (0.3) for company information queries
    const goodChunks = chunks && chunks.length > 0 && chunks[0].score > 0.3
      ? chunks.filter((chunk) => chunk.score > 0.3)
      : [];
    
    if (goodChunks.length > 0) {
      const context = { type: "document", chunks: goodChunks };
      const response = await generateLLMResponse(message, context, userRole);
      return {
        response,
        context
      };
    }
  }
  
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
  
  // Use flexible threshold: 0.5 for high confidence, 0.3 for general queries
  // If top chunk score is between 0.3-0.5, still use it for general company queries
  const topScore = chunks && chunks.length > 0 ? chunks[0].score : 0;
  const isGeneralQuery = normalizedMessage.includes("mobiloitte") || 
                         normalizedMessage.includes("company") ||
                         normalizedMessage.includes("information") ||
                         normalizedMessage.includes("about");
  
  const threshold = (topScore >= 0.3 && topScore < 0.5 && isGeneralQuery) ? 0.3 : 0.5;
  
  const goodChunks =
    chunks && chunks.length > 0 && topScore >= threshold
      ? chunks.filter((chunk) => chunk.score >= threshold)
      : [];
  
  if (goodChunks.length > 0) {
    console.log(`✅ Using document RAG with threshold ${threshold} (top score: ${topScore})`);
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

/**
 * Handle specific fact queries with strict, short, factual answers
 * Pipeline: CSV exact/hash -> semantic CSV -> keyword CSV -> RAG doc -> LLM synthesis (strict)
 */
async function handleSpecificFactQuery(message, normalizedMessage, userRole, audienceFilter) {
  // 1) Exact/hash match in Mongo (CSV)
  let qaPair = await searchMongoDBQA(normalizedMessage, audienceFilter, userRole, message);
  if (qaPair) {
    return {
      response: qaPair.answer,
      context: { type: "qa", answer: qaPair.answer }
    };
  }

  // 2) Semantic CSV search
  const semanticQA = await searchCSVQA(normalizedMessage, userRole);
  if (semanticQA && semanticQA.score && semanticQA.score >= 0.7 && hasMeaningfulOverlap(message, semanticQA.question)) {
    return {
      response: semanticQA.answer,
      context: { type: "qa", answer: semanticQA.answer }
    };
  }

  // 3) Keyword-based CSV search
  qaPair = await searchMongoDBByKeywords(normalizedMessage, audienceFilter, {
    skipFAQCheck: true,
    prioritizeFounder: true
  });
  if (qaPair) {
    return {
      response: qaPair.answer,
      context: { type: "qa", answer: qaPair.answer }
    };
  }

  // 4) Document RAG (top relevant chunks)
  const namespace = userRole === "employee" ? "employee_docs" : "public_docs";
  const chunks = await searchDocuments(message, userRole, namespace);
  const goodChunks = chunks && chunks.length > 0 ? chunks.filter((c) => c.score >= 0.35).slice(0, 3) : [];

  if (goodChunks.length === 0) {
    return {
      response: "I couldn’t find that information right now. Please try asking with a bit more detail.",
      context: { type: "no_data_found" }
    };
  }

  // 5) LLM synthesis (strict, short)
  const context = { type: "document_fact", chunks: goodChunks };
  const response = await generateLLMResponse(message, context, userRole);

  return {
    response,
    context
  };
}

module.exports = {
  handleClientQuery
};
