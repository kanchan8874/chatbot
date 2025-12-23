/**
 * Refactored Chat Controller
 * Main orchestrator that routes queries to appropriate handlers
 * 
 * This file has been refactored from 2311 lines to ~300 lines
 * by splitting functionality into modular handlers and utilities
 */

const QAPair = require("../database/models/QAPair");

// Import utilities
const { normalizeText } = require("../utils/textProcessing");
const { isGibberish, detectLanguage, containsProfanity } = require("../utils/textValidation");
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
const llmService = require("../services/llmService");
const freeLLMService = require("../services/freeLLMService");

/**
 * Get employee data (mock function)
 */
async function getEmployeeData(employeeId, queryType) {
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
    const { message, sessionId, authToken } = req.body;
    
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
    
    // Step 3: Profanity check
    if (await containsProfanity(message)) {
      console.log(`⚠️  Profanity detected in message from ${userRole}`);
      return res.json({
        response: "I'm here to help with professional questions about Mobiloitte. Please use appropriate language.",
        sessionId,
        context: { type: "profanity_detected" }
      });
    }
    
    // Step 4: Language detection
    const detectedLanguage = await detectLanguage(message);
    if (detectedLanguage !== 'und' && detectedLanguage !== 'eng') {
      console.log(`🌐 Detected language: ${detectedLanguage} for message: "${message.substring(0, 50)}"`);
    }
    
    // Step 5: Check for conversational intents
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
    
    // Step 6: Gibberish check
    if (isGibberish(message, userRole)) {
      console.log(`⚠️  Gibberish detected: "${message.substring(0, 50)}"`);
      return res.json({
        response: "I'm sorry, I couldn't understand that. Please ask a clear question about our services or company.",
        sessionId,
        context: { type: "gibberish", language: detectedLanguage }
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
          const employeeData = await getEmployeeData(employeeId, "leave_balance");
          context = { type: "employee_data", data: employeeData };
          response = await generateLLMResponse(message, context);
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
        
        // Proceed with document RAG
        let namespace = "public_docs";
        if (userRole === "admin") {
          namespace = "employee_docs";
        } else if (userRole === "employee") {
          namespace = "employee_docs";
        }
        
        const chunks = await searchDocuments(message, userRole, namespace);
        const goodChunks = chunks && chunks.length > 0 && chunks[0].score > 0.5 
          ? chunks.filter(chunk => chunk.score > 0.5)
          : [];
        
        if (goodChunks.length > 0) {
          context = { type: "document", chunks: goodChunks };
          response = await generateLLMResponse(message, context, userRole);
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
        break;
    }
    
    // Step 10: Return response
    return res.json({
      response,
      sessionId,
      context: {
        ...context,
        language: detectedLanguage,
        intent: intent
      }
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
