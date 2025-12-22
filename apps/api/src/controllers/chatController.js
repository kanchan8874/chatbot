const QAPair = require("../database/models/QAPair");
const IngestionJob = require("../database/models/IngestionJob");
const embeddingService = require("../services/embeddingService");
const llmService = require("../services/llmService");
const freeLLMService = require("../services/freeLLMService");
const pineconeService = require("../services/pineconeService");

// Import libraries for text validation
const gibberishDetector = require("gibberish-detector");

// franc and bad-words are ES Modules, so we'll use dynamic import when needed
let francModule = null;
let badWordsModule = null;

async function loadFranc() {
  if (!francModule) {
    try {
      francModule = await import("franc");
    } catch (error) {
      console.warn("⚠️  Failed to load franc module:", error.message);
      return null;
    }
  }
  return francModule;
}

async function loadBadWords() {
  if (!badWordsModule) {
    try {
      badWordsModule = await import("bad-words");
    } catch (error) {
      console.warn("⚠️  Failed to load bad-words module:", error.message);
      return null;
    }
  }
  return badWordsModule;
}

/**
 * Enhanced gibberish detection using gibberish-detector library
 * Combines library detection with fallback heuristics for better accuracy
 * IMPORTANT: Whitelist legitimate HR/professional queries before checking gibberish
 */
function isGibberish(text, userRole = "client") {
  if (!text) return true;

  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Very short text (1-2 chars) - allow common single chars like "a", "I"
  if (trimmed.length < 3) {
    const commonShortWords = ["hi", "ok", "no", "yes", "ok", "a", "i"];
    if (commonShortWords.includes(trimmed.toLowerCase())) {
      return false; // Allow common short words
    }
    // Very short non-alphabetic or random chars
    const alphaChars = trimmed.match(/[a-zA-Z]/g);
    if (!alphaChars || alphaChars.length < trimmed.length * 0.5) {
      return true;
    }
  }

  const lowerText = trimmed.toLowerCase();
  
  // WHITELIST: Check for legitimate question patterns BEFORE gibberish detection
  // This prevents false positives for HR queries, professional terms, etc.
  const legitimateQuestionPatterns = [
    /^(how|what|when|where|why|who|which|whom|can|could|should|would|do|does|did|is|are|was|were|will|tell|explain|describe|share|show)\s+/i,
    /^(what\s+is|what\s+are|how\s+does|how\s+do|how\s+can|how\s+to|tell\s+me|explain|describe)/i,
    /^(who|what|which|whom)\s+(is|are|was|were|did|does|do)/i, // "who is", "whom the", etc.
  ];
  
  const hasQuestionPattern = legitimateQuestionPatterns.some(pattern => pattern.test(trimmed));
  
  // WHITELIST: HR and professional keywords that should never be flagged as gibberish
  const professionalKeywords = [
    // HR terms
    "leave", "attendance", "payroll", "salary", "holiday", "hr", "employee", "benefits",
    "policy", "procedure", "process", "appraisal", "onboarding", "resignation", "exit",
    "casual", "sick", "earned", "privilege", "maternity", "paternity", "compensatory",
    "working hours", "shift", "work from home", "wfh", "hybrid", "flexible",
    "payslip", "ctc", "pf", "esi", "tds", "deduction", "allowance", "hra",
    "holiday calendar", "weekly off", "helpdesk", "people partner",
    // Professional terms
    "service", "solution", "company", "mobiloitte", "client", "project", "team",
    "technology", "ai", "blockchain", "development", "integration",
    // Company leadership terms (to prevent gibberish false positives)
    "founder", "founders", "director", "directors", "ceo", "chairman", "leadership",
    "started", "founded", "established", "created", "began", "incorporated",
  ];
  
  const hasProfessionalKeyword = professionalKeywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  // If it looks like a legitimate question with professional keywords, skip gibberish check
  if (hasQuestionPattern || hasProfessionalKeyword) {
    return false;
  }

  // Use gibberish-detector library for detection (only if not whitelisted)
  try {
    const gibberishScore = gibberishDetector.detect(trimmed);
    // Score > 50 indicates likely gibberish
    // Lower threshold (40) for stricter detection, but be more lenient for employee queries
    const threshold = userRole === "employee" ? 60 : 40; // More lenient for HR queries
    if (gibberishScore > threshold) {
      console.log(`⚠️  Gibberish detected (score: ${gibberishScore}): "${trimmed.substring(0, 50)}"`);
      return true;
    }
  } catch (error) {
    console.warn(`⚠️  Gibberish detector error: ${error.message}, using fallback`);
    // Fallback to basic heuristics if library fails
  }

  // Fallback: Check if text is mostly non-alphabetic
  const alphaChars = trimmed.match(/[a-zA-Z]/g);
  if (!alphaChars) return true;

  const alphaRatio = alphaChars.length / trimmed.length;
  if (alphaRatio < 0.5) return true;

  // Fallback: Check for random character patterns (no vowels, too many consonants)
  // But skip this check if it contains professional keywords
  if (!hasProfessionalKeyword) {
    const hasSpace = /\s/.test(trimmed);
    if (!hasSpace && trimmed.length > 5) {
      const vowels = trimmed.match(/[aeiouAEIOU]/g) || [];
      const consonants = trimmed.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || [];
      if (consonants.length >= 8 && vowels.length === 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect language of the input text using franc library
 * Returns language code (e.g., 'eng', 'hin', 'spa') or 'und' for undetected
 * Note: This is async because franc is ES Module
 */
async function detectLanguage(text) {
  if (!text || text.trim().length === 0) return 'und';
  
  try {
    // franc needs at least 3 characters for reliable detection
    if (text.trim().length < 3) return 'und';
    
    const franc = await loadFranc();
    if (!franc || !franc.default) {
      return 'und'; // Fallback if franc not loaded
    }
    
    const detectedLang = franc.default(text);
    return detectedLang || 'und';
  } catch (error) {
    console.warn(`⚠️  Language detection error: ${error.message}`);
    return 'und';
  }
}

/**
 * Check if text contains profanity using bad-words library
 * Returns true if profanity detected, false otherwise
 * Note: This is async because bad-words is ES Module
 */
async function containsProfanity(text) {
  if (!text || text.trim().length === 0) return false;
  
  try {
    const badWords = await loadBadWords();
    if (!badWords || !badWords.default) {
      // Fallback: basic profanity check if module not loaded
      const commonProfanity = ['damn', 'hell'];
      const lowerText = text.toLowerCase();
      return commonProfanity.some(word => lowerText.includes(word));
    }
    
    const Filter = badWords.default;
    const profanityFilter = new Filter();
    return profanityFilter.isProfane(text);
  } catch (error) {
    console.warn(`⚠️  Profanity filter error: ${error.message}`);
    // Fallback: basic profanity check
    const commonProfanity = ['damn', 'hell'];
    const lowerText = text.toLowerCase();
    return commonProfanity.some(word => lowerText.includes(word));
  }
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

// HR-specific curated answers (for employee role) – mirrors HR CSV content
// This allows reliable answers even if HR CSV has not yet been ingested
// into MongoDB / Pinecone.
const HR_INTENT_TO_ANSWER = {
  hr_leave_policy:
    "Mobiloitte follows a structured leave policy designed to balance employee well-being with business continuity. Full-time employees are typically eligible for a mix of casual leave, sick leave and earned/privilege leave as per their letter of appointment. All planned leaves should be applied in advance through the HR or attendance system and approved by the reporting manager. Unplanned or emergency leaves (for example medical or urgent personal reasons) should be informed to the manager and HR at the earliest possible time.",
  hr_leave_types:
    "Employees are usually provided with multiple leave types such as Casual Leave (for short term personal needs), Sick Leave (for illness or medical reasons) and Earned/Privilege Leave (for longer planned vacations). The exact entitlement and accrual rules are defined in the appointment letter and HR handbook. Unused earned leave may be carried forward or encashed as per company policy, whereas casual leave and sick leave may lapse at the end of the policy year if not used.",
  hr_attendance_shift:
    "Mobiloitte typically follows standard working hours communicated in the offer letter, for example 9 hours including breaks on working days. Employees are expected to mark attendance regularly using the prescribed system (biometric, web portal or mobile app) and adhere to in-time and out-time guidelines. Repeated late coming or unapproved short attendance can impact salary, performance evaluation or disciplinary actions as per HR policy.",
  hr_payroll_salary:
    "Payroll is normally processed on a monthly cycle with salary credit to the employee's registered bank account on a fixed date, subject to variations for weekends or bank holidays. Deductions for statutory components such as PF, ESI, TDS and any unpaid leave are applied as per applicable laws and company policy. Employees can view their salary breakup, payslips and deductions through the HR/payroll portal or by contacting the HR team.",
  hr_holiday_calendar:
    "The official list of company holidays and weekly-offs is published at the beginning of each calendar or financial year by HR. Typically, employees are entitled to national holidays, festival holidays and weekly rest days (such as Saturdays/Sundays or staggered weekly offs depending on the project and location). Any work on an official holiday or weekly-off is governed by compensatory-off or overtime policy as defined in the HR guidelines.",
  hr_helpdesk:
    "Employees can reach the HR team using the official HR helpdesk email ID, internal communication channels or the phone extension shared at the time of joining. For queries related to leave, attendance, payroll, documents or policy clarifications, employees should raise a ticket or email with clear details so HR can track and resolve the issue. In case of urgent or sensitive matters, employees may schedule a direct discussion with the assigned HR representative or People Partner.",
};

// Admin-specific curated answers (for admin role) – mirrors Admin CSV content
// This allows reliable answers even if Admin CSV has not yet been ingested
// into MongoDB / Pinecone.
const ADMIN_INTENT_TO_ANSWER = {
  admin_analytics:
    "As an admin, you can access comprehensive chatbot analytics and user reports through the Admin Dashboard. Navigate to the Analytics section where you'll find: 1) Usage Metrics - Total queries, active users, peak usage times, queries per user, and session duration statistics. 2) User Reports - Individual user activity, query history, most active users, and user engagement patterns. 3) Query Analytics - Most common questions, query categories, response times, and success rates. 4) Performance Metrics - System uptime, API response times, error rates, and throughput statistics. 5) Export Options - Download reports in CSV/PDF format for further analysis. The dashboard provides real-time data visualization with charts and graphs, and you can filter reports by date range, user role, or query type. For detailed analytics API access or custom reports, contact the development team.",
  admin_knowledge:
    "Admin users can manage the chatbot knowledge base through the Knowledge Management section in the Admin Dashboard. Key features include: 1) CSV Q&A Management - Upload, edit, or delete CSV files containing question-answer pairs. Use the 'Insert CSV to MongoDB' script to add new Q&A data. 2) Document Management - Upload PDFs, Word documents, or text files to be processed and indexed. Documents are automatically chunked and embedded for semantic search. 3) Content Editing - Edit existing Q&A pairs, update answers, modify categories, tags, and audience settings (public/employee/admin). 4) Version Control - Track changes, view edit history, and revert to previous versions if needed. 5) Bulk Operations - Import/export knowledge base content, bulk update tags or categories. 6) Ingestion Jobs - Monitor document processing status, view ingestion logs, and manage indexing jobs. Always test changes in a staging environment before deploying to production. For advanced knowledge base management, refer to the Admin Knowledge Base documentation.",
  admin_users:
    "User management is available through the Admin Dashboard's User Management section. Admins can: 1) View All Users - See complete list of registered users with details like email, role, employee ID, registration date, and last login. 2) Role Management - Assign or change user roles (client, employee, admin). Roles determine access levels and chatbot content visibility. 3) User Status - Activate, deactivate, or suspend user accounts. Deactivated users cannot log in or access the system. 4) Permissions - Configure role-based permissions for different features (chatbot access, admin panel access, knowledge base editing, etc.). 5) Bulk Operations - Import users via CSV, export user lists, or bulk role assignments. 6) Audit Trail - View user activity logs, login history, and action history. 7) Password Management - Reset user passwords or force password changes. Always follow security best practices when managing user accounts. For advanced user management features or API access, contact the system administrator.",
  admin_config:
    "Admins can configure various system settings through the Admin Dashboard's System Configuration section: 1) Chatbot Settings - Configure LLM provider (OpenAI/Groq), API keys, response timeouts, max tokens, and temperature settings. 2) Embedding Settings - Configure embedding model (Cohere), chunk size, overlap, and indexing parameters. 3) Pinecone Configuration - Manage Pinecone API keys, index names, namespaces (qa, public_docs, employee_docs), and vector dimensions. 4) MongoDB Settings - Configure database connection, collection names, and data retention policies. 5) Security Settings - JWT secret keys, token expiration, CORS settings, rate limiting, and IP whitelisting. 6) Content Moderation - Enable/disable profanity filters, gibberish detection, language detection, and out-of-scope query handling. 7) Feature Flags - Toggle features like Google login, signup, advanced analytics, etc. 8) Email/SMS Settings - Configure notification channels for alerts and reports. Always backup configurations before making changes. For production changes, coordinate with the development team.",
  admin_performance:
    "The Admin Dashboard provides comprehensive performance metrics and KPIs: 1) Response Metrics - Average response time, p95/p99 response times, success rate, error rate, and timeout frequency. 2) Usage KPIs - Daily/monthly active users, queries per day, peak concurrent users, and user retention rate. 3) Quality Metrics - Answer accuracy (based on user feedback), query resolution rate, fallback to LLM rate, and CSV match rate vs RAG match rate. 4) System Health - Server uptime, API availability, database connection health, Pinecone query latency, and embedding generation time. 5) Cost Metrics - API call costs (OpenAI/Groq), embedding costs (Cohere), Pinecone usage costs, and monthly infrastructure costs. 6) User Satisfaction - Average rating, positive feedback percentage, and common complaint categories. 7) Content Performance - Most/least used Q&A pairs, document usage statistics, and knowledge gap analysis. All metrics are available in real-time dashboards with historical trends. Set up alerts for critical KPIs that fall below thresholds. Export metrics for executive reporting.",
  admin_security:
    "Security and access control management is available in the Admin Dashboard's Security section: 1) Authentication Settings - Configure JWT expiration, refresh token policies, password complexity requirements, and multi-factor authentication (MFA) settings. 2) Role-Based Access Control (RBAC) - Define permissions for each role (client, employee, admin) including chatbot access, admin panel access, knowledge base editing, user management, and analytics viewing. 3) API Security - Manage API keys, rate limiting per user/role, IP whitelisting/blacklisting, and CORS configuration. 4) Content Security - Configure content moderation filters (profanity, gibberish detection), sensitive data masking, and data retention policies. 5) Audit Logging - Enable comprehensive audit logs for user actions, system changes, and security events. Logs include timestamps, user IDs, IP addresses, and action details. 6) Session Management - Configure session timeout, concurrent session limits, and device management. 7) Data Privacy - Configure GDPR compliance settings, data anonymization, and user data export/deletion policies. Regularly review security logs and update access controls based on organizational needs. For security incidents, follow the incident response procedure.",
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

// Detect HR‑specific intents for employee role (leave policy, payroll, etc.)
function detectHRIntent(normalizedMessage) {
  if (!normalizedMessage) return null;
  const text = normalizedMessage;

  if (text.includes("leave policy")) {
    return "hr_leave_policy";
  }

  if (
    text.includes("leave types") ||
    (text.includes("types of") && text.includes("leave")) ||
    text.includes("casual leave") ||
    text.includes("sick leave") ||
    text.includes("earned leave") ||
    text.includes("privilege leave")
  ) {
    return "hr_leave_types";
  }

  if (
    text.includes("attendance") ||
    text.includes("working hours") ||
    text.includes("shift") ||
    text.includes("office timing") ||
    text.includes("work from home policy")
  ) {
    return "hr_attendance_shift";
  }

  if (
    text.includes("payroll") ||
    text.includes("salary") ||
    text.includes("payslip") ||
    text.includes("ctc") ||
    text.includes("deduction")
  ) {
    return "hr_payroll_salary";
  }

  if (
    text.includes("holiday calendar") ||
    (text.includes("holiday") && text.includes("list")) ||
    text.includes("weekly off") ||
    text.includes("week off") ||
    text.includes("festival holiday")
  ) {
    return "hr_holiday_calendar";
  }

  if (
    text.includes("hr helpdesk") ||
    (text.includes("contact") && text.includes("hr")) ||
    text.includes("hr email") ||
    text.includes("people partner")
  ) {
    return "hr_helpdesk";
  }

  return null;
}

// Detect Admin-specific intents (analytics, user management, system config, etc.)
function detectAdminIntent(normalizedMessage) {
  if (!normalizedMessage) return null;
  const text = normalizedMessage;

  if (
    text.includes("analytics") ||
    text.includes("usage analytics") ||
    text.includes("user reports") ||
    text.includes("performance metrics") ||
    text.includes("kpi") ||
    text.includes("dashboard")
  ) {
    return "admin_analytics";
  }

  if (
    text.includes("knowledge base") ||
    text.includes("knowledge management") ||
    text.includes("q&a") ||
    text.includes("qa pairs") ||
    text.includes("csv") ||
    text.includes("documents") ||
    text.includes("ingestion")
  ) {
    return "admin_knowledge";
  }

  if (
    text.includes("user management") ||
    text.includes("manage users") ||
    text.includes("roles") ||
    text.includes("permissions") ||
    text.includes("access control") ||
    text.includes("user accounts")
  ) {
    return "admin_users";
  }

  if (
    text.includes("system configuration") ||
    text.includes("system settings") ||
    text.includes("configure") ||
    text.includes("api keys") ||
    text.includes("llm") ||
    text.includes("embedding") ||
    text.includes("pinecone") ||
    text.includes("mongodb settings")
  ) {
    return "admin_config";
  }

  // Check for performance metrics (both phrase and individual words)
  if (
    text.includes("performance metrics") ||
    (text.includes("performance") && text.includes("metrics")) ||
    (text.includes("performance") && text.includes("kpi")) ||
    text.includes("kpis") ||
    text.includes("kpi") ||
    text.includes("response time") ||
    text.includes("system health") ||
    (text.includes("monitoring") && !text.includes("security"))
  ) {
    return "admin_performance";
  }

  if (
    text.includes("security") ||
    text.includes("access control") ||
    text.includes("rbac") ||
    text.includes("authentication") ||
    text.includes("audit logs") ||
    text.includes("compliance")
  ) {
    return "admin_security";
  }

  if (
    text.includes("export") ||
    text.includes("reports") ||
    text.includes("generate reports") ||
    text.includes("data export")
  ) {
    return "admin_reports";
  }

  if (
    text.includes("system health") ||
    text.includes("troubleshoot") ||
    text.includes("monitor") ||
    text.includes("logs") ||
    text.includes("errors") ||
    text.includes("alerts")
  ) {
    return "admin_health";
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
    "experience", "years", "team", "development", "integration",
    // HR-related keywords for employee queries
    "leave", "attendance", "payroll", "salary", "holiday", "hr", "employee",
    "benefits", "perks", "onboarding", "appraisal", "resignation", "exit",
    // Admin-related keywords for admin queries
    "admin", "analytics", "reports", "user management", "system", "configuration",
    "security", "access control", "knowledge base", "dashboard", "metrics", "kpi",
    "monitoring", "logs", "export", "settings", "permissions", "roles"
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
  // BUT: Skip this check if it contains admin/HR/professional keywords (already checked above)
  // This prevents admin queries like "How do I manage..." from being marked out-of-scope
  if ((text.startsWith("how to ") || text.startsWith("how do ")) && !hasScopeKeyword) {
    return true;
  }
  
  return false; // Default: assume in-scope (let CSV/RAG handle it)
}

// Intent classification
function classifyIntent(message, userRole) {
  const lowerMessage = message.toLowerCase();
  
  // Admin queries - prioritize CSV Q&A for admin-specific questions
  if (userRole === "admin") {
    const adminKeywords = [
      "analytics", "reports", "user management", "manage users", "knowledge base",
      "knowledge management", "system configuration", "system settings", "configure",
      "performance metrics", "performance", "metrics", "kpis", "kpi", "security", 
      "access control", "dashboard", "manage", "update", "csv", "documents", 
      "ingestion", "roles", "permissions"
    ];
    
    for (const keyword of adminKeywords) {
      if (lowerMessage.includes(keyword)) {
        return "csv_qa"; // Admin queries should go to CSV Q&A first
      }
    }
  }
  
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
  // CRITICAL: Founder/director keywords should be checked FIRST to prevent services matching
  const founderKeywords = [
    "founder", "founders", "director", "directors", "ceo", "chairman", "leadership",
    "started", "founded", "established", "created", "began", "incorporated"
  ];
  
  const hasFounderKeyword = founderKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // If founder keyword found, prioritize CSV Q&A (founder questions are in CSV)
  if (hasFounderKeyword) {
    return "csv_qa";
  }
  
  const topicKeywords = [
    "traditional ai", "ai solutions", "ai services", "generative ai",
    "blockchain", "services", "mobiloitte", "company", "technologies",
    "industries", "experience", "contact"
  ];
  
  const hasTopicKeyword = topicKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Decision logic - prioritize CSV Q&A for FAQ-like questions
  // "What is", "What are", "What do you mean by", "Define", "Explain" 
  // with specific topics should go to CSV Q&A
  // Also prioritize CSV Q&A for "How do I..." questions if they contain topic keywords
  if (
    faqScore >= 1 || 
    lowerMessage.includes("what is") || 
    lowerMessage.includes("what are") ||
    lowerMessage.includes("what do you mean") ||
    (lowerMessage.includes("how do") && hasTopicKeyword) ||
    (lowerMessage.includes("how to") && hasTopicKeyword) ||
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
    // Step 1: Generate embedding for user query (use 'search_query' for Cohere)
    console.log(`🔍 Generating query embedding for: "${query.substring(0, 50)}..."`);
    const queryEmbedding = await embeddingService.generateEmbedding(query, 'search_query');
    
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
    // Generate query embedding (use 'search_query' for Cohere)
    const queryEmbedding = await embeddingService.generateEmbedding(query, 'search_query');
    
    // Build filter based on audience
    let filter;
    if (audience === 'admin') {
      filter = { audience: { $in: ['admin', 'public'] } };
    } else if (audience === 'employee') {
      filter = { audience: { $in: ['public', 'employee'] } };
    } else {
      filter = { audience: 'public' };
    }
    
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
    
    // Step 2: Authenticate user (Phase 1 RBAC)
    // Prefer req.user from auth middleware (JWT-based)
    let userRole = "client";
    let employeeId = null;
    
    if (req.user) {
      userRole = req.user.role || "client";
      employeeId = req.user.employeeId || null;
    } else if (authToken) {
      // Try to decode JWT token to get role if middleware didn't set req.user
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "mobiloitte_chatbot_secret_key";
        const decoded = jwt.verify(authToken, JWT_SECRET);
        userRole = decoded.role || "client";
        employeeId = decoded.employeeId || null;
        console.log(`🔐 Decoded role from authToken body: ${userRole}, Email: ${decoded.email}`);
      } catch (error) {
        // If token decode fails, try to decode without verification to at least get role
        // This is a fallback for expired/invalid tokens - we'll use keyword-based detection as backup
        try {
          const jwt = require("jsonwebtoken");
          const decodedWithoutVerify = jwt.decode(authToken);
          if (decodedWithoutVerify && decodedWithoutVerify.role) {
            console.log(`⚠️  Token signature invalid but decoded role: ${decodedWithoutVerify.role}. Will use keyword-based detection as fallback.`);
            // Don't set userRole here - let keyword-based detection handle it
            // This prevents security issues while still allowing admin queries to work
          }
        } catch (decodeError) {
          // Token is completely invalid
          console.warn(`⚠️  Failed to decode authToken: ${error.message}. Token may be expired or invalid.`);
        }
        // Don't set userRole to "client" here - let keyword-based detection handle admin queries
        // userRole remains as default "client" but will be overridden if admin keywords detected
      }
    }
    
    // Debug logging for role detection
    console.log(`👤 User role detected: ${userRole}, req.user: ${req.user ? JSON.stringify(req.user) : "null"}, Message: "${message.substring(0, 50)}"`);
    
    // Step 3: Profanity check FIRST (before processing)
    if (await containsProfanity(message)) {
      console.log(`⚠️  Profanity detected in message from ${userRole}`);
      return res.json({
        response: "I'm here to help with professional questions about Mobiloitte. Please use appropriate language.",
        sessionId,
        context: { type: "profanity_detected" }
      });
    }
    
    // Step 3.5: Language detection (for analytics and future multi-language support)
    const detectedLanguage = await detectLanguage(message);
    if (detectedLanguage !== 'und' && detectedLanguage !== 'eng') {
      console.log(`🌐 Detected language: ${detectedLanguage} for message: "${message.substring(0, 50)}"`);
      // For now, we support English only, but log other languages for future support
      // You can add multi-language support later based on this detection
    }
    
    // Step 4: Check for conversational intents (before gibberish check)
    // This ensures greetings like "hi", "hello" are handled properly
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
    
    // Step 5: Gibberish check (only for non-conversational messages)
    // Pass userRole to be more lenient for employee/HR queries
    if (isGibberish(message, userRole)) {
      console.log(`⚠️  Gibberish detected: "${message.substring(0, 50)}"`);
      return res.json({
        response: "I'm sorry, I couldn't understand that. Please ask a clear question about our services or company.",
        sessionId,
        context: { type: "gibberish", language: detectedLanguage }
      });
    }
    
    // Step 6: Check if query is out-of-scope (not related to Mobiloitte)
    // Examples: "how to make maggi", "what is weather", "tell me a joke"
    const normalizedMessage = normalizeText(message);
    if (isOutOfScope(normalizedMessage)) {
      return res.json({
        response: "I'm focused on helping with questions about Mobiloitte's services, AI solutions, company information, and processes. Could you please ask something related to our company?",
        sessionId,
        context: { type: "out_of_scope", language: detectedLanguage }
      });
    }
    
    // Step 7: Classify intent for informational queries
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

        // CRITICAL FIX: Check for admin keywords even if token decode failed
        // This handles cases where token is expired/invalid but user is clearly asking admin questions
        const hasAdminKeywordsInQuery = normalizedMessage.includes("admin") || 
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
          normalizedMessage.includes("kpi");

        // CRITICAL FIX: Check for HR keywords even if token decode failed
        // This handles cases where token is expired/invalid but user is clearly asking HR questions
        const hasHRKeywordsInQuery = normalizedMessage.includes("leave") || 
          normalizedMessage.includes("attendance") || 
          normalizedMessage.includes("payroll") || 
          normalizedMessage.includes("salary") || 
          normalizedMessage.includes("holiday") || 
          normalizedMessage.includes("hr") ||
          normalizedMessage.includes("working hours") ||
          normalizedMessage.includes("shift") ||
          normalizedMessage.includes("employee");

        // Detect Admin intent first (analytics, user management, etc.)
        // Also check if query contains admin keywords (fallback for token decode failures)
        if (userRole === "admin" || hasAdminKeywordsInQuery) {
          // If token decode failed but query has admin keywords, treat as admin
          if (userRole !== "admin" && hasAdminKeywordsInQuery) {
            console.log(`⚠️  Token decode failed but admin keywords detected. Treating as admin query.`);
            userRole = "admin"; // Override role for this query
          }
          const adminIntent = detectAdminIntent(normalizedMessage);
          
          // Debug logging for admin queries
          console.log(`🔍 Admin query detected - Role: ${userRole}, Intent: ${adminIntent}, Query: "${message.substring(0, 50)}"`);
          
          // First try hardcoded admin answers (fast path, works even without MongoDB)
          if (adminIntent && ADMIN_INTENT_TO_ANSWER[adminIntent]) {
            console.log(`✅ Using hardcoded admin answer for intent: ${adminIntent}`);
            context = { type: "qa", answer: ADMIN_INTENT_TO_ANSWER[adminIntent], audience: "admin", adminIntent };
            response = ADMIN_INTENT_TO_ANSWER[adminIntent];
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
          
          // If hardcoded answer not found, try MongoDB CSV search for admin queries
          // Check for admin-related keywords even if intent detection didn't match
          const hasAdminKeywords = adminIntent || 
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
            // Try exact match in MongoDB for admin audience
            let qaPair = await QAPair.findOne({ 
              normalizedQuestion: normalizedMessage,
              audience: { $in: ["admin", "public"] }
            });
            
            // If not found, try hash-based match
            if (!qaPair) {
              const questionHash = generateQuestionHash(normalizedMessage);
              qaPair = await QAPair.findOne({ 
                questionHash: questionHash,
                audience: { $in: ["admin", "public"] }
              });
            }
            
            // If still not found, try partial match on question text (more flexible)
            if (!qaPair) {
              const keywords = normalizedMessage.split(" ").filter(w => w.length > 3);
              if (keywords.length > 0) {
                // Try matching with first significant keyword
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
              context = { type: "qa", answer: qaPair.answer, audience: "admin", source: "mongodb" };
              response = qaPair.answer;
              return res.json({
                response,
                sessionId,
                context: {
                  ...context,
                  language: detectedLanguage,
                  intent: intent
                }
              });
            } else {
              console.log(`⚠️  No MongoDB match found for admin query, but admin keywords detected. Using hardcoded fallback based on detected intent.`);
              // If we detected admin keywords but no MongoDB match, use hardcoded answer based on intent
              // Try to match intent to hardcoded answers
              if (adminIntent && ADMIN_INTENT_TO_ANSWER[adminIntent]) {
                response = ADMIN_INTENT_TO_ANSWER[adminIntent];
                context = { type: "qa", answer: response, audience: "admin", adminIntent: adminIntent, source: "hardcoded_fallback" };
                console.log(`✅ Using hardcoded fallback for admin intent: ${adminIntent}`);
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
              
              // If no specific intent but admin keywords detected, try to infer intent from keywords
              // Priority order: performance > analytics > knowledge > users > config > security
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
                response = ADMIN_INTENT_TO_ANSWER[fallbackIntent];
                context = { type: "qa", answer: response, audience: "admin", adminIntent: fallbackIntent, source: "hardcoded_fallback" };
                console.log(`✅ Using hardcoded fallback for admin intent: ${fallbackIntent}`);
                return res.json({
                  response,
                  sessionId,
                  context: {
                    ...context,
                    language: detectedLanguage,
                    intent: intent
                  }
                });
              } else {
                // Last resort: use admin_knowledge as generic admin answer
                console.log(`⚠️  No specific intent matched, using generic admin_knowledge answer`);
                response = ADMIN_INTENT_TO_ANSWER["admin_knowledge"];
                context = { type: "qa", answer: response, audience: "admin", adminIntent: "admin_knowledge", source: "hardcoded_generic" };
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
          } else {
            // Even if no admin keywords detected but user is admin, try to provide helpful response
            console.log(`⚠️  Admin user but no admin keywords detected. Query: "${normalizedMessage}"`);
            // Still try to match admin intent even without explicit keywords
            if (adminIntent && ADMIN_INTENT_TO_ANSWER[adminIntent]) {
              response = ADMIN_INTENT_TO_ANSWER[adminIntent];
              context = { type: "qa", answer: response, audience: "admin", adminIntent: adminIntent, source: "hardcoded_intent" };
              console.log(`✅ Using admin intent answer: ${adminIntent}`);
              return res.json({
                response,
                sessionId,
                context: {
                  ...context,
                  language: detectedLanguage,
                  intent: intent
                }
              });
            } else {
              // Final fallback: use admin_knowledge as generic admin answer
              console.log(`⚠️  Admin user but no intent matched, using generic admin_knowledge answer`);
              response = ADMIN_INTENT_TO_ANSWER["admin_knowledge"];
              context = { type: "qa", answer: response, audience: "admin", adminIntent: "admin_knowledge", source: "hardcoded_final" };
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
        }

        // Detect HR intent for employees (leave policy, payroll, etc.)
        // CRITICAL: HR queries MUST return an answer - never fall through to generic handlers
        // Also check if query contains HR keywords (fallback for token decode failures)
        if (userRole === "employee" || hasHRKeywordsInQuery) {
          // If token decode failed but query has HR keywords, treat as employee
          if (userRole !== "employee" && hasHRKeywordsInQuery) {
            console.log(`⚠️  Token decode failed but HR keywords detected. Treating as employee query.`);
            userRole = "employee"; // Override role for this query
          }
          const hrIntent = detectHRIntent(normalizedMessage);
          
          // Debug logging for HR queries
          console.log(`🔍 HR query detected - Role: ${userRole}, Intent: ${hrIntent}, Query: "${message.substring(0, 50)}"`);
          
          // First try hardcoded HR answers (fast path, works even without MongoDB)
          if (hrIntent && HR_INTENT_TO_ANSWER[hrIntent]) {
            console.log(`✅ Using hardcoded HR answer for intent: ${hrIntent}`);
            context = { type: "qa", answer: HR_INTENT_TO_ANSWER[hrIntent], audience: "employee", hrIntent };
            response = HR_INTENT_TO_ANSWER[hrIntent];
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
          
          // If hardcoded answer not found, try MongoDB CSV search for HR queries
          // Check for HR-related keywords even if intent detection didn't match
          const hasHRKeywords = hrIntent || 
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
            // Try exact match in MongoDB for employee audience
            let qaPair = await QAPair.findOne({ 
              normalizedQuestion: normalizedMessage,
              audience: { $in: ["employee", "public"] }
            });
            
            // If not found, try hash-based match
            if (!qaPair) {
              const questionHash = generateQuestionHash(normalizedMessage);
              qaPair = await QAPair.findOne({ 
                questionHash: questionHash,
                audience: { $in: ["employee", "public"] }
              });
            }
            
            // If still not found, try partial match on question text
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
              context = { type: "qa", answer: qaPair.answer, audience: "employee", source: "mongodb" };
              response = qaPair.answer;
              return res.json({
                response,
                sessionId,
                context: {
                  ...context,
                  language: detectedLanguage,
                  intent: intent
                }
              });
            } else {
              console.log(`⚠️  No MongoDB match found for HR query, but HR keywords detected. Using hardcoded fallback.`);
              // If we detected HR keywords but no MongoDB match, use hardcoded answer based on intent
              if (hrIntent && HR_INTENT_TO_ANSWER[hrIntent]) {
                response = HR_INTENT_TO_ANSWER[hrIntent];
                context = { type: "qa", answer: response, audience: "employee", hrIntent: hrIntent, source: "hardcoded_fallback" };
                console.log(`✅ Using hardcoded fallback for HR intent: ${hrIntent}`);
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
              
              // If no specific intent but HR keywords detected, try to infer intent from keywords
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
                response = HR_INTENT_TO_ANSWER[fallbackIntent];
                context = { type: "qa", answer: response, audience: "employee", hrIntent: fallbackIntent, source: "hardcoded_fallback" };
                console.log(`✅ Using hardcoded fallback for HR intent: ${fallbackIntent}`);
                return res.json({
                  response,
                  sessionId,
                  context: {
                    ...context,
                    language: detectedLanguage,
                    intent: intent
                  }
                });
              } else {
                // Last resort: use hr_helpdesk as generic HR answer
                console.log(`⚠️  No specific HR intent matched, using generic hr_helpdesk answer`);
                response = HR_INTENT_TO_ANSWER["hr_helpdesk"];
                context = { type: "qa", answer: response, audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_generic" };
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
          } else {
            // Even if no HR keywords detected but user is employee, try to provide helpful response
            console.log(`⚠️  Employee user but no HR keywords detected. Query: "${normalizedMessage}"`);
            // Still try to match HR intent even without explicit keywords
            if (hrIntent && HR_INTENT_TO_ANSWER[hrIntent]) {
              response = HR_INTENT_TO_ANSWER[hrIntent];
              context = { type: "qa", answer: response, audience: "employee", hrIntent: hrIntent, source: "hardcoded_intent" };
              console.log(`✅ Using HR intent answer: ${hrIntent}`);
              return res.json({
                response,
                sessionId,
                context: {
                  ...context,
                  language: detectedLanguage,
                  intent: intent
                }
              });
            } else {
              // Final fallback: use hr_helpdesk as generic HR answer
              console.log(`⚠️  Employee user but no intent matched, using generic hr_helpdesk answer`);
              response = HR_INTENT_TO_ANSWER["hr_helpdesk"];
              context = { type: "qa", answer: response, audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_final" };
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
        }

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
        
        // Determine audience filter based on user role
        let audienceFilter;
        if (userRole === "admin") {
          audienceFilter = { $in: ["admin", "public"] };
        } else if (userRole === "employee") {
          audienceFilter = { $in: ["public", "employee"] };
        } else {
          audienceFilter = "public";
        }
        
        // Try exact match first (on canonical normalized question)
        let qaPair = await QAPair.findOne({ 
          normalizedQuestion: normalizedQuestion,
          audience: audienceFilter
        });
        
        // If not found, try hash-based match
        if (!qaPair) {
          qaPair = await QAPair.findOne({ 
            questionHash: questionHash,
            audience: audienceFilter
          });
        }
        
        // For admin, also try matching original question text (not just normalized)
        if (!qaPair && userRole === "admin") {
          qaPair = await QAPair.findOne({
            $or: [
              { question: { $regex: message.substring(0, 30), $options: "i" } },
              { question: { $regex: normalizedMessage.substring(0, 30), $options: "i" } }
            ],
            audience: { $in: ["admin", "public"] }
          });
        }
        
        // CRITICAL FIX: If exact match fails, try keyword-based fuzzy search in MongoDB
        // This handles cases where Pinecone fails (dimension mismatch) or question wording differs
        if (!qaPair) {
          console.log("⚠️  Exact match failed, trying keyword-based fuzzy search in MongoDB...");
          
          // Extract significant keywords from the query (words longer than 3 chars, excluding common words)
          const commonWords = ['the', 'are', 'is', 'was', 'were', 'what', 'who', 'when', 'where', 'how', 'why', 'can', 'could', 'should', 'would', 'do', 'does', 'did', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'about', 'into', 'onto', 'upon', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'this', 'that', 'these', 'those'];
          let words = normalizedMessage.split(/\s+/).filter(w => w.length > 3 && !commonWords.includes(w.toLowerCase()));
          
          // CRITICAL: Expand synonyms for better matching (SAME LOGIC AS FALLBACK)
          // Map synonyms to their canonical forms for founder-related queries
          const synonymMap = {
            'started': ['founder', 'founded', 'established', 'created', 'began'],
            'founded': ['founder', 'director', 'established', 'created'],
            'established': ['founder', 'founded', 'director', 'created'],
            'created': ['founder', 'founded', 'established'],
            'began': ['founder', 'founded', 'started'],
            'incorporated': ['founder', 'founded', 'established'],
            'director': ['founder', 'directors'],
            'directors': ['founder', 'director'],
            'founder': ['director', 'directors'],
            'founders': ['founder', 'director', 'directors'],
          };
          
          // Expand words with synonyms
          const expandedWords = [...words];
          words.forEach(word => {
            const lowerWord = word.toLowerCase();
            if (synonymMap[lowerWord]) {
              expandedWords.push(...synonymMap[lowerWord]);
            }
            // Also check if word contains synonym keys (for typos like "mobiloiite")
            Object.keys(synonymMap).forEach(synonym => {
              if (lowerWord.includes(synonym) || synonym.includes(lowerWord)) {
                expandedWords.push(...synonymMap[synonym]);
              }
            });
          });
          
          // CRITICAL: Handle company name typos (mobiloitte, mobiloiite, etc.)
          // Normalize variations of "mobiloitte" to ensure matching
          const companyNameVariations = ['mobiloitte', 'mobiloiite', 'mobiloite', 'mobiloit'];
          words.forEach(word => {
            const lowerWord = word.toLowerCase();
            companyNameVariations.forEach(variation => {
              // Check if word is similar to company name (fuzzy match for typos)
              if (lowerWord.includes('mobilo') || lowerWord.includes('mobiloi')) {
                expandedWords.push('mobiloitte'); // Always search for canonical form
              }
            });
          });
          
          // Handle pluralization: add both singular and plural forms
          expandedWords.forEach(word => {
            if (word.endsWith('r') && !word.endsWith('er') && !word.endsWith('or')) {
              expandedWords.push(word + 's'); // founder -> founders
            } else if (word.endsWith('er') || word.endsWith('or')) {
              expandedWords.push(word + 's'); // director -> directors, founder -> founders
            } else if (word.endsWith('y')) {
              expandedWords.push(word.slice(0, -1) + 'ies'); // company -> companies
            } else if (!word.endsWith('s')) {
              expandedWords.push(word + 's'); // service -> services
            }
            // Add singular form if word is plural
            if (word.endsWith('ies')) {
              expandedWords.push(word.slice(0, -3) + 'y'); // companies -> company
            } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) {
              expandedWords.push(word.slice(0, -1)); // founders -> founder, directors -> director
            }
          });
          
          words = [...new Set(expandedWords)]; // Remove duplicates
          
          // CRITICAL: Check if founder keywords are present - prioritize founder Q&A
          const founderKeywords = ['founder', 'founders', 'director', 'directors', 'ceo', 'chairman', 'started', 'founded', 'established', 'created', 'began', 'incorporated'];
          const hasFounderKeyword = words.some(word => founderKeywords.includes(word.toLowerCase()));
          
          if (words.length > 0) {
            // PRIORITY 1: If founder keywords detected, search for founder Q&A FIRST
            if (hasFounderKeyword) {
              console.log("🔍 Founder keywords detected, prioritizing founder Q&A search...");
              const founderWords = words.filter(word => founderKeywords.includes(word.toLowerCase()));
              
              // Try matching founder keywords specifically
              const founderQueries = [];
              
              // Try matching all founder keywords together (most specific)
              if (founderWords.length > 1) {
                founderQueries.push({
                  $and: founderWords.map(word => ({
                    $or: [
                      { question: { $regex: word, $options: "i" } },
                      { normalizedQuestion: { $regex: word, $options: "i" } },
                      { tags: { $regex: word, $options: "i" } },
                      { category: { $regex: word, $options: "i" } }
                    ]
                  }))
                });
              }
              
              // Try matching individual founder keywords
              founderWords.forEach(word => {
                founderQueries.push({
                  $or: [
                    { question: { $regex: word, $options: "i" } },
                    { normalizedQuestion: { $regex: word, $options: "i" } },
                    { tags: { $regex: word, $options: "i" } },
                    { category: { $regex: word, $options: "i" } }
                  ]
                });
              });
              
              // Search for founder Q&A FIRST
              for (const query of founderQueries) {
                qaPair = await QAPair.findOne({
                  $and: [
                    query,
                    { audience: audienceFilter }
                  ]
                });
                
                if (qaPair) {
                  console.log(`✅ Found founder Q&A match via priority search: "${qaPair.question.substring(0, 60)}..."`);
                  break;
                }
              }
            }
            
            // PRIORITY 2: If no founder Q&A found (or no founder keywords), try general keyword search
            if (!qaPair) {
              // Try to find Q&A pairs that contain these keywords
              // Priority: Try matching multiple keywords first, then single keywords
              const keywordQueries = [];
              
              // Try matching all keywords together (most specific)
              if (words.length > 1) {
                keywordQueries.push({
                  $and: words.map(word => ({
                    $or: [
                      { question: { $regex: word, $options: "i" } },
                      { normalizedQuestion: { $regex: word, $options: "i" } },
                      { tags: { $regex: word, $options: "i" } }
                    ]
                  }))
                });
              }
              
              // Try matching individual keywords (broader match)
              words.forEach(word => {
                keywordQueries.push({
                  $or: [
                    { question: { $regex: word, $options: "i" } },
                    { normalizedQuestion: { $regex: word, $options: "i" } },
                    { tags: { $regex: word, $options: "i" } },
                    { category: { $regex: word, $options: "i" } }
                  ]
                });
              });
              
              // Search MongoDB with keyword queries
              for (const query of keywordQueries) {
                qaPair = await QAPair.findOne({
                  $and: [
                    query,
                    { audience: audienceFilter }
                  ]
                });
                
                if (qaPair) {
                  console.log(`✅ Found Q&A match via keyword search: "${qaPair.question.substring(0, 60)}..."`);
                  break;
                }
              }
            }
          }
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
            
            // CRITICAL FIX: Before falling back to document RAG, try MongoDB keyword search again
            // This ensures we find data even when Pinecone fails (dimension mismatch)
            console.log("⚠️  Pinecone search failed, trying MongoDB keyword search as fallback...");
            let fallbackQAPair = null;
            
            // Extract significant keywords
            const commonWords = ['the', 'are', 'is', 'was', 'were', 'what', 'who', 'when', 'where', 'how', 'why', 'can', 'could', 'should', 'would', 'do', 'does', 'did', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'about', 'into', 'onto', 'upon', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'this', 'that', 'these', 'those'];
            let words = normalizedMessage.split(/\s+/).filter(w => w.length > 3 && !commonWords.includes(w.toLowerCase()));
          
            // CRITICAL: Expand synonyms for better matching
            // Map synonyms to their canonical forms for founder-related queries
            const synonymMap = {
              'started': ['founder', 'founded', 'established', 'created', 'began'],
              'founded': ['founder', 'director', 'established', 'created'],
              'established': ['founder', 'founded', 'director', 'created'],
              'created': ['founder', 'founded', 'established'],
              'began': ['founder', 'founded', 'started'],
              'incorporated': ['founder', 'founded', 'established'],
              'director': ['founder', 'directors'],
              'directors': ['founder', 'director'],
              'founder': ['director', 'directors'],
              'founders': ['founder', 'director', 'directors'],
            };
            
            // Expand words with synonyms
            const expandedWords = [...words];
            words.forEach(word => {
              const lowerWord = word.toLowerCase();
              if (synonymMap[lowerWord]) {
                expandedWords.push(...synonymMap[lowerWord]);
              }
              // Also check if word contains synonym keys (for typos like "mobiloiite")
              Object.keys(synonymMap).forEach(synonym => {
                if (lowerWord.includes(synonym) || synonym.includes(lowerWord)) {
                  expandedWords.push(...synonymMap[synonym]);
                }
              });
            });
            
            // CRITICAL: Handle company name typos (mobiloitte, mobiloiite, etc.)
            // Normalize variations of "mobiloitte" to ensure matching
            const companyNameVariations = ['mobiloitte', 'mobiloiite', 'mobiloite', 'mobiloit'];
            words.forEach(word => {
              const lowerWord = word.toLowerCase();
              companyNameVariations.forEach(variation => {
                // Check if word is similar to company name (fuzzy match for typos)
                if (lowerWord.includes('mobilo') || lowerWord.includes('mobiloi')) {
                  expandedWords.push('mobiloitte'); // Always search for canonical form
                }
              });
            });
            
            // Handle pluralization: add both singular and plural forms
            expandedWords.forEach(word => {
              if (word.endsWith('r') && !word.endsWith('er') && !word.endsWith('or')) {
                expandedWords.push(word + 's'); // founder -> founders
              } else if (word.endsWith('er') || word.endsWith('or')) {
                expandedWords.push(word + 's'); // director -> directors, founder -> founders
              } else if (word.endsWith('y')) {
                expandedWords.push(word.slice(0, -1) + 'ies'); // company -> companies
              } else if (!word.endsWith('s')) {
                expandedWords.push(word + 's'); // service -> services
              }
              // Add singular form if word is plural
              if (word.endsWith('ies')) {
                expandedWords.push(word.slice(0, -3) + 'y'); // companies -> company
              } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) {
                expandedWords.push(word.slice(0, -1)); // founders -> founder, directors -> director
              }
            });
            
            words = [...new Set(expandedWords)]; // Remove duplicates
            
            // CRITICAL: Check if founder keywords are present - prioritize founder Q&A
            const founderKeywords = ['founder', 'founders', 'director', 'directors', 'ceo', 'chairman', 'started', 'founded', 'established', 'created', 'began', 'incorporated'];
            const hasFounderKeyword = words.some(word => founderKeywords.includes(word.toLowerCase()));
            
            if (words.length > 0) {
              // PRIORITY 1: If founder keywords detected, search for founder Q&A FIRST
              if (hasFounderKeyword) {
                console.log("🔍 Founder keywords detected in fallback, prioritizing founder Q&A search...");
                const founderWords = words.filter(word => founderKeywords.includes(word.toLowerCase()));
                
                // Try matching founder keywords specifically
                const founderQuery = {
                  $or: founderWords.map(word => ({
                    $or: [
                      { question: { $regex: word, $options: "i" } },
                      { normalizedQuestion: { $regex: word, $options: "i" } },
                      { tags: { $regex: word, $options: "i" } },
                      { category: { $regex: word, $options: "i" } }
                    ]
                  }))
                };
                
                fallbackQAPair = await QAPair.findOne({
                  $and: [
                    founderQuery,
                    { audience: audienceFilter }
                  ]
                });
                
                if (fallbackQAPair) {
                  console.log(`✅ Found founder Q&A via MongoDB keyword fallback: "${fallbackQAPair.question.substring(0, 60)}..."`);
                  context = { type: "qa", answer: fallbackQAPair.answer, source: "mongodb_keyword_fallback_founder" };
                  response = fallbackQAPair.answer;
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
              
              // PRIORITY 2: If no founder Q&A found (or no founder keywords), try general keyword search
              if (!fallbackQAPair) {
                // Try matching keywords in question, normalizedQuestion, tags, or category
                const keywordQuery = {
                  $or: words.map(word => ({
                    $or: [
                      { question: { $regex: word, $options: "i" } },
                      { normalizedQuestion: { $regex: word, $options: "i" } },
                      { tags: { $regex: word, $options: "i" } },
                      { category: { $regex: word, $options: "i" } }
                    ]
                  }))
                };
                
                fallbackQAPair = await QAPair.findOne({
                  $and: [
                    keywordQuery,
                    { audience: audienceFilter }
                  ]
                });
                
                if (fallbackQAPair) {
                  console.log(`✅ Found Q&A via MongoDB keyword fallback: "${fallbackQAPair.question.substring(0, 60)}..."`);
                  context = { type: "qa", answer: fallbackQAPair.answer, source: "mongodb_keyword_fallback" };
                  response = fallbackQAPair.answer;
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
            }
            
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
              // No relevant data found anywhere
              // SPECIAL CASE: If admin user, provide admin-specific fallback
              if (userRole === "admin") {
                console.log(`⚠️  Admin query fell through to generic fallback. Query: "${message.substring(0, 50)}"`);
                // Try one more time to detect admin intent from original message
                const finalAdminIntent = detectAdminIntent(normalizeText(message));
                if (finalAdminIntent && ADMIN_INTENT_TO_ANSWER[finalAdminIntent]) {
                  response = ADMIN_INTENT_TO_ANSWER[finalAdminIntent];
                  context = { type: "qa", answer: response, audience: "admin", adminIntent: finalAdminIntent, source: "hardcoded_final_fallback" };
                  console.log(`✅ Using final admin fallback: ${finalAdminIntent}`);
                } else {
                  // Last resort: generic admin knowledge answer
                  response = ADMIN_INTENT_TO_ANSWER["admin_knowledge"];
                  context = { type: "qa", answer: response, audience: "admin", adminIntent: "admin_knowledge", source: "hardcoded_last_resort" };
                  console.log(`✅ Using last resort admin answer`);
                }
              } else if (userRole === "employee") {
                // SPECIAL CASE: If employee user, provide HR-specific fallback
                console.log(`⚠️  Employee query fell through to generic fallback. Query: "${message.substring(0, 50)}"`);
                // Try one more time to detect HR intent from original message
                const finalHRIntent = detectHRIntent(normalizeText(message));
                if (finalHRIntent && HR_INTENT_TO_ANSWER[finalHRIntent]) {
                  response = HR_INTENT_TO_ANSWER[finalHRIntent];
                  context = { type: "qa", answer: response, audience: "employee", hrIntent: finalHRIntent, source: "hardcoded_final_fallback" };
                  console.log(`✅ Using final HR fallback: ${finalHRIntent}`);
                } else {
                  // Last resort: generic HR helpdesk answer
                  response = HR_INTENT_TO_ANSWER["hr_helpdesk"];
                  context = { type: "qa", answer: response, audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_last_resort" };
                  console.log(`✅ Using last resort HR answer`);
                }
              } else {
                // Non-admin, non-employee users get generic fallback
                response =
                  "I couldn't find relevant information for this query. " +
                  "Please ask about Mobiloitte's services, solutions, or processes.";
                context = { type: "no_data_found" };
              }
            }
          }
        }
        break;
        
      case "document_rag":
      default:
        // Document RAG search (PRD: query Pinecone with metadata filter)
        let namespace = "public_docs";
        if (userRole === "admin") {
          namespace = "employee_docs"; // Admin can access employee docs too
        } else if (userRole === "employee") {
          namespace = "employee_docs";
        }
        const chunks = await searchDocuments(message, userRole, namespace);
        
        // Only use chunks if we have good matches (score > 0.5)
        const goodChunks = chunks && chunks.length > 0 && chunks[0].score > 0.5 
          ? chunks.filter(chunk => chunk.score > 0.5)
          : [];
        
        if (goodChunks.length > 0) {
          // Found relevant document chunks - use them
          context = { type: "document", chunks: goodChunks };
          response = await generateLLMResponse(message, context, userRole);
        } else {
          // No relevant data found
          // SPECIAL CASE: If employee user, provide HR-specific fallback
          if (userRole === "employee") {
            console.log(`⚠️  Employee query fell through document_rag fallback. Query: "${message.substring(0, 50)}"`);
            const finalHRIntent = detectHRIntent(normalizeText(message));
            if (finalHRIntent && HR_INTENT_TO_ANSWER[finalHRIntent]) {
              response = HR_INTENT_TO_ANSWER[finalHRIntent];
              context = { type: "qa", answer: response, audience: "employee", hrIntent: finalHRIntent, source: "hardcoded_document_fallback" };
              console.log(`✅ Using HR fallback from document_rag: ${finalHRIntent}`);
            } else {
              // Last resort: generic HR helpdesk answer
              response = HR_INTENT_TO_ANSWER["hr_helpdesk"];
              context = { type: "qa", answer: response, audience: "employee", hrIntent: "hr_helpdesk", source: "hardcoded_document_last_resort" };
              console.log(`✅ Using last resort HR answer from document_rag`);
            }
          } else {
            // Non-employee users get generic fallback
            response = "I couldn't find this information in our knowledge base. Could you rephrase your question or ask about Mobiloitte's services, AI solutions, or company information?";
            context = { type: "no_data_found" };
          }
        }
        break;
    }
    
    // Step 8: Return response with metadata
    return res.json({
      response,
      sessionId,
      context: {
        ...context,
        language: detectedLanguage, // Include detected language for analytics
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