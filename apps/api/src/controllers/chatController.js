const QAPair = require("../database/models/QAPair");
const IngestionJob = require("../database/models/IngestionJob");
const embeddingService = require("../services/embeddingService");
const llmService = require("../services/llmService");
const freeLLMService = require("../services/freeLLMService");
const pineconeService = require("../services/pineconeService");

// Simple gibberish / meaningless input detection
function isGibberish(text) {
  if (!text) return true;

  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Very short non-conversational text like "hi" / "ok" is handled
  // earlier by conversational intent detection, so here we only treat
  // it as gibberish if it's short AND has no spaces AND no vowels.
  if (trimmed.length < 3) {
    const vowels = trimmed.match(/[aeiouAEIOU]/g);
    const hasVowel = !!vowels;
    const hasSpace = /\s/.test(trimmed);
    if (!hasSpace && !hasVowel) {
      return true;
    }
  }

  // Check if text is mostly non-alphabetic
  const alphaChars = trimmed.match(/[a-zA-Z]/g);
  if (!alphaChars) return true;

  const alphaRatio = alphaChars.length / trimmed.length;
  if (alphaRatio < 0.5) return true;

  // Heuristic: if there are no spaces and the token looks like
  // random characters (no vowels or too many consonants), treat as gibberish.
  const hasSpace = /\s/.test(trimmed);
  if (!hasSpace) {
    const vowels = trimmed.match(/[aeiouAEIOU]/g) || [];
    const consonants = trimmed.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || [];
    if (consonants.length >= 5 && vowels.length === 0) {
      return true;
    }
  }

  // Token-level check: if there are no meaningful words at all,
  // treat as gibberish. "Meaningful" here is a small allowlist of
  // English / domain keywords.
  const normalized = normalizeText(trimmed);
  const tokens = normalized.split(" ");
  const meaningfulKeywords = [
    "what", "how", "why", "when", "where",
    "service", "services", "mobiloitte", "company",
    "ai", "blockchain", "policy", "process",
    "contact", "technology", "technologies", "solution", "solutions"
  ];

  const hasMeaningfulWord = tokens.some((t) => meaningfulKeywords.includes(t));
  if (!hasMeaningfulWord && tokens.length <= 3 && !hasSpace) {
    // Short, single-token strings with no meaningful words are likely garbage
    return true;
  }

  return false;
}

/**
 * Detect greetings and small talk (conversational intents)
 * Returns intent type: "greeting", "thanks", "goodbye", or null
 */
function detectConversationalIntent(message) {
  const normalized = normalizeText(message);
  const trimmed = normalized.trim();
  
  // Greetings
  const greetingPatterns = [
    /^(hi|hello|hey|hii|hiii|hiiii|hiya|heya)$/,
    /^(good\s+(morning|afternoon|evening|night|day))$/,
    /^(greetings?|sup|what'?s\s+up|wassup)$/,
    /^(howdy|hola|namaste)$/,
    /^(how\s+are\s+you\??)$/,
    /^(how\s+r\s+u\??)$/,
    /^(how\s+are\s+you\s+doing\??)$/,
    /^(how\s+do\s+you\s+do\??)$/
  ];
  
  for (const pattern of greetingPatterns) {
    if (pattern.test(trimmed)) {
      return "greeting";
    }
  }
  
  // Thanks/Appreciation
  const thanksPatterns = [
    /^(thanks?|thank\s+you|thx|ty|appreciate|grateful)$/,
    /^(thanks?\s+(a\s+lot|so\s+much|very\s+much))$/,
    /^(much\s+appreciated|i\s+appreciate)$/
  ];
  
  for (const pattern of thanksPatterns) {
    if (pattern.test(trimmed)) {
      return "thanks";
    }
  }
  
  // Goodbye/Farewell
  const goodbyePatterns = [
    /^(bye|goodbye|see\s+ya|see\s+you|farewell|later|cya)$/,
    /^(have\s+a\s+(good|nice|great)\s+(day|evening|night))$/,
    /^(take\s+care|ttyl|talk\s+to\s+you\s+later)$/
  ];
  
  for (const pattern of goodbyePatterns) {
    if (pattern.test(trimmed)) {
      return "goodbye";
    }
  }
  
  return null;
}

/**
 * Get predefined friendly response for conversational intents
 */
function getConversationalResponse(intent) {
  const responses = {
    greeting: [
      "Hi! 👋 How can I help you today?",
      "Hello! Ask me anything about Mobiloitte's services, AI solutions, or company information.",
      "Hey there! I'm here to help with questions about Mobiloitte. What would you like to know?",
      "Hi! I can help you learn about our AI development services, company information, and more. What can I help you with?",
      "I'm doing well, thanks for asking! I can help you with questions about Mobiloitte's services, AI solutions, or company information. What would you like to know?",
      "I'm great! How can I assist you with Mobiloitte-related questions today?"
    ],
    thanks: [
      "You're welcome! Feel free to ask if you need anything else.",
      "Happy to help! Let me know if you have more questions.",
      "You're welcome! Is there anything else you'd like to know?",
      "Glad I could help! Feel free to reach out anytime."
    ],
    goodbye: [
      "Goodbye! Have a great day! 👋",
      "See you later! Feel free to come back if you have more questions.",
      "Take care! Have a wonderful day!",
      "Goodbye! Thanks for chatting with Mobiloitte AI."
    ]
  };
  
  const options = responses[intent] || [];
  // Return random response for variety
  return options[Math.floor(Math.random() * options.length)];
}

// Normalize text for matching
function normalizeText(text) {
  if (!text) return "";
  return text
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Generate simple hash for question matching
function generateQuestionHash(question) {
  let hash = 0;
  for (let i = 0; i < question.length; i++) {
    const char = question.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString();
}

// Check lexical overlap between user query and candidate CSV question.
// This prevents high-score but semantically unrelated matches.
function hasMeaningfulOverlap(query, candidateQuestion) {
  if (!query || !candidateQuestion) return false;

  const stopwords = new Set([
    "what", "is", "are", "the", "a", "an", "of", "for", "in", "on",
    "and", "or", "to", "about", "this", "that", "does", "do", "you",
    "me", "my", "your", "please", "tell", "explain", "describe"
  ]);

  const normalizeTokens = (text) =>
    normalizeText(text)
      .split(" ")
      .filter((t) => t && !stopwords.has(t));

  const queryTokens = new Set(normalizeTokens(query));
  const candidateTokens = new Set(normalizeTokens(candidateQuestion));

  if (queryTokens.size === 0 || candidateTokens.size === 0) return false;

  let overlapCount = 0;
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) {
      overlapCount++;
    }
  }

  // Require at least 1 overlapping meaningful token
  return overlapCount > 0;
}

// --- Intent-based topic detection for CSV Q&A ---

// Map high-level topic intents to canonical CSV questions (normalized form).
// This keeps the bot intent-driven instead of relying on exact wording.
const INTENT_TO_CANONICAL_QUESTION = {
  // Services & offerings (overview of all solutions)
  services_overview: "what services does mobiloitte provide?",

  // AI solutions – map multiple phrasings to the curated Traditional AI answer
  ai_solutions: "what are traditional ai solutions?",
  traditional_ai: "what are traditional ai solutions?",

  // Specific solution areas
  blockchain_solutions: "how does mobiloitte use ai for blockchain?",
  web_mobile_ai: "what ai services are available for web and mobile apps?",

  // Company information
  industries: "what industries does mobiloitte serve?",
  experience: "how many years of experience does mobiloitte have?",
  technologies: "what technologies does mobiloitte use for ai?",
  contact: "how can i contact mobiloitte?",
};

// Detect fine-grained topic intent inside CSV Q&A domain.
// This is separate from high-level routing (csv_qa vs document_rag).
// IMPORTANT: Order matters - more specific intents should be checked first
function detectTopicIntent(normalizedMessage) {
  if (!normalizedMessage) return null;
  const text = normalizedMessage;

  // PRIORITY 1: Services overview (highest priority for general service questions)
  // Check for services/solutions/offerings/specialize/portfolio FIRST
  // This ensures "What solutions does Mobiloitte provide?" maps to services, not industries
  if (
    text.includes("service") || 
    text.includes("services") || 
    text.includes("offering") ||
    text.includes("offerings") ||
    text.includes("solution") ||
    text.includes("solutions") ||
    text.includes("specialize") ||
    text.includes("specialization") ||
    text.includes("speciality") ||
    text.includes("speciality") ||
    text.includes("portfolio") ||
    text.includes("core services") ||
    text.includes("main offerings") ||
    text.includes("type of services") ||
    text.includes("kind of services")
  ) {
    // BUT: If it's specifically asking about "technology solutions" or "technologies",
    // and NOT asking about general services, then it's technologies intent
    // However, if "services" is also mentioned, prioritize services_overview
    if (text.includes("technology") && !text.includes("service") && !text.includes("solution")) {
      return "technologies";
    }
    // If "businesses" is mentioned with services/solutions, it's still services_overview
    // (not industries - industries is about which sectors they serve, not what they provide)
    return "services_overview";
  }

  // PRIORITY 2: Traditional AI (specific, before general AI solutions)
  if (
    text.includes("traditional ai") ||
    text.includes("traditional ai solution") ||
    text.includes("traditional ai solutions")
  ) {
    return "traditional_ai";
  }

  // PRIORITY 3: General AI solutions (but only if services/solutions not already matched)
  // This handles "What type of AI services?" - but wait, "services" already matched above
  // So this will only trigger if query is purely about AI without "services" keyword
  if (
    (text.includes("ai solution") ||
    text.includes("ai solutions") ||
    text.includes("ai offering") ||
    text.includes("ai offerings")) &&
    !text.includes("service") // Don't override services_overview
  ) {
    return "ai_solutions";
  }

  // PRIORITY 4: Other specific intents
  if (text.includes("blockchain")) return "blockchain_solutions";
  if (text.includes("web") && text.includes("mobile")) return "web_mobile_ai";
  
  // Technologies (only if services/solutions not mentioned)
  if (
    (text.includes("technology") || text.includes("technologies") || text.includes("tools")) &&
    !text.includes("service") &&
    !text.includes("solution")
  ) {
    return "technologies";
  }
  
  // Industries (only if explicitly asking about industries/sectors, not what they provide)
  if (
    (text.includes("industry") || text.includes("industries") || text.includes("sectors")) &&
    !text.includes("service") &&
    !text.includes("solution")
  ) {
    return "industries";
  }
  
  if (text.includes("experience") || text.includes("years of experience")) {
    return "experience";
  }
  
  if (
    text.includes("contact") ||
    text.includes("reach you") ||
    text.includes("get in touch") ||
    text.includes("email") ||
    text.includes("phone")
  ) {
    return "contact";
  }

  return null;
}

/**
 * Detect if query is out-of-scope (not related to Mobiloitte/company/services)
 * Examples: "how to make maggi", "what is weather", "tell me a joke"
 * These are valid questions but not relevant to our chatbot's purpose
 */
function isOutOfScope(normalizedMessage) {
  if (!normalizedMessage) return false;
  
  const text = normalizedMessage.toLowerCase();
  
  // Mobiloitte-related keywords (if any of these exist, it's IN scope)
  const scopeKeywords = [
    "mobiloitte", "company", "service", "services", "offering", "offerings",
    "ai", "artificial intelligence", "blockchain", "solution", "solutions",
    "technology", "technologies", "process", "policy", "procedure",
    "contact", "reach", "email", "phone", "website",
    "industry", "industries", "client", "clients", "project", "projects",
    "experience", "years", "team", "development", "integration"
  ];
  
  // Check if query contains any scope-related keywords
  const hasScopeKeyword = scopeKeywords.some(keyword => text.includes(keyword));
  if (hasScopeKeyword) {
    return false; // It's IN scope
  }
  
  // Out-of-scope patterns (general knowledge, cooking, weather, etc.)
  const outOfScopePatterns = [
    /how\s+to\s+(make|cook|prepare|do)\s+/,
    /what\s+is\s+(the\s+)?(weather|time|date|joke|recipe)/,
    /tell\s+me\s+(a\s+)?(joke|story|recipe)/,
    /explain\s+(to\s+me\s+)?(how|what|why)\s+(to\s+)?(make|cook|do)/,
    /(recipe|ingredient|food|cooking|maggi|noodles|pasta|rice)/
  ];
  
  // Check if query matches out-of-scope patterns
  for (const pattern of outOfScopePatterns) {
    if (pattern.test(text)) {
      return true; // It's OUT of scope
    }
  }
  
  // If query is a "how to" question without scope keywords, likely out-of-scope
  if (text.startsWith("how to ") || text.startsWith("how do ")) {
    return true;
  }
  
  return false; // Default: assume in-scope (let CSV/RAG handle it)
}

// Intent classification
function classifyIntent(message, userRole) {
  const lowerMessage = message.toLowerCase();
  
  // Employee operational queries
  if (userRole === "employee") {
    const operationalKeywords = [
      "leave balance", "sick leave", "annual leave", "vacation days",
      "payroll", "salary", "attendance", "timesheet"
    ];
    
    for (const keyword of operationalKeywords) {
      if (lowerMessage.includes(keyword)) {
        return "employee_operational";
      }
    }
  }
  
  // General FAQ queries that might have CSV answers
  const faqKeywords = [
    "service", "offer", "process", "faq", "policy", "procedure",
    "contact", "support", "hour", "location", "price", "cost"
  ];
  
  let faqScore = 0;
  for (const keyword of faqKeywords) {
    if (lowerMessage.includes(keyword)) {
      faqScore++;
    }
  }
  
  // Document/RAG queries (more complex, open-ended questions)
  // BUT: "explain", "define", "what do you mean by" with specific topics
  // should still go to CSV Q&A if topic is detected
  const ragKeywords = [
    "explain", "describe", "detail", "how does", "what is", 
    "tell me about", "guide", "tutorial", "process"
  ];
  
  let ragScore = 0;
  for (const keyword of ragKeywords) {
    if (lowerMessage.includes(keyword)) {
      ragScore++;
    }
  }
  
  // Check if query contains specific topic keywords that exist in CSV
  // If yes, prioritize CSV Q&A even if it has "explain"/"define" etc.
  const topicKeywords = [
    "traditional ai", "ai solutions", "ai services", "generative ai",
    "blockchain", "services", "mobiloitte", "company", "technologies",
    "industries", "experience", "contact"
  ];
  
  const hasTopicKeyword = topicKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Decision logic - prioritize CSV Q&A for FAQ-like questions
  // "What is", "What are", "What do you mean by", "Define", "Explain" 
  // with specific topics should go to CSV Q&A
  if (
    faqScore >= 1 || 
    lowerMessage.includes("what is") || 
    lowerMessage.includes("what are") ||
    lowerMessage.includes("what do you mean") ||
    (hasTopicKeyword && (lowerMessage.includes("explain") || lowerMessage.includes("define") || lowerMessage.includes("what is meant")))
  ) {
    return "csv_qa";
  } else if (ragScore >= 1) {
    return "document_rag";
  }
  
  // Default to CSV Q&A first (faster), then fallback to document RAG
  return "csv_qa";
}

// Mock function to simulate database query for employee data
async function getEmployeeData(employeeId, queryType) {
  // In a real implementation, this would query the actual database
  if (queryType === "leave_balance") {
    return {
      annualLeave: 20,
      usedLeave: 5,
      remainingLeave: 15,
      sickLeave: 10,
      usedSickLeave: 2,
      remainingSickLeave: 8
    };
  }
  return null;
}

/**
 * Real Pinecone search using embeddings
 * PRD requirement: Query Pinecone with metadata filter based on role
 * 
 * @param {string} query - User query text
 * @param {string} audience - User role (client/employee)
 * @param {string} namespace - Pinecone namespace (qa, public_docs, employee_docs)
 * @returns {Promise<Array>} - Retrieved chunks with scores
 */
async function searchDocuments(query, audience, namespace) {
  try {
    // Step 1: Generate embedding for user query
    console.log(`🔍 Generating query embedding for: "${query.substring(0, 50)}..."`);
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    // Step 2: Build metadata filter based on audience (PRD requirement)
    const filter = {
      audience: audience === 'employee' ? { $in: ['public', 'employee'] } : 'public'
    };
    
    // Step 3: Query Pinecone with embedding
    console.log(`📊 Querying Pinecone namespace "${namespace}" with filter:`, filter);
    const topK = 10; // Retrieve top 10 chunks (PRD: typically 10-30, return best 3-8)
    const matches = await pineconeService.queryVectors(
      queryEmbedding,
      topK,
      namespace,
      filter
    );
    
    // Step 4: Format results
    const chunks = matches.map(match => ({
      text: match.metadata?.text || match.metadata?.question || '',
      source: match.metadata?.source_id || match.metadata?.source || 'unknown',
      score: match.score || 0,
      metadata: {
        ...match.metadata,
        audience: match.metadata?.audience || audience,
        type: match.metadata?.source_type || 'document'
      }
    }));
    
    console.log(`✅ Retrieved ${chunks.length} chunks from Pinecone (top score: ${chunks[0]?.score || 0})`);
    
    // Return best 3-8 chunks (PRD requirement)
    return chunks.slice(0, 8);
  } catch (error) {
    console.error("❌ Error searching Pinecone:", error.message);
    // Fallback to empty results
    return [];
  }
}

/**
 * Search CSV Q&A using semantic matching in Pinecone "qa" namespace
 * PRD requirement: Semantic match in Pinecone qa namespace if exact match fails
 * 
 * @param {string} query - User query
 * @param {string} audience - User role
 * @returns {Promise<object|null>} - QA pair if found
 */
async function searchCSVQA(query, audience) {
  try {
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    // Build filter
    const filter = {
      audience: audience === 'employee' ? { $in: ['public', 'employee'] } : 'public'
    };
    
    // Query Pinecone "qa" namespace
    console.log(`🔍 Searching CSV Q&A in Pinecone "qa" namespace...`);
    const matches = await pineconeService.queryVectors(
      queryEmbedding,
      5, // Top 5 matches
      "qa",
      filter
    );
    
    // Check if we have a high-confidence match (score > 0.75 for better quality)
    if (matches.length > 0 && matches[0].score > 0.75) {
      const bestMatch = matches[0];
      console.log(`✅ Found CSV Q&A match with score: ${bestMatch.score}`);
      
      return {
        question: bestMatch.metadata?.question || '',
        answer: bestMatch.metadata?.answer || '',
        score: bestMatch.score,
        sourceId: bestMatch.metadata?.source_id || ''
      };
    }
    
    // Log if we have matches but score is too low
    if (matches.length > 0) {
      console.log(`⚠️  CSV Q&A match found but score too low: ${matches[0].score} (threshold: 0.75)`);
    }
    
    return null;
  } catch (error) {
    console.error("❌ Error searching CSV Q&A:", error.message);
    return null;
  }
}

/**
 * Real LLM response generation (OpenAI or Groq free)
 * PRD requirement: Answer only using retrieved data, no hallucination
 */
async function generateLLMResponse(question, context, userRole) {
  try {
    // Try OpenAI first, fallback to Groq (free)
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      return await llmService.generateResponse(question, context, userRole);
    } else {
      // Use free Groq service
      console.log("📝 Using free Groq LLM service...");
      return await freeLLMService.generateResponse(question, context, userRole);
    }
  } catch (error) {
    console.error("❌ Error generating LLM response:", error.message);
    // Fallback response
    if (context.type === "qa") {
      return context.answer;
    } else if (context.type === "employee_data") {
      return `Your leave balance: Annual Leave - ${context.data.remainingLeave} days remaining (${context.data.usedLeave} used), Sick Leave - ${context.data.remainingSickLeave} days remaining (${context.data.usedSickLeave} used).`;
    }
    return "I encountered an error processing your request. Please try again.";
  }
}

// Main chat message handler
async function handleMessage(req, res) {
  try {
    const { message, sessionId, authToken } = req.body;
    
    // Step 1: Validate input
    if (!message || message.trim().length === 0) {
      return res.json({
        response: "Please provide a message.",
        sessionId
      });
    }
    
    // Step 2: Authenticate user (simplified)
    // In a real implementation, you would validate the authToken
    const userRole = authToken ? "employee" : "client"; // Simplified role detection
    const employeeId = userRole === "employee" ? "emp_12345" : null; // Mock employee ID
    
    // Step 3: Check for conversational intents FIRST (before gibberish check)
    // This ensures greetings like "hi", "hello" are handled properly
    const conversationalIntent = detectConversationalIntent(message);
    if (conversationalIntent) {
      const response = getConversationalResponse(conversationalIntent);
      return res.json({
        response,
        sessionId,
        context: { type: "conversational", intent: conversationalIntent }
      });
    }
    
    // Step 4: Gibberish check (only for non-conversational messages)
    if (isGibberish(message)) {
      return res.json({
        response: "I’m sorry, I couldn’t understand that. Please ask a clear question about our services or company.",
        sessionId
      });
    }
    
    // Step 4.5: Check if query is out-of-scope (not related to Mobiloitte)
    // Examples: "how to make maggi", "what is weather", "tell me a joke"
    const normalizedMessage = normalizeText(message);
    if (isOutOfScope(normalizedMessage)) {
      return res.json({
        response: "I'm focused on helping with questions about Mobiloitte's services, AI solutions, company information, and processes. Could you please ask something related to our company?",
        sessionId,
        context: { type: "out_of_scope" }
      });
    }
    
    // Step 5: Classify intent for informational queries
    const intent = classifyIntent(message, userRole);
    
    let response = "";
    let context = {};
    
    // Step 6: Route based on intent (conversational intents already handled above)
    switch (intent) {
      case "employee_operational":
        // Handle employee operational queries
        if (userRole !== "employee") {
          response = "This information is only available to employees.";
        } else {
          const employeeData = await getEmployeeData(employeeId, "leave_balance");
          context = { type: "employee_data", data: employeeData };
          response = await generateLLMResponse(message, context);
        }
        break;
        
      case "csv_qa":
        // Fast path for CSV Q&A
        const normalizedMessage = normalizeText(message);

        // Detect topic intent (AI solutions, services overview, etc.)
        const topicIntent = detectTopicIntent(normalizedMessage);

        // If we recognize a topic intent, expand short query into a canonical
        // question that matches our curated CSV data. This makes
        // "Traditional AI Solutions?" and
        // "What are Traditional AI Solutions?" behave the same.
        const canonicalNormalizedQuestion =
          (topicIntent && INTENT_TO_CANONICAL_QUESTION[topicIntent]) ||
          normalizedMessage;

        const normalizedQuestion = canonicalNormalizedQuestion;
        const questionHash = generateQuestionHash(normalizedQuestion);
        
        // Try exact match first (on canonical normalized question)
        let qaPair = await QAPair.findOne({ 
          normalizedQuestion: normalizedQuestion,
          audience: userRole === "employee" ? { $in: ["public", "employee"] } : "public"
        });
        
        // If not found, try hash-based match
        if (!qaPair) {
          qaPair = await QAPair.findOne({ 
            questionHash: questionHash,
            audience: userRole === "employee" ? { $in: ["public", "employee"] } : "public"
          });
        }
        
        if (qaPair) {
          // Exact match found - use answer directly (PRD: fast path, no LLM needed for curated answers)
          context = { type: "qa", answer: qaPair.answer };
          response = qaPair.answer; // Return curated answer directly
        } else {
          // Exact match not found - try semantic search in Pinecone "qa" namespace (PRD requirement)
          console.log("⚠️  Exact match not found, trying semantic search in Pinecone 'qa' namespace...");
          // IMPORTANT: use canonical question text for embeddings so that
          // short queries like "AI Solutions?" map to the same vector as
          // "What are Traditional AI Solutions?"
          const semanticQA = await searchCSVQA(canonicalNormalizedQuestion, userRole);
          
          if (
            semanticQA &&
            semanticQA.score > 0.8 && // Strict similarity threshold
            hasMeaningfulOverlap(message, semanticQA.question)
          ) {
            // High confidence AND lexically related semantic match found
            console.log(`✅ Using semantic CSV Q&A match with score: ${semanticQA.score}`);
            context = { type: "qa", answer: semanticQA.answer };
            response = semanticQA.answer; // Return curated answer directly (no LLM needed)
          } else {
            // Low confidence or no lexically related match - don't use it
            console.log(
              `⚠️  Semantic CSV match rejected (score: ${semanticQA?.score || "N/A"}, ` +
              `overlap: ${semanticQA ? hasMeaningfulOverlap(message, semanticQA.question) : "N/A"})`
            );
            // Fall back to document RAG search
            console.log("⚠️  No reliable CSV Q&A match found, falling back to document RAG...");
            const chunks = await searchDocuments(
              message,
              userRole,
              userRole === "employee" ? "employee_docs" : "public_docs"
            );
            
            // Only use chunks if we have good matches (score > 0.5)
            const goodChunks =
              chunks && chunks.length > 0 && chunks[0].score > 0.5
                ? chunks.filter((chunk) => chunk.score > 0.5)
                : [];
            
            if (goodChunks.length > 0) {
              // Found relevant document chunks - use them
              context = { type: "document", chunks: goodChunks };
              response = await generateLLMResponse(message, context, userRole);
            } else {
              // No relevant data found anywhere - use improved fallback message
              response =
                "I couldn't find relevant information for this query. " +
                "Please ask about Mobiloitte's services, solutions, or processes.";
              context = { type: "no_data_found" };
            }
          }
        }
        break;
        
      case "document_rag":
      default:
        // Document RAG search (PRD: query Pinecone with metadata filter)
        const chunks = await searchDocuments(message, userRole, 
          userRole === "employee" ? "employee_docs" : "public_docs");
        
        // Only use chunks if we have good matches (score > 0.5)
        const goodChunks = chunks && chunks.length > 0 && chunks[0].score > 0.5 
          ? chunks.filter(chunk => chunk.score > 0.5)
          : [];
        
        if (goodChunks.length > 0) {
          // Found relevant document chunks - use them
          context = { type: "document", chunks: goodChunks };
          response = await generateLLMResponse(message, context, userRole);
        } else {
          // No relevant data found - use improved fallback message
          response = "I couldn't find this information in our knowledge base. Could you rephrase your question or ask about Mobiloitte's services, AI solutions, or company information?";
          context = { type: "no_data_found" };
        }
        break;
    }
    
    // Step 6: Return response
    return res.json({
      response,
      sessionId,
      context // For debugging purposes
    });
    
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      response: "Sorry, I encountered an error processing your request.",
      sessionId: req.body.sessionId
    });
  }
}

module.exports = {
  handleMessage
};