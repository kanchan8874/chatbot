// LLM Service using Groq (Free Tier)
// Yeh service AI responses generate karta hai using Groq API
// PRD ke according: LLM ko sirf retrieved data se answer karna hai, no hallucination

const config = require('../config/env');
const freeLLMService = require('./freeLLMService'); // Use the existing Groq service

class LLMService {
  constructor() {
    // Use the existing Groq service instead of OpenAI
    this.useGroq = freeLLMService.client !== null;
    if (!this.useGroq) {
      console.warn("⚠️  Groq API key not set. LLM responses will use fallback.");
    } else {
      console.log("✅ LLM service initialized with Groq");
    }
  }

 
  async generateResponse(userQuestion, context, userRole = 'client', detectedLanguage = 'und') {
    // Use the Groq service instead of OpenAI
    if (!this.useGroq) {
      console.warn("⚠️  Groq not available, using fallback response");
      // Return a fallback response if Groq is not available
      if (context.type === 'qa' && context.answer) {
        return context.answer;
      }
      return "I couldn't generate a response. Please try again.";
    }

    try {
      // Delegate to the existing freeLLMService which handles Groq
      const response = await freeLLMService.generateResponse(userQuestion, context, userRole, detectedLanguage);
      
      console.log(`✅ Generated LLM response for question: "${userQuestion.substring(0, 50)}..."`);
      
      return response;
    } catch (error) {
      console.error("❌ Error generating LLM response:", error.message);
      // Fallback to the freeLLMService's fallback response
      if (context.type === 'qa' && context.answer) {
        return context.answer;
      }
      return "I encountered an error processing your request. Please try again.";
    }
  }

  /**
   * Test function
   */
  async testConnection() {
    if (!this.useGroq) {
      return { success: false, error: "Groq service not initialized" };
    }

    try {
      const testResponse = await this.generateResponse(
        "What is 2+2?",
        { type: 'qa', answer: "The answer is 4." },
        'client'
      );
      return {
        success: true,
        service: "Groq",
        testResponse: testResponse.substring(0, 100)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new LLMService();
