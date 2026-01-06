// Free LLM Service using Groq (Free Tier Available)
// Groq provides free API access with fast inference

const Groq = require('groq-sdk');
const config = require('../config/env');

class FreeLLMService {
  constructor() {
    // Groq free API key from .env file
    // Get free key from: https://console.groq.com
    this.apiKey = config.groq?.apiKey || process.env.GROQ_API_KEY;
    
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
  async generateResponse(userQuestion, context, userRole = 'client', detectedLanguage = 'und') {
    // If no Groq key, use smart fallback
    if (!this.client) {
      return this.generateFallbackResponse(userQuestion, context);
    }

    try {
      let systemPrompt = '';
      let userPrompt = '';

      const languageInstruction = (detectedLanguage === 'en-IN' || detectedLanguage === 'hin')
        ? "- You MUST respond in Hinglish (a mix of Hindi and English) which is natural for Indian users. For example: 'Aapki application processed hai' or 'Please check your leaves balance in the dashboard'. Keep the tone professional but accessible."
        : "- You MUST respond ONLY in English. Use clear, professional English for all responses.";

      switch (context.type) {
        case 'qa':
          systemPrompt = `You are Mobiloitte AI, a helpful assistant for Mobiloitte Group.
Answer questions accurately using ONLY the provided information.

LANGUAGE RULE:
${languageInstruction}

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
7. Do NOT add information not in the provided answer`;

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
          const chunksText = context.chunks
            .map((chunk, idx) => `[Source ${idx + 1}] (source_id=${chunk.metadata?.source_id || chunk.source || 'unknown'}, chunk_id=${chunk.metadata?.chunk_id || chunk.chunkId || 'unknown'}, score=${chunk.score ?? 'n/a'})\n${chunk.text || chunk.metadata?.text || ''}`)
            .join('\n\n');

          systemPrompt = `You are Mobiloitte AI, a helpful assistant for Mobiloitte Group.
Answer questions using ONLY the retrieved document chunks below.

LANGUAGE RULE:
${languageInstruction}

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
7. If the needed information is NOT present in the chunks, explicitly respond: "I don’t have enough verified information from the provided sources to answer this question."
8. Do NOT make up information
9. Add inline citations in the answer using [S1], [S2] referring to the numbered sources`;

          userPrompt = `Question: ${userQuestion}

Retrieved Document Chunks:
${chunksText}

Format your answer as:
- Short greeting/context (1 line)
- Bullet points if listing items (• item 1, • item 2, etc.) and add inline citation [S#] per bullet
- Brief summary (1-2 lines) with a citation if relevant

Answer using ONLY the information from the chunks above:`;
          break;

        case 'document_fact':
          const factChunks = context.chunks
            .map((chunk, idx) => `[Source ${idx + 1}]\n${chunk.text || chunk.metadata?.text || ''}`)
            .join('\n\n');

          systemPrompt = `You are Mobiloitte AI. Your goal is to provide a grounded, truthful, and helpful answer.
INTENT: The user is asking for a specific fact (e.g., location, founder, contact).

RULES:
1. If the retrieved chunks contain the EXACT answer, provide it clearly and concisely.
2. If the chunks do NOT contain the exact answer but contain HELPFUL RELATED information (like a general contact link or website), provide that as a helpful bridge.
3. BE HONEST: If you are providing related info instead of the exact fact, start by saying you don't have the specific detail but offer the related info.
4. Keep the response under 4 lines.

LANGUAGE RULE:
${languageInstruction}`;

          userPrompt = `User Question: ${userQuestion}
Retrieved Data:
${factChunks}

Response Guidelines:
- If exact fact found: Give it.
- If not found but related info exists: "I couldn't find the exact [fact], but you can check [related info]..."
- If nothing relevant exists: "I don't have verified information for this specifically."`;
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
   * Translate a follow-up question into a standalone query using session history
   */
  async translateToStandaloneQuery(userQuestion, sessionHistory = []) {
    if (!this.client || sessionHistory.length === 0) return userQuestion;

    try {
      const historyText = sessionHistory
        .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.message}`)
        .join('\n');

      const systemPrompt = `You are a query rewriter. Your task is to rewrite the LAST user question into a standalone, clear query that can be used for search.
Use the conversation history to resolve pronouns (it, they, its, the company, etc.) and context.

RULES:
1. Return ONLY the rewritten query.
2. Do NOT add any preamble or explanation.
3. If the question is already standalone, return it as is.
4. If the question is a fragment related to the history, expand it.
   Example: History mentions 'Mobiloitte'. Question: 'Its founder?' -> Rewritten: 'Who is the founder of Mobiloitte?'`;

      const userPrompt = `History:\n${historyText}\n\nLast Question: ${userQuestion}`;

      const response = await this.client.chat.completions.create({
        model: 'llama-3.1-8b-instant', // Fast model for rewriting
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        max_tokens: 100
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.warn("❌ Translation failed, using original query:", error.message);
      return userQuestion;
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
    if (context.type === 'document' && (context.chunks && context.chunks.length > 0)) {
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
