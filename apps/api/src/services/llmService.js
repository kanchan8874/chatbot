// OpenAI LLM Service
// Yeh service AI responses generate karta hai using GPT-4
// PRD ke according: LLM ko sirf retrieved data se answer karna hai, no hallucination

const { OpenAI } = require('openai');
const config = require('../config/env');

class LLMService {
  constructor() {
    if (!config.openai.apiKey) {
      console.warn("⚠️  OpenAI API key not found. LLM responses will fail.");
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
    this.model = config.openai.model;
  }

  /**
   * Generate AI response using retrieved context
   * PRD requirement: Answer ONLY from given sources, no hallucination
   * 
   * @param {string} userQuestion - User ka question
   * @param {object} context - Retrieved context (QA answer, document chunks, or employee data)
   * @param {string} userRole - User role (client/employee)
   * @returns {Promise<string>} - AI generated response
   */
  async generateResponse(userQuestion, context, userRole = 'client', detectedLanguage = 'und') {
    if (!this.client) {
      throw new Error("OpenAI client not initialized. Please set OPENAI_API_KEY in .env");
    }

    try {
      // Context type ke according prompt build karo
      let systemPrompt = '';
      let userPrompt = '';

      switch (context.type) {
        case 'qa':
          // CSV Q&A fast path - direct answer use karo
          const langInstruction = detectedLanguage !== 'eng' && detectedLanguage !== 'und' ? 'Please respond in the same language as the user\'s query (Hindi/English mix is acceptable).' : 'Please respond in English.';
          systemPrompt = `You are Mobiloitte AI, a helpful assistant for Mobiloitte Group.
Your role is to answer questions accurately using ONLY the provided information.

RESPONSE FORMATTING RULES (CRITICAL):
1. Keep responses SHORT and READABLE (maximum 3-5 lines per section)
2. Use STRUCTURED format when appropriate:
   - Start with a brief greeting/context (1 line)
   - Use bullet points (•) for lists (3-6 items max)
   - End with a short summary line (1-2 lines)
3. Break long answers into multiple short sections
4. Use bullet points instead of long paragraphs
5. Be conversational, polite, and professional
6. Answer ONLY from the provided answer below
7. Do NOT add information not in the provided answer
8. " + langInstruction + "`;

          userPrompt = `Question: ${userQuestion}

Provided Answer:
${context.answer}

Format your answer as:
- Short greeting/context (1 line)
- Bullet points if listing items (• item 1, • item 2, etc.)
- Brief summary (1-2 lines)

Answer using ONLY the provided answer above:`;

          break;

        case 'document':
          // Document RAG - chunks se answer generate karo
          const docLangInstruction = detectedLanguage !== 'eng' && detectedLanguage !== 'und' ? 'Please respond in the same language as the user\'s query (Hindi/English mix is acceptable).' : 'Please respond in English.';
          const chunksText = context.chunks
            .map((chunk, idx) => `[Source ${idx + 1}]\n${chunk.text || chunk.metadata?.text || ''}`)
            .join('\n\n');

          systemPrompt = `You are Mobiloitte AI, a helpful assistant for Mobiloitte Group.
Your role is to answer questions using ONLY the retrieved document chunks below.

RESPONSE FORMATTING RULES (CRITICAL):
1. Keep responses SHORT and READABLE (maximum 3-5 lines per section)
2. Use STRUCTURED format when appropriate:
   - Start with a brief greeting/context (1 line)
   - Use bullet points (•) for lists (3-6 items max)
   - End with a short summary line (1-2 lines)
3. Break long answers into multiple short sections
4. Use bullet points instead of long paragraphs
5. Be conversational, polite, and professional
6. Answer ONLY using information from the provided chunks
7. If information is not in the chunks, politely suggest rephrasing or asking about Mobiloitte's services
8. Do NOT make up or hallucinate information
9. " + docLangInstruction + "`;

          userPrompt = `Question: ${userQuestion}

Retrieved Document Chunks:
${chunksText}

Format your answer as:
- Short greeting/context (1 line)
- Bullet points if listing items (• item 1, • item 2, etc.)
- Brief summary (1-2 lines)

Answer using ONLY the information from the chunks above. If the answer is not in the chunks, say so clearly:`;

          break;

        case 'employee_data':
          // Employee operational data
          systemPrompt = `You are Mobiloitte AI, an internal assistant for Mobiloitte employees.
Your role is to help employees with their operational queries using the provided data.
Rules:
- Use ONLY the provided employee data
- Be clear and helpful
- Format information in an easy-to-read way`;

          userPrompt = `Question: ${userQuestion}

Employee Data:
${JSON.stringify(context.data, null, 2)}

Answer the question using the employee data above:`;

          break;

        default:
          systemPrompt = `You are Mobiloitte AI, a helpful assistant.
Answer questions accurately using the provided context.`;

          userPrompt = `Question: ${userQuestion}\n\nContext: ${JSON.stringify(context)}`;
      }

      // OpenAI API call
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3, // Low temperature = more focused, less creative (PRD requirement)
        max_tokens: 1000
      });

      const aiResponse = response.choices[0].message.content.trim();
      
      console.log(`✅ Generated LLM response for question: "${userQuestion.substring(0, 50)}..."`);
      
      return aiResponse;
    } catch (error) {
      console.error("❌ Error generating LLM response:", error.message);
      throw new Error(`Failed to generate LLM response: ${error.message}`);
    }
  }

  /**
   * Test function
   */
  async testConnection() {
    if (!this.client) {
      return { success: false, error: "OpenAI client not initialized" };
    }

    try {
      const testResponse = await this.generateResponse(
        "What is 2+2?",
        { type: 'qa', answer: "The answer is 4." },
        'client'
      );
      return {
        success: true,
        model: this.model,
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
