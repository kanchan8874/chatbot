/**
 * Employee/HR Query Handler
 * Handles employee-specific queries (leave, payroll, attendance, etc.)
 */

const QAPair = require("../database/models/QAPair");
const { normalizeText, generateQuestionHash } = require('../utils/textProcessing');
const { detectHRIntent, HR_INTENT_TO_ANSWER } = require('../utils/intentDetection');

/**
 * Check if query contains HR keywords
 */
function hasHRKeywords(normalizedMessage) {
  return (
    normalizedMessage.includes("leave") || 
    normalizedMessage.includes("attendance") || 
    normalizedMessage.includes("payroll") || 
    normalizedMessage.includes("salary") || 
    normalizedMessage.includes("holiday") || 
    normalizedMessage.includes("hr") ||
    normalizedMessage.includes("working hours") ||
    normalizedMessage.includes("shift") ||
    normalizedMessage.includes("employee")
  );
}

/**
 * Handle employee/HR queries
 */
async function handleEmployeeQuery(message, normalizedMessage, userRole, audienceFilter) {
  const hrIntent = detectHRIntent(normalizedMessage);
  
  console.log(`🔍 HR query detected - Role: ${userRole}, Intent: ${hrIntent}, Query: "${message.substring(0, 50)}"`);
  
  // First try hardcoded HR answers
  if (hrIntent && HR_INTENT_TO_ANSWER[hrIntent]) {
    console.log(`✅ Using hardcoded HR answer for intent: ${hrIntent}`);
    return {
      response: HR_INTENT_TO_ANSWER[hrIntent],
      context: { type: "qa", answer: HR_INTENT_TO_ANSWER[hrIntent], audience: "employee", hrIntent }
    };
  }
  
  // Try MongoDB search
  const hasHRKeywords = 
    hrIntent || 
    normalizedMessage.includes("leave") || 
    normalizedMessage.includes("attendance") || 
    normalizedMessage.includes("payroll") || 
    normalizedMessage.includes("salary") || 
    normalizedMessage.includes("holiday") || 
    normalizedMessage.includes("hr") ||
    normalizedMessage.includes("working hours") ||
    normalizedMessage.includes("shift") ||
    normalizedMessage.includes("employee");
  
  if (hasHRKeywords) {
    console.log(`🔍 HR keywords detected, searching MongoDB for employee Q&A...`);
    
    // Try exact match
    let qaPair = await QAPair.findOne({ 
      normalizedQuestion: normalizedMessage,
      audience: { $in: ["employee", "public"] }
    });
    
    // Try hash-based match
    if (!qaPair) {
      const questionHash = generateQuestionHash(normalizedMessage);
      qaPair = await QAPair.findOne({ 
        questionHash: questionHash,
        audience: { $in: ["employee", "public"] }
      });
    }
    
    // Try partial match
    if (!qaPair) {
      const keywords = normalizedMessage.split(" ").filter(w => w.length > 3);
      if (keywords.length > 0) {
        qaPair = await QAPair.findOne({
          $or: [
            { normalizedQuestion: { $regex: keywords[0], $options: "i" } },
            { question: { $regex: keywords[0], $options: "i" } }
          ],
          audience: { $in: ["employee", "public"] }
        });
      }
    }
    
    if (qaPair) {
      console.log(`✅ Found HR Q&A in MongoDB: ${qaPair.question.substring(0, 50)}...`);
      return {
        response: qaPair.answer,
        context: { type: "qa", answer: qaPair.answer, audience: "employee", source: "mongodb" }
      };
    }
    
    // Fallback to hardcoded answers
    console.log(`⚠️  No MongoDB match found for HR query, using hardcoded fallback.`);
    
    if (hrIntent && HR_INTENT_TO_ANSWER[hrIntent]) {
      return {
        response: HR_INTENT_TO_ANSWER[hrIntent],
        context: { type: "qa", answer: HR_INTENT_TO_ANSWER[hrIntent], audience: "employee", hrIntent: hrIntent, source: "hardcoded_fallback" }
      };
    }
    
    // Try to infer intent from keywords
    let fallbackIntent = null;
    
    if (normalizedMessage.includes("leave policy") || (normalizedMessage.includes("leave") && normalizedMessage.includes("policy"))) {
      fallbackIntent = "hr_leave_policy";
    } else if (normalizedMessage.includes("leave types") || normalizedMessage.includes("types of leave")) {
      fallbackIntent = "hr_leave_types";
    } else if (normalizedMessage.includes("attendance") || normalizedMessage.includes("working hours") || normalizedMessage.includes("shift")) {
      fallbackIntent = "hr_attendance_shift";
    } else if (normalizedMessage.includes("payroll") || normalizedMessage.includes("salary")) {
      fallbackIntent = "hr_payroll_salary";
    } else if (normalizedMessage.includes("holiday") || normalizedMessage.includes("weekly off")) {
      fallbackIntent = "hr_holiday_calendar";
    } else if (normalizedMessage.includes("hr helpdesk") || normalizedMessage.includes("contact hr")) {
      fallbackIntent = "hr_helpdesk";
    }
    
    if (fallbackIntent && HR_INTENT_TO_ANSWER[fallbackIntent]) {
      return {
        response: HR_INTENT_TO_ANSWER[fallbackIntent],
        context: { type: "qa", answer: HR_INTENT_TO_ANSWER[fallbackIntent], audience: "employee", hrIntent: fallbackIntent, source: "hardcoded_fallback" }
      };
    }
    
    // Last resort: generic HR helpdesk answer
    return {
      response: HR_INTENT_TO_ANSWER["hr_helpdesk"],
      context: { type: "qa", answer: HR_INTENT_TO_ANSWER["hr_helpdesk"], audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_generic" }
    };
  }
  
  // Even if no HR keywords but user is employee, try to provide helpful response
  if (hrIntent && HR_INTENT_TO_ANSWER[hrIntent]) {
    return {
      response: HR_INTENT_TO_ANSWER[hrIntent],
      context: { type: "qa", answer: HR_INTENT_TO_ANSWER[hrIntent], audience: "employee", hrIntent: hrIntent, source: "hardcoded_intent" }
    };
  }
  
  // Final fallback
  return {
    response: HR_INTENT_TO_ANSWER["hr_helpdesk"],
    context: { type: "qa", answer: HR_INTENT_TO_ANSWER["hr_helpdesk"], audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_final" }
  };
}

module.exports = {
  hasHRKeywords,
  handleEmployeeQuery
};
