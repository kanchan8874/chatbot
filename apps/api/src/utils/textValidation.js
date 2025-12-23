/**
 * Text Validation Utilities
 * Handles gibberish detection, profanity checking, language detection
 */

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
 */
function isGibberish(text, userRole = "client") {
  if (!text) return true;

  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Very short text (1-2 chars)
  if (trimmed.length < 3) {
    const commonShortWords = ["hi", "ok", "no", "yes", "ok", "a", "i"];
    if (commonShortWords.includes(trimmed.toLowerCase())) {
      return false;
    }
    const alphaChars = trimmed.match(/[a-zA-Z]/g);
    if (!alphaChars || alphaChars.length < trimmed.length * 0.5) {
      return true;
    }
  }

  const lowerText = trimmed.toLowerCase();
  
  // WHITELIST: Check for legitimate question patterns
  const legitimateQuestionPatterns = [
    /^(how|what|when|where|why|who|which|whom|can|could|should|would|do|does|did|is|are|was|were|will|tell|explain|describe|share|show)\s+/i,
    /^(what\s+is|what\s+are|how\s+does|how\s+do|how\s+can|how\s+to|tell\s+me|explain|describe)/i,
    /^(who|what|which|whom)\s+(is|are|was|were|did|does|do)/i,
  ];
  
  const hasQuestionPattern = legitimateQuestionPatterns.some(pattern => pattern.test(trimmed));
  
  // WHITELIST: Professional keywords
  const professionalKeywords = [
    "leave", "attendance", "payroll", "salary", "holiday", "hr", "employee", "benefits",
    "policy", "procedure", "process", "appraisal", "onboarding", "resignation", "exit",
    "casual", "sick", "earned", "privilege", "maternity", "paternity", "compensatory",
    "working hours", "shift", "work from home", "wfh", "hybrid", "flexible",
    "payslip", "ctc", "pf", "esi", "tds", "deduction", "allowance", "hra",
    "holiday calendar", "weekly off", "helpdesk", "people partner",
    "service", "solution", "company", "mobiloitte", "client", "project", "team",
    "technology", "ai", "blockchain", "development", "integration",
    "founder", "founders", "director", "directors", "ceo", "chairman", "leadership",
    "started", "founded", "established", "created", "began", "incorporated",
  ];
  
  const hasProfessionalKeyword = professionalKeywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (hasQuestionPattern || hasProfessionalKeyword) {
    return false;
  }

  // Basic gibberish checks
  const alphaRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
  if (alphaRatio < 0.5) return true;

  // Check for random character patterns
  if (!hasProfessionalKeyword) {
    const hasSpace = /\s/.test(trimmed);
    if (!hasSpace && trimmed.length > 5) {
      const vowels = trimmed.match(/[aeiouAEIOU]/g) || [];
      const consonants = trimmed.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || [];
      if (vowels.length === 0 || consonants.length / vowels.length > 5) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect language of the input text using franc library
 */
async function detectLanguage(text) {
  if (!text || text.trim().length === 0) return 'und';
  
  try {
    if (text.trim().length < 3) return 'und';
    
    const franc = await loadFranc();
    if (!franc || !franc.default) {
      return 'und';
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
 */
async function containsProfanity(text) {
  if (!text || text.trim().length === 0) return false;
  
  try {
    const badWords = await loadBadWords();
    if (!badWords || !badWords.default) {
      const commonProfanity = ['damn', 'hell'];
      const lowerText = text.toLowerCase();
      return commonProfanity.some(word => lowerText.includes(word));
    }
    
    const Filter = badWords.default;
    const profanityFilter = new Filter();
    return profanityFilter.isProfane(text);
  } catch (error) {
    console.warn(`⚠️  Profanity filter error: ${error.message}`);
    const commonProfanity = ['damn', 'hell'];
    const lowerText = text.toLowerCase();
    return commonProfanity.some(word => lowerText.includes(word));
  }
}

module.exports = {
  isGibberish,
  detectLanguage,
  containsProfanity
};
