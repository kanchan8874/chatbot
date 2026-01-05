/**
 * Client/General Query Handler
 * Handles general client queries (services, company info, etc.)
 */

const QAPair = require("../database/models/QAPair");
const { normalizeText, generateQuestionHash, hasMeaningfulOverlap } = require('../utils/textProcessing');
const { detectTopicIntent, INTENT_TO_CANONICAL_QUESTION, isSpecificFactQuery, detectMultiIntent, detectClarificationIntent, detectDetailedIntent } = require('../utils/intentDetection');
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
 * Handle client/general queries
 */
async function handleClientQuery(message, normalizedMessage, userRole, audienceFilter) {
  // 0.1) QUERY EXPANSION (Improve retrieval for generic terms)
  let searchMessage = message;
  const genericCompanyContexts = [
    "this company", "the company", "your company", "this organization", "your organization",
    "is company", "of company", "about company"
  ];
  const hasOfficialName = normalizedMessage.includes("mobiloitte");
  const hasTypo = normalizedMessage.includes("mobiloite");
  const hasGeneric = genericCompanyContexts.some(ctx => normalizedMessage.includes(ctx));
  
  if (!hasOfficialName && (hasGeneric || hasTypo)) {
    console.log(`🔍 Company reference or typo ("${hasTypo ? 'mobiloite' : 'generic'}") detected. Injecting 'Mobiloitte' for retrieval.`);
    searchMessage = `${message} (Mobiloitte)`;
  }
  const normalizedSearchMessage = searchMessage.toLowerCase();

  // 0.1) MULTI-INTENT CHECK (Fact + Context)
  if (detectMultiIntent(normalizedMessage)) {
    console.log("🔀 Multi-intent query detected. Executing combined retrieval.");
    return await handleMultiIntentQuery(searchMessage, normalizedSearchMessage, userRole, audienceFilter);
  }

  // 0.2) CLARIFICATION INTENT (Is this X? Kya ye X hai?)
  const isClarification = detectClarificationIntent(normalizedMessage);
  
  // 0.3) DETAILED INTENT CHECK
  const isDetailedIntent = detectDetailedIntent(normalizedMessage);

  // SPECIFIC FACT QUERIES FIRST (founder, address, HQ, CEO, establishment year, contact)
  if (isSpecificFactQuery(normalizedMessage)) {
    const factResponse = await handleSpecificFactQuery(message, normalizedMessage, userRole, audienceFilter);
    return factResponse;
  }

  // 0.3) DETAILED INTENT (Process, Steps, Explain, How to) -> PRIORITIZE RAG
  // Don't look at CSV for "Explain process" unless we fail here
  if (isDetailedIntent) {
     console.log("📘 Detailed Intent detected. Prioritizing Document RAG search.");
     const chunks = await searchDocuments(
       searchMessage,
       userRole,
       userRole === "employee" ? "employee_docs" : "public_docs"
     );
     
     // Stricter threshold for Detailed Queries to ensure quality
     const topScore = chunks && chunks.length > 0 ? chunks[0].score : 0;
     
     // If we find RELEVANT docs, return immediately and skip CSV
     if (topScore > 0.45) { 
        const goodChunks = chunks.filter(c => c.score > 0.4);
        console.log(`✅ Using Document RAG for detailed intent (Score: ${topScore})`);
        
        const context = { type: "document", chunks: goodChunks };
        const response = await generateLLMResponse(message, context, userRole);
        return { response, context };
     }
     console.log("⚠️  Detailed intent but low RAG score. Falling back to strict CSV/General flow.");
  }


  
  // 1) Detect topic intent and build canonical CSV question
  const topicIntent = detectTopicIntent(normalizedSearchMessage);
  const canonicalNormalizedQuestion =
    (topicIntent && INTENT_TO_CANONICAL_QUESTION[topicIntent]) ||
    normalizedSearchMessage;
  
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
  
  // Dynamic Thresholds: Stricter for Employees (0.85), Standard for Public (0.80)
  const csvThreshold = userRole === 'employee' ? 0.85 : 0.80;

  if (
    semanticQA &&
    semanticQA.score &&
    semanticQA.score >= csvThreshold &&
    hasMeaningfulOverlap(searchMessage, semanticQA.question)
  ) {
    console.log(`✅ Using HIGH‑confidence semantic CSV Q&A match with score: ${semanticQA.score}`);
    return {
      response: semanticQA.answer,
      context: { type: "qa", answer: semanticQA.answer }
    };
  }
  
  // 2.3 STRICT keyword-based search as last CSV attempt
  // SKIP if clarification intent OR detailed intent (prevent "Services" answer for "Explain Process")
  // 2.3 STRICTOR: MongoDB Keyword search (fallback for semantic)
  if (!isClarification && !isDetailedIntent) {
    console.log("⚠️  No high-confidence semantic CSV match, trying STRICT keyword-based CSV search...");
    qaPair = await searchMongoDBByKeywords(normalizedSearchMessage, audienceFilter, {
      skipFAQCheck: false,
      prioritizeFounder: true
    });
  } else {
    console.log("ℹ️  Clarification/Detailed intent detected - Skipping keyword-based CSV search to prevent hallucinations.");
  }
  
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
    searchMessage,
    userRole,
    userRole === "employee" ? "employee_docs" : "public_docs"
  );
  
  const topScore = chunks && chunks.length > 0 ? chunks[0].score : 0;
  
  // Stricter RAG threshold: 0.60 for high confidence
  // We no longer relax this for general queries to avoid low-signal hallucinations
  const threshold = 0.60;
  
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
  if (isClarification) {
      return {
          response: "I'm sorry, but I don't have verified information to confirm that specific detail at the moment. Please ask about Mobiloitte's core services like AI, Blockchain, or IoT development.",
          context: { type: "refusal_clarification" }
      };
  }

  if (isDetailedIntent) {
      return {
          response: "I couldn't find a verified step-by-step process or detailed documentation for this specific request. I can only provide information based on our official knowledge base.",
          context: { type: "refusal_detailed" }
      };
  }

  return {
    response: "I don't have sufficient verified information to answer this question. Please ask about Mobiloitte's services, company background, or specific technologies we work with.",
    context: { type: "hard_refusal" }
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


/**
 * Handle multi-intent queries (Fact + Context)
 * Example: "Who is the founder and what are the AI services?"
 */
async function handleMultiIntentQuery(message, normalizedMessage, userRole, audienceFilter) {
  console.log("🚀 Starting Multi-Intent Retrieval...");

  // Parallel Retrieval: 1. CSV Facts, 2. RAG Documents
  const [keywordQA, semanticQA, ragChunks] = await Promise.all([
    // 1. Keyword CSV (Prioritize Founder/Basic Facts)
    searchMongoDBByKeywords(normalizedMessage, audienceFilter, { skipFAQCheck: true, prioritizeFounder: true }),
    
    // 2. Semantic CSV (Semantic Search)
    searchCSVQA(normalizedMessage, userRole),
    
    // 3. Document RAG (Context/Services)
    searchDocuments(message, userRole, userRole === "employee" ? "employee_docs" : "public_docs")
  ]);

  // Aggregate Context
  let combinedContext = [];
  let sources = [];
  
  // Process CSV Results
  if (keywordQA) {
    combinedContext.push(`Fact (from Database): ${keywordQA.answer}`);
    sources.push("Database");
  }
  
  if (semanticQA && semanticQA.score > 0.75) {
     // Avoid partial duplicates if possible
     if (!keywordQA || keywordQA.answer !== semanticQA.answer) {
        combinedContext.push(`Related Info (from FAQ): ${semanticQA.answer}`);
        sources.push("FAQ");
     }
  }

  // Process RAG Results (Top 3)
  const topChunks = ragChunks ? ragChunks.filter(c => c.score > 0.35).slice(0, 3) : [];
  if (topChunks.length > 0) {
    combinedContext.push(...topChunks.map(c => `Document Excerpt: ${c.content}`));
    sources.push("Documents");
  }

  if (combinedContext.length === 0) {
     return {
       response: "I couldn't find specific information for both parts of your query. Could you please ask them one by one?",
       context: { type: "no_data_found" }
     };
  }

  // Synthesis via LLM
  console.log("🧠 Sending combined context to LLM for synthesis");
  
  // Create a specialized prompt context for multi-intent
  const multiIntentContext = {
    type: "multi_intent",
    data: combinedContext.join("\n\n---\n\n"),
    sources: sources,
    original_query: message
  };

  const response = await generateLLMResponse(message, multiIntentContext, userRole);

  return {
    response: response, // The LLM result
    context: multiIntentContext // For frontend debugging/citations
  };
}

module.exports = {
  handleClientQuery,
  handleMultiIntentQuery
};
