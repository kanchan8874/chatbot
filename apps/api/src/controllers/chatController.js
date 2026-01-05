const QAPair = require("../database/models/QAPair");

// Import utilities
const { normalizeText } = require("../utils/textProcessing");
const { isGibberish, isMeaningfulInquiry, detectLanguage, containsProfanity } = require("../utils/textValidation");
const { detectConversationalIntent, getConversationalResponse } = require("../utils/conversationalHandler");
const { 
  classifyIntent, 
  isOutOfScope, 
  INTENT_TO_CANONICAL_QUESTION,
  detectHRIntent,
  HR_INTENT_TO_ANSWER,
  detectAdminIntent,
  ADMIN_INTENT_TO_ANSWER
} = require("../utils/intentDetection");
const { isFAQQuery, generateFAQAnswer } = require("../handlers/faqHandler");
const { hasAdminKeywords, handleAdminQuery } = require("../handlers/adminHandler");
const { hasHRKeywords, handleEmployeeQuery } = require("../handlers/employeeHandler");
const { handleClientQuery } = require("../handlers/clientHandler");
const { searchDocuments } = require("../utils/searchUtils");
const { formatResponseForAPI, redactResponseText, buildCitations } = require("../utils/responseFormatter");
const llmService = require("../services/llmService");
const freeLLMService = require("../services/freeLLMService");
// Follow-up questions removed - simple chatbot behavior

const employeeDataService = require("../services/employeeDataService");
const ChatLog = require("../database/models/ChatLog");

// Simple per-role rate limit (in-memory)
const rateLimits = {
  client: { limit: 60, windowMs: 60_000 },
  employee: { limit: 120, windowMs: 60_000 },
  admin: { limit: 200, windowMs: 60_000 },
};
const rateState = new Map(); // key: role|ip

function checkRateLimit(role, ip) {
  const key = `${role}|${ip || "unknown"}`;
  const { limit, windowMs } = rateLimits[role] || rateLimits.client;
  const now = Date.now();
  const entry = rateState.get(key) || { count: 0, ts: now };
  if (now - entry.ts > windowMs) {
    rateState.set(key, { count: 1, ts: now });
    return null;
  }
  if (entry.count >= limit) {
    return { message: "Rate limit exceeded. Please wait a moment and try again." };
  }
  rateState.set(key, { count: entry.count + 1, ts: entry.ts });
  return null;
}

// Simple action intent detector for escalation
function detectActionIntent(normalizedMessage) {
  const salesKeywords = ["price", "pricing", "quote", "proposal", "contact sales", "sales call", "demo"];
  const hrActionKeywords = ["apply leave", "apply for leave", "approve leave", "approval", "sanction leave"];

  const lowerMsg = normalizedMessage.toLowerCase();
  const hasSales = salesKeywords.some(k => lowerMsg.includes(k));
  const hasHrAction = hrActionKeywords.some(k => lowerMsg.includes(k));

  if (hasSales) return "sales_followup";
  if (hasHrAction) return "hr_action";
  return null;
}

function buildHandoverPayload({ message, userRole, intent, context, topScore }) {
  return {
    reason: "low_confidence",
    intent,
    role: userRole,
    topScore: topScore ?? null,
    message,
    sources: buildCitations(context || {}),
  };
}

/**
 * Generate LLM response
 */
async function generateLLMResponse(question, context, userRole, detectedLanguage = 'und') {
  try {
    // Use the updated LLM service which now uses Groq
    return await llmService.generateResponse(question, context, userRole, detectedLanguage);
  } catch (error) {
    console.error("❌ Error generating LLM response:", error.message);
    if (context.type === "qa") {
      return context.answer;
    } else if (context.type === "employee_data") {
      return `Your leave balance: Annual Leave - ${context.data.remainingLeave} days remaining (${context.data.usedLeave} used), Sick Leave - ${context.data.remainingSickLeave} days remaining (${context.data.usedSickLeave} used).`;
    }
    return "I encountered an error processing your request. Please try again.";
  }
}

/**
 * Main chat message handler
 */
async function handleMessage(req, res) {
  try {
    const startTime = Date.now();
    const { message, sessionId, authToken } = req.body;
    const rateResult = checkRateLimit(req.user?.role || "client", req.ip);
    if (rateResult) {
      return res.status(429).json({
        response: rateResult.message,
        sessionId
      });
    }
    
    // Step 1: Validate input
    if (!message || message.trim().length === 0) {
      return res.json({
        response: "Please provide a message.",
        sessionId
      });
    }
    
    // Step 2: Authenticate user
    let userRole = "client";
    let employeeId = null;
    
    if (req.user) {
      userRole = req.user.role || "client";
      employeeId = req.user.employeeId || null;
    } else if (authToken) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "mobiloitte_chatbot_secret_key";
        const decoded = jwt.verify(authToken, JWT_SECRET);
        userRole = decoded.role || "client";
        employeeId = decoded.employeeId || null;
        console.log(`🔐 Decoded role from authToken body: ${userRole}, Email: ${decoded.email}`);
      } catch (error) {
        try {
          const jwt = require("jsonwebtoken");
          const decodedWithoutVerify = jwt.decode(authToken);
          if (decodedWithoutVerify && decodedWithoutVerify.role) {
            console.log(`⚠️  Token signature invalid but decoded role: ${decodedWithoutVerify.role}. Will use keyword-based detection as fallback.`);
          }
        } catch (decodeError) {
          console.warn(`⚠️  Failed to decode authToken: ${error.message}. Token may be expired or invalid.`);
        }
      }
    }
    
    console.log(`👤 User role detected: ${userRole}, Message: "${message.substring(0, 50)}"`);
    
    // Step 3: Gibberish check (EARLY EXIT)
    if (isGibberish(message, userRole)) {
      console.log(`⚠️  Gibberish detected: "${message.substring(0, 50)}"`);
      return res.json({
        response: "I'm sorry, I couldn't understand that. Please ask a clear question about our services or company.",
        sessionId,
        context: { type: "gibberish", language: "und" }
      });
    }

    // Step 4: Profanity check (BEFORE any embedding/RAG processing)
    const hasProfanity = await containsProfanity(message);
    if (hasProfanity) {
      console.log(`🚫 Profanity detected in message from ${userRole}: "${message.substring(0, 50)}..."`);
      return res.json({
        response: "I'm here to assist you with professional questions about Mobiloitte's services, solutions, and company information. Please use respectful and appropriate language so I can help you better.",
        sessionId,
        context: { type: "profanity_detected", language: "und" }
      });
    }
    
    // Step 5: Language detection
    const detectedLanguage = await detectLanguage(message);
    if (detectedLanguage !== 'und' && detectedLanguage !== 'eng') {
      console.log(`🌐 Detected language: ${detectedLanguage} for message: "${message.substring(0, 50)}"`);
    }
    
    // Step 6: Check for conversational intents
    const conversationalIntent = detectConversationalIntent(message);
    if (conversationalIntent) {
      const response = getConversationalResponse(conversationalIntent);
      return res.json({
        response,
        sessionId,
        context: { 
          type: "conversational", 
          intent: conversationalIntent,
          language: detectedLanguage
        }
      });
    }

    // Step 6a: Question Validation (Ideal behavior check)
    // If it's not a greeting/thanks but also not a meaningful inquiry, terminate early
    if (!isMeaningfulInquiry(message)) {
      console.log(`ℹ️  Plain text fragment detected (not an inquiry): "${message.substring(0, 50)}"`);
      return res.json({
        response: "That's an interesting statement! How can I specifically help you with Mobiloitte's services, AI solutions, or company information today?",
        sessionId,
        context: { type: "non_inquiry_statement", language: detectedLanguage }
      });
    }
    
    // Step 7: Check if query is out-of-scope
    const normalizedMessage = normalizeText(message);
    if (isOutOfScope(normalizedMessage)) {
      return res.json({
        response: "I'm focused on helping with questions about Mobiloitte's services, AI solutions, company information, and processes. Could you please ask something related to our company?",
        sessionId,
        context: { type: "out_of_scope", language: detectedLanguage }
      });
    }
    
    // Step 8: Classify intent
    const intent = classifyIntent(message, userRole);
    
    let response = "";
    let context = {};
    
    // Step 9: Route based on intent
    switch (intent) {
      case "employee_operational":
        if (userRole !== "employee") {
          response = "This information is only available to employees.";
        } else {
          const employeeData = await employeeDataService.getLeaveBalance(employeeId, { actorRole: userRole });
          context = { type: "employee_data", data: employeeData };
          response = await generateLLMResponse(message, context, userRole, detectedLanguage);
        }
        break;
        
      case "csv_qa":
        // Determine audience filter
        let audienceFilter;
        if (userRole === "admin") {
          audienceFilter = { $in: ["admin", "public"] };
        } else if (userRole === "employee") {
          audienceFilter = { $in: ["public", "employee"] };
        } else {
          audienceFilter = "public";
        }
        
        // Check for admin keywords (fallback for token decode failures)
        const hasAdminKeywordsInQuery = hasAdminKeywords(normalizedMessage);
        const hasHRKeywordsInQuery = hasHRKeywords(normalizedMessage);
        
        // Handle Admin queries
        if (userRole === "admin" || hasAdminKeywordsInQuery) {
          if (userRole !== "admin" && hasAdminKeywordsInQuery) {
            console.log(`⚠️  Token decode failed but admin keywords detected. Treating as admin query.`);
            userRole = "admin";
          }
          const result = await handleAdminQuery(message, normalizedMessage, userRole, audienceFilter);
          response = result.response;
          context = result.context;
          return res.json({
            response,
            sessionId,
            context: {
              ...context,
              language: detectedLanguage,
              intent: intent
            }
          });
        }
        
        // Handle Employee/HR queries
        if (userRole === "employee" || hasHRKeywordsInQuery) {
          if (userRole !== "employee" && hasHRKeywordsInQuery) {
            console.log(`⚠️  Token decode failed but HR keywords detected. Treating as employee query.`);
            userRole = "employee";
          }
          const result = await handleEmployeeQuery(message, normalizedMessage, userRole, audienceFilter);
          response = result.response;
          context = result.context;
          return res.json({
            response,
            sessionId,
            context: {
              ...context,
              language: detectedLanguage,
              intent: intent
            }
          });
        }
        
        // Handle FAQ queries
        if (isFAQQuery(normalizedMessage)) {
          console.log(`🔍 FAQ query detected! Normalized message: "${normalizedMessage}", Original: "${message}"`);
          const faqAnswer = await generateFAQAnswer(userRole);
          if (faqAnswer) {
            context = { type: "qa", answer: faqAnswer, source: "faq_aggregated" };
            response = faqAnswer;
            return res.json({
              response,
              sessionId,
              context: {
                ...context,
                language: detectedLanguage,
                intent: intent
              }
            });
          }
        }
        
        // Handle general client queries
        const clientResult = await handleClientQuery(message, normalizedMessage, userRole, audienceFilter);
        response = clientResult.response;
        context = clientResult.context;

        // If no high-confidence CSV result and no context, ask clarify instead of hallucinating
        if (!context || (context.type === "no_data_found")) {
          const actionIntent = detectActionIntent(normalizedMessage);
        
          if (actionIntent) {
            const handover = buildHandoverPayload({
              message,
              userRole,
              intent: actionIntent,
              context,
              topScore: null
            });
        
            response =
              "I’m forwarding your request to our team so we can assist you further. " +
              "Could you please share your preferred contact details (email or phone number)?";
        
            context = {
              type: "handover",
              actionIntent,
              handover
            };
          } else {
            response =
              "I couldn’t find an exact or verified answer for this query. " +
              "Could you please clarify your question by specifying the service, department, " +
              "or topic you are interested in?";
        
            context = {
              type: "clarify_csv",
              reason: "low_confidence_csv"
            };
          }
        } 
        else if (
          context &&
          context.type === "document" &&
          (!context.chunks || context.chunks.length === 0)
        ) {
          // Hard refusal when no supporting evidence is available
          response =
            "I don’t currently have any reliable or supporting information to answer this question. " +
            "Please ask about a specific service, process, or topic so I can assist you more accurately.";
        
          context = {
            type: "no_data_found"
          };
        }
        
        
        // Apply language-specific transformation if needed
        if (detectedLanguage !== 'eng' && detectedLanguage !== 'und') {
          // For non-English queries, we could apply language transformation here
          // For now, keeping the same response but in a real implementation
          // we would translate the response to match the input language
        }
        
        break;
        
      case "document_rag":
      default:
        // Document RAG search
        console.log("⚠️  document_rag intent detected, trying CSV Q&A search first as fallback...");
        const normalizedMessageForRAG = normalizeText(message);
        
        // Try FAQ first
        if (isFAQQuery(normalizedMessageForRAG)) {
          const faqAnswer = await generateFAQAnswer(userRole);
          if (faqAnswer) {
            context = { type: "qa", answer: faqAnswer, source: "faq_aggregated" };
            response = faqAnswer;
            return res.json({
              response,
              sessionId,
              context: {
                ...context,
                language: detectedLanguage,
                intent: intent
              }
            });
          }
        }
        
        // Search documents for RAG (General or Job-related)
        let namespace = "public_docs";
        if (userRole === "admin" || userRole === "employee") {
          namespace = "employee_docs";
        }
        
        const chunks = await searchDocuments(message, userRole, namespace);

        // Check if this is a job-related query specifically
        if (isJobRelatedQuery(message)) {
          const jobResponse = generateJobResponse(chunks);
          response = jobResponse.response;
          context = { type: "job_info", isJobAvailable: jobResponse.isJobAvailable, chunks: chunks };
        } else {
          // Use higher threshold for RAG
          const threshold = 0.60;
          let filteredChunks = chunks || [];
          // Extra audience guard: ensure client never sees non-public chunks
          if (userRole === "client") {
            filteredChunks = filteredChunks.filter(c => (c.metadata?.audience || c.audience) === "public");
          }
          
          const goodChunks = filteredChunks && filteredChunks.length > 0 && filteredChunks[0].score > threshold 
            ? filteredChunks.filter(chunk => chunk.score > threshold)
            : [];
          
          if (goodChunks.length > 0) {
            context = { type: "document", chunks: goodChunks };
            response = await generateLLMResponse(message, context, userRole, detectedLanguage);
          } else if (filteredChunks && filteredChunks.length > 0 && filteredChunks[0].score >= 0.35) {
            // Low-confidence guardrail → ask for clarification instead of hallucinating
            const actionIntent = detectActionIntent(normalizeText(message));
            if (actionIntent) {
              const handover = buildHandoverPayload({
                message,
                userRole,
                intent: actionIntent,
                context,
                topScore: filteredChunks[0].score
              });
            
              response = "I am forwarding this request to our team. Could you please share your preferred contact details (email or phone number)?";
              context = { type: "handover", actionIntent, handover };
            
            } else {
              response = "I couldn’t find the exact information for this query. Could you please provide a bit more detail, such as the service, department, or topic?";
              context = { type: "clarify", reason: "low_confidence", topScore: filteredChunks[0].score };
            }
            
            } else if (!filteredChunks || filteredChunks.length === 0) {
              // Hard refusal when no supporting evidence is available
              response = "I don’t have sufficient verified information to answer this question. Please ask about a specific service or topic.";
              context = { type: "no_data_found" };
          } else {
            // Fallback for employee users
            if (userRole === "employee") {
              const finalHRIntent = detectHRIntent(normalizeText(message));
              if (finalHRIntent && HR_INTENT_TO_ANSWER[finalHRIntent]) {
                response = HR_INTENT_TO_ANSWER[finalHRIntent];
                context = { type: "qa", answer: response, audience: "employee", hrIntent: finalHRIntent, source: "hardcoded_document_fallback" };
              } else {
                response = HR_INTENT_TO_ANSWER["hr_helpdesk"];
                context = { type: "qa", answer: response, audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_document_last_resort" };
              }
            } else if (userRole === "admin") {
              const finalAdminIntent = detectAdminIntent(normalizeText(message));
              if (finalAdminIntent && ADMIN_INTENT_TO_ANSWER[finalAdminIntent]) {
                response = ADMIN_INTENT_TO_ANSWER[finalAdminIntent];
                context = { type: "qa", answer: response, audience: "admin", adminIntent: finalAdminIntent, source: "hardcoded_document_fallback" };
              } else {
                response = ADMIN_INTENT_TO_ANSWER["admin_knowledge"];
                context = { type: "qa", answer: response, audience: "admin", adminIntent: "admin_knowledge", source: "hardcoded_document_last_resort" };
              }
            } else {
              response = "I couldn't find this information in our knowledge base. Could you rephrase your question or ask about Mobiloitte's services, AI solutions, or company information?";
              context = { type: "no_data_found" };
            }
          }
        }
        break;
    }
    
    // Redact sensitive data for client responses
    response = redactResponseText(response, userRole);
    
    // Step 10: Format response into structured chunks (Kenyt AI style)
    const formattedResponse = formatResponseForAPI(response, {
      maxLinesPerBubble: 5,
      charsPerLine: 60,
      enableShowMore: false, // Disabled - removed show more functionality
      showMoreThreshold: 15,
    });
    
    // Simple chatbot - just return the answer, no follow-up questions
    const payload = {
      response: formattedResponse.originalText, // Keep original for backward compatibility
      formatted: formattedResponse.formatted,
      chunks: formattedResponse.chunks,
      sessionId,
      context: {
        ...context,
        language: detectedLanguage,
        intent: intent
      },
      citations: buildCitations(context)
    };

    // Basic structured log (persist + console)
    const logEntry = {
      role: userRole,
      intent,
      contextType: context?.type,
      topScore: context?.topScore || null,
      hasHandover: context?.type === "handover",
      latencyMs: Date.now() - startTime,
      sessionId,
      message,
      handoverIntent: context?.actionIntent,
      sources: payload.citations,
    };
    console.log("[chat_trace]", JSON.stringify(logEntry));
    ChatLog.create(logEntry).catch((err) => {
      console.warn("Failed to persist chat log:", err.message);
    });

    return res.json(payload);
    
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

/**
 * Detect if query is job-related
 */
function isJobRelatedQuery(message) {
  const jobKeywords = [
    'job', 'jobs', 'career', 'careers', 'employment', 'vacancy', 'vacancies', 
    'hiring', 'hire', 'recruit', 'recruitment', 'position', 'positions',
    'opening', 'openings', 'apply', 'application', 'applications',
    'work', 'working', 'employee', 'employees', 'intern', 'internship'
  ];
  
  const normalizedMessage = normalizeText(message).toLowerCase();
  return jobKeywords.some(keyword => normalizedMessage.includes(keyword));
}

/**
 * Generate job-related response based on document search results
 */
function generateJobResponse(chunks) {
  if (!chunks || chunks.length === 0) {
    return {
      response: "Currently there are no job openings available at Mobiloitte. Please check our careers page or contact our HR team for future opportunities.",
      isJobAvailable: false
    };
  }
  
  // Check if any chunk contains positive job-related information
  const hasJobInfo = chunks.some(chunk => 
    chunk.text.toLowerCase().includes('job') || 
    chunk.text.toLowerCase().includes('career') || 
    chunk.text.toLowerCase().includes('opening') ||
    chunk.text.toLowerCase().includes('hiring')
  );
  
  if (hasJobInfo) {
    return {
      response: "Yes, there are job opportunities available at Mobiloitte. Please contact our HR team or check our careers page for current openings.",
      isJobAvailable: true
    };
  } else {
    return {
      response: "Currently there are no job openings available at Mobiloitte. Please check our careers page or contact our HR team for future opportunities.",
      isJobAvailable: false
    };
  }
}