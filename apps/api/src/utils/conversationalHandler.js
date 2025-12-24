/**
 * Conversational Intent Handler
 * Handles greetings, thanks, goodbye, and other conversational intents
 */

const { normalizeText } = require('./textProcessing');

/**
 * Detect greetings and small talk (conversational intents)
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
      "Hi! 👋 I am Mobiya ,How can I help you today?",
      "Hello! 👋 I am Mobiya , Ask me anything about Mobiloitte's services, AI solutions, or company information.",
      "Hey there! 👋 I am Mobiya , I'm here to help with questions about Mobiloitte. What would you like to know?",
      "Hi! 👋 I am Mobiya , I can help you learn about our AI development services, company information, and more. What can I help you with?",
      "Hi 👋 I am Mobiya , I'm doing well, thanks for asking! I can help you with questions about Mobiloitte's services, AI solutions, or company information. What would you like to know?",
      "Hii 👋 I am Mobiya , I'm great! How can I assist you with Mobiloitte-related questions today?"
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
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = {
  detectConversationalIntent,
  getConversationalResponse
};
