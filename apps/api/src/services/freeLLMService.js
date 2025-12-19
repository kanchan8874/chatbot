// Free LLM Service using Groq (Free Tier Available)
// Groq provides free API access with fast inference

const Groq = require('groq-sdk');
const config = require('../config/env');

class FreeLLMService {
  constructor() {
    // Groq free API key from .env file
    // Get free key from: https://console.groq.com
    this.apiKey = process.env.GROQ_API_KEY;
    
    if (this.apiKey && this.apiKey.trim() !== '' && this.apiKey.startsWith('gsk_')) {
      this.client = new Groq({
        apiKey: this.apiKey
      });
      console.log("✅ Groq API key found! Using Groq LLM service (FREE tier)");
    } else {
      console.warn("⚠️  Groq API key not set. Using fallback responses.");
      console.warn("💡 Get FREE Groq API key from: https://console.groq.com");
      this.client = null;
    }
    this.model = 'llama-3.3-70b-versatile'; // Groq free model (updated)
  }

  /**
   * Generate AI response using Groq (free)
   */
  async generateResponse(userQuestion, context, userRole = 'client') {
    // If no Groq key, use smart fallback
    if (!this.client) {
      return this.generateFallbackResponse(userQuestion, context);
    }

    try {
      let systemPrompt = '';
      let userPrompt = '';

      switch (context.type) {
        case 'qa':
          systemPrompt = `You are Mobiloitte AI, a helpful assistant for Mobiloitte Group.
Answer questions accurately using ONLY the provided information.
Rules:
- Answer ONLY from the provided answer below
- Do NOT add information not in the provided answer
- Be concise and clear`;

          userPrompt = `Question: ${userQuestion}

Provided Answer:
${context.answer}

Answer the question using ONLY the provided answer above:`;
          break;

        case 'document':
          const chunksText = context.chunks
            .map((chunk, idx) => `[Source ${idx + 1}]\n${chunk.text || chunk.metadata?.text || ''}`)
            .join('\n\n');

          systemPrompt = `You are Mobiloitte AI, a helpful assistant for Mobiloitte Group.
Answer questions using ONLY the retrieved document chunks below.
Rules:
- Answer ONLY using information from the provided chunks
- If information is not in the chunks, politely suggest rephrasing or asking about Mobiloitte's services
- Do NOT make up information
- Be accurate, helpful, and friendly`;

          userPrompt = `Question: ${userQuestion}

Retrieved Document Chunks:
${chunksText}

Answer using ONLY the information from the chunks above:`;
          break;

        case 'employee_data':
          systemPrompt = `You are Mobiloitte AI, an internal assistant for Mobiloitte employees.
Help employees with operational queries using the provided data.`;

          userPrompt = `Question: ${userQuestion}

Employee Data:
${JSON.stringify(context.data, null, 2)}

Answer the question using the employee data above:`;
          break;

        default:
          systemPrompt = `You are Mobiloitte AI, a helpful assistant.`;
          userPrompt = `Question: ${userQuestion}\n\nContext: ${JSON.stringify(context)}`;
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("❌ Groq API error, using fallback:", error.message);
      return this.generateFallbackResponse(userQuestion, context);
    }
  }

  /**
   * Fallback response when API not available
   */
  generateFallbackResponse(userQuestion, context) {
    // Priority 1: Direct QA answer (fastest)
    if (context.type === 'qa' && context.answer) {
      return context.answer;
    }
    
    // Priority 2: Employee data
    if (context.type === 'employee_data') {
      return `Your leave balance: Annual Leave - ${context.data.remainingLeave} days remaining (${context.data.usedLeave} used), Sick Leave - ${context.data.remainingSickLeave} days remaining (${context.data.usedSickLeave} used).`;
    }
    
    // Priority 3: Document chunks (if available)
    if (context.type === 'document' && context.chunks && context.chunks.length > 0) {
      const firstChunk = context.chunks[0].text || context.chunks[0].metadata?.text || '';
      if (firstChunk) {
        return `Based on the information available: ${firstChunk.substring(0, 500)}...`;
      }
    }
    
    // Last resort: Helpful, friendly message (consistent with chatController)
    return "I couldn't find this information in our knowledge base. Could you rephrase your question or ask about Mobiloitte's services, AI solutions, or company information?";
  }
}

module.exports = new FreeLLMService();
