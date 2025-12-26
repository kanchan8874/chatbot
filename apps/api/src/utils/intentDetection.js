/**
 * Intent Detection Utilities
 * Handles intent classification and role-specific intent detection
 */

const { normalizeText } = require('./textProcessing');

// Map high-level topic intents to canonical CSV questions
const INTENT_TO_CANONICAL_QUESTION = {
  services_overview: "what services does mobiloitte provide?",
  ai_solutions: "what are traditional ai solutions?",
  traditional_ai: "what are traditional ai solutions?",
  blockchain_solutions: "how does mobiloitte use ai for blockchain?",
  web_mobile_ai: "what ai services are available for web and mobile apps?",
  industries: "what industries does mobiloitte serve?",
  experience: "how many years of experience does mobiloitte have?",
  technologies: "what technologies does mobiloitte use for ai?",
  contact: "how can i contact mobiloitte?",
};

// HR-specific curated answers
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

// Admin-specific curated answers
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

/**
 * Detect fine-grained topic intent inside CSV Q&A domain
 */
function detectTopicIntent(normalizedMessage) {
  if (!normalizedMessage) return null;
  const text = normalizedMessage;

  // PRIORITY 1: Services overview
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
    text.includes("portfolio") ||
    text.includes("core services") ||
    text.includes("main offerings") ||
    text.includes("type of services") ||
    text.includes("kind of services")
  ) {
    if (text.includes("technology") && !text.includes("service") && !text.includes("solution")) {
      return "technologies";
    }
    return "services_overview";
  }

  // PRIORITY 2: Traditional AI
  if (
    text.includes("traditional ai") ||
    text.includes("traditional ai solution") ||
    text.includes("traditional ai solutions")
  ) {
    return "traditional_ai";
  }

  // PRIORITY 3: General AI solutions
  if (
    (text.includes("ai solution") ||
    text.includes("ai solutions") ||
    text.includes("ai offering") ||
    text.includes("ai offerings")) &&
    !text.includes("service")
  ) {
    return "ai_solutions";
  }

  // PRIORITY 4: Other specific intents
  if (text.includes("blockchain")) return "blockchain_solutions";
  if (text.includes("web") && text.includes("mobile")) return "web_mobile_ai";
  
  if (
    (text.includes("technology") || text.includes("technologies") || text.includes("tools")) &&
    !text.includes("service") &&
    !text.includes("solution")
  ) {
    return "technologies";
  }
  
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

/**
 * Detect HR-specific intents for employee role
 */
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

/**
 * Detect Admin-specific intents
 */
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

  if (
    (text.includes("performance") && text.includes("metrics")) ||
    (text.includes("performance") && text.includes("kpi")) ||
    text.includes("kpis") ||
    text.includes("performance dashboard")
  ) {
    return "admin_performance";
  }

  if (
    text.includes("security") ||
    text.includes("access control") ||
    text.includes("authentication") ||
    text.includes("rbac") ||
    text.includes("permissions")
  ) {
    return "admin_security";
  }

  return null;
}

/**
 * Check if query is out-of-scope (not related to Mobiloitte)
 */
function isOutOfScope(normalizedMessage) {
  if (!normalizedMessage) return false;
  
  const text = normalizedMessage.toLowerCase();
  
  // Out-of-scope keywords (not related to Mobiloitte)
  const outOfScopeKeywords = [
    "weather", "temperature", "rain", "snow", "forecast",
    "recipe", "cooking", "how to cook", "how to make",
    "joke", "funny", "humor", "tell me a joke",
    "sports", "football", "cricket", "match", "score",
    "movie", "film", "actor", "actress", "cinema",
    "music", "song", "singer", "album",
    "news", "politics", "election", "government",
    "stock", "share", "market", "trading",
    "game", "play", "gaming", "video game"
  ];
  
  // Check if query contains out-of-scope keywords
  const hasOutOfScopeKeyword = outOfScopeKeywords.some(keyword => text.includes(keyword));
  
  // BUT: If query also contains Mobiloitte-related keywords, it's NOT out of scope
  const mobiloitteKeywords = [
    "mobiloitte", "company", "service", "solution", "ai", "blockchain",
    "technology", "employee", "hr", "leave", "payroll"
  ];
  
  const hasMobiloitteKeyword = mobiloitteKeywords.some(keyword => text.includes(keyword));
  
  // If it has out-of-scope keywords BUT also has Mobiloitte keywords, it's in scope
  if (hasOutOfScopeKeyword && hasMobiloitteKeyword) {
    return false;
  }
  
  return hasOutOfScopeKeyword;
}

/**
 * Classify intent for informational queries
 */
function classifyIntent(message, userRole) {
  const lowerMessage = message.toLowerCase();
  
  // Admin queries - prioritize CSV Q&A
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
        return "csv_qa";
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
  
  // General FAQ queries
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
  
  // Document/RAG queries
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
  
  // Founder/director keywords - highest priority
  const founderKeywords = [
    "founder", "founders", "director", "directors", "ceo", "chairman", "leadership",
    "started", "founded", "established", "created", "began", "incorporated"
  ];
  
  const hasFounderKeyword = founderKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (hasFounderKeyword) {
    return "csv_qa";
  }
  
  const topicKeywords = [
    "traditional ai", "ai solutions", "ai services", "generative ai",
    "blockchain", "services", "mobiloitte", "company", "technologies",
    "industries", "experience", "contact", "about mobiloitte", "about company"
  ];
  
  const hasTopicKeyword = topicKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // "Tell me about" queries with topic keywords should go to CSV Q&A
  if (
    (lowerMessage.includes("tell me about") || lowerMessage.includes("tell me")) &&
    hasTopicKeyword
  ) {
    return "csv_qa";
  }
  
  // Decision logic
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
  
  // Default to CSV Q&A first
  return "csv_qa";
}

module.exports = {
  INTENT_TO_CANONICAL_QUESTION,
  HR_INTENT_TO_ANSWER,
  ADMIN_INTENT_TO_ANSWER,
  detectTopicIntent,
  detectHRIntent,
  detectAdminIntent,
  isOutOfScope,
  classifyIntent
};

/**
 * Detect specific fact queries (founder, HQ, address, establishment year, CEO, contact)
 */
function isSpecificFactQuery(normalizedMessage) {
  const text = (normalizedMessage || "").toLowerCase();
  const factKeywords = [
    "founder",
    "cofounder",
    "co-founder",
    "ceo",
    "director",
    "chairman",
    "leadership",
    "head office",
    "headquarter",
    "hq",
    "office address",
    "address",
    "location",
    "where is",
    "based in",
    "located",
    "established",
    "founded",
    "establishment year",
    "established in",
    "since",
    "contact",
    "phone",
    "email",
    "website"
  ];

  return factKeywords.some((kw) => text.includes(kw));
}

module.exports.isSpecificFactQuery = isSpecificFactQuery;
