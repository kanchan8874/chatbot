/**
 * Admin Query Handler
 * Handles admin-specific queries (analytics, user management, etc.)
 */

const QAPair = require("../database/models/QAPair");
const { normalizeText, generateQuestionHash } = require('../utils/textProcessing');
const { detectAdminIntent, ADMIN_INTENT_TO_ANSWER } = require('../utils/intentDetection');
const { searchMongoDBByKeywords } = require('../utils/searchUtils');

/**
 * Check if query contains admin keywords
 */
function hasAdminKeywords(normalizedMessage) {
  return (
    normalizedMessage.includes("admin") || 
    normalizedMessage.includes("analytics") || 
    normalizedMessage.includes("user management") || 
    normalizedMessage.includes("manage users") ||
    normalizedMessage.includes("system") ||
    normalizedMessage.includes("configuration") || 
    normalizedMessage.includes("security") ||
    normalizedMessage.includes("reports") || 
    normalizedMessage.includes("knowledge") ||
    normalizedMessage.includes("knowledge base") ||
    normalizedMessage.includes("knowledge management") ||
    normalizedMessage.includes("performance") || 
    normalizedMessage.includes("metrics") ||
    normalizedMessage.includes("dashboard") || 
    normalizedMessage.includes("manage") ||
    normalizedMessage.includes("update") ||
    normalizedMessage.includes("kpi")
  );
}

/**
 * Handle admin queries
 */
async function handleAdminQuery(message, normalizedMessage, userRole, audienceFilter) {
  const adminIntent = detectAdminIntent(normalizedMessage);
  
  console.log(`🔍 Admin query detected - Role: ${userRole}, Intent: ${adminIntent}, Query: "${message.substring(0, 50)}"`);
  
  // First try hardcoded admin answers
  if (adminIntent && ADMIN_INTENT_TO_ANSWER[adminIntent]) {
    console.log(`✅ Using hardcoded admin answer for intent: ${adminIntent}`);
    return {
      response: ADMIN_INTENT_TO_ANSWER[adminIntent],
      context: { type: "qa", answer: ADMIN_INTENT_TO_ANSWER[adminIntent], audience: "admin", adminIntent }
    };
  }
  
  // Try MongoDB search
  const hasAdminKeywords = 
    adminIntent || 
    normalizedMessage.includes("admin") || 
    normalizedMessage.includes("analytics") || 
    normalizedMessage.includes("user management") || 
    normalizedMessage.includes("manage users") ||
    normalizedMessage.includes("system") ||
    normalizedMessage.includes("configuration") || 
    normalizedMessage.includes("security") ||
    normalizedMessage.includes("reports") || 
    normalizedMessage.includes("knowledge") ||
    normalizedMessage.includes("knowledge base") ||
    normalizedMessage.includes("knowledge management") ||
    normalizedMessage.includes("performance") || 
    normalizedMessage.includes("metrics") ||
    normalizedMessage.includes("dashboard") || 
    normalizedMessage.includes("manage") ||
    normalizedMessage.includes("update");
  
  if (hasAdminKeywords) {
    console.log(`🔍 Admin keywords detected, searching MongoDB for admin Q&A...`);
    
    // Try exact match
    let qaPair = await QAPair.findOne({ 
      normalizedQuestion: normalizedMessage,
      audience: { $in: ["admin", "public"] }
    });
    
    // Try hash-based match
    if (!qaPair) {
      const questionHash = generateQuestionHash(normalizedMessage);
      qaPair = await QAPair.findOne({ 
        questionHash: questionHash,
        audience: { $in: ["admin", "public"] }
      });
    }
    
    // Try partial match
    if (!qaPair) {
      const keywords = normalizedMessage.split(" ").filter(w => w.length > 3);
      if (keywords.length > 0) {
        qaPair = await QAPair.findOne({
          $or: [
            { normalizedQuestion: { $regex: keywords[0], $options: "i" } },
            { question: { $regex: keywords[0], $options: "i" } },
            { question: { $regex: normalizedMessage.substring(0, 20), $options: "i" } }
          ],
          audience: { $in: ["admin", "public"] }
        });
      }
    }
    
    if (qaPair) {
      console.log(`✅ Found admin Q&A in MongoDB: ${qaPair.question.substring(0, 50)}...`);
      return {
        response: qaPair.answer,
        context: { type: "qa", answer: qaPair.answer, audience: "admin", source: "mongodb" }
      };
    }
    
    // Fallback to hardcoded answers
    console.log(`⚠️  No MongoDB match found for admin query, using hardcoded fallback.`);
    
    // Try to infer intent from keywords
    let fallbackIntent = null;
    
    if (normalizedMessage.includes("performance") || normalizedMessage.includes("metrics") || normalizedMessage.includes("kpi")) {
      fallbackIntent = "admin_performance";
    } else if (normalizedMessage.includes("analytics") || normalizedMessage.includes("reports") || normalizedMessage.includes("usage")) {
      fallbackIntent = "admin_analytics";
    } else if (normalizedMessage.includes("knowledge") || (normalizedMessage.includes("manage") && normalizedMessage.includes("update"))) {
      fallbackIntent = "admin_knowledge";
    } else if (normalizedMessage.includes("user") && normalizedMessage.includes("manage")) {
      fallbackIntent = "admin_users";
    } else if (normalizedMessage.includes("system") || normalizedMessage.includes("configuration") || normalizedMessage.includes("settings")) {
      fallbackIntent = "admin_config";
    } else if (normalizedMessage.includes("security") || normalizedMessage.includes("access control")) {
      fallbackIntent = "admin_security";
    }
    
    if (fallbackIntent && ADMIN_INTENT_TO_ANSWER[fallbackIntent]) {
      return {
        response: ADMIN_INTENT_TO_ANSWER[fallbackIntent],
        context: { type: "qa", answer: ADMIN_INTENT_TO_ANSWER[fallbackIntent], audience: "admin", adminIntent: fallbackIntent, source: "hardcoded_fallback" }
      };
    }
    
    // Last resort: generic admin knowledge answer
    return {
      response: ADMIN_INTENT_TO_ANSWER["admin_knowledge"],
      context: { type: "qa", answer: ADMIN_INTENT_TO_ANSWER["admin_knowledge"], audience: "admin", adminIntent: "admin_knowledge", source: "hardcoded_generic" }
    };
  }
  
  // Even if no admin keywords but user is admin, try to provide helpful response
  if (adminIntent && ADMIN_INTENT_TO_ANSWER[adminIntent]) {
    return {
      response: ADMIN_INTENT_TO_ANSWER[adminIntent],
      context: { type: "qa", answer: ADMIN_INTENT_TO_ANSWER[adminIntent], audience: "admin", adminIntent: adminIntent, source: "hardcoded_intent" }
    };
  }
  
  // Final fallback
  return {
    response: ADMIN_INTENT_TO_ANSWER["admin_knowledge"],
    context: { type: "qa", answer: ADMIN_INTENT_TO_ANSWER["admin_knowledge"], audience: "admin", adminIntent: "admin_knowledge", source: "hardcoded_final" }
  };
}

module.exports = {
  hasAdminKeywords,
  handleAdminQuery
};
