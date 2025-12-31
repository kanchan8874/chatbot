/**
 * Text Validation Utilities
 * Handles gibberish detection, profanity checking, language detection
 */

const gibberishDetector = require("gibberish-detector");

// franc and bad-words are ES Modules, so we'll use dynamic import when needed
let francModule = null;
let badWordsModule = null;
let allProfanityModule = null;
let profanityHindiModule = null;

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
      // bad-words v4.0.0 exports Filter as named export
      if (!badWordsModule.Filter && !badWordsModule.default) {
        console.warn("⚠️  bad-words module structure unexpected");
      }
    } catch (error) {
      console.warn("⚠️  Failed to load bad-words module:", error.message);
      return null;
    }
  }
  return badWordsModule;
}

/**
 * Load allprofanity package (supports Hindi + Hinglish profanity detection)
 * This is a specialized library for Hindi/English profanity
 * NOTE: allprofanity is an ES Module, so we use dynamic import()
 */
async function loadAllProfanity() {
  if (!allProfanityModule) {
    try {
      allProfanityModule = await import("allprofanity");
    } catch (error) {
      console.warn("⚠️  allprofanity package not installed or failed to load. Run: npm install allprofanity");
      return null;
    }
  }
  return allProfanityModule;
}

/**
 * Load profanity-hindi package (alternative Hindi profanity detector)
 */
async function loadProfanityHindi() {
  if (!profanityHindiModule) {
    try {
      profanityHindiModule = require("profanity-hindi");
    } catch (error) {
      // This is optional, so we don't warn if it's not installed
      return null;
    }
  }
  return profanityHindiModule;
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


async function containsProfanity(text) {
  if (!text || text.trim().length === 0) return false;
  
  // STEP 1: Check with bad-words FIRST (English profanity - already installed, most reliable)
  // This should catch "fuck you" and other English profanity immediately
  try {
    const badWords = await loadBadWords();
    if (badWords) {
      // bad-words v4.0.0 exports Filter as named export, not default
      const Filter = badWords.Filter || badWords.default;
      if (Filter) {
        const profanityFilter = new Filter();
        if (profanityFilter.isProfane(text)) {
          console.log(`🚫 Profanity detected via bad-words: "${text.substring(0, 50)}..."`);
          return true;
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  bad-words check failed: ${error.message}`);
  }
  
  // STEP 2: Check with allprofanity (Hindi + Hinglish support)
  try {
    const allProfanity = await loadAllProfanity();
    if (allProfanity) {
      // allprofanity exports AllProfanity class as default
      // API: allProfanity.default.filter.check(text) or allProfanity.AllProfanity.filter.check(text)
      const AllProfanityClass = allProfanity.default || allProfanity.AllProfanity;
      
      if (AllProfanityClass && AllProfanityClass.filter && typeof AllProfanityClass.filter.check === 'function') {
        const isProfane = AllProfanityClass.filter.check(text);
        if (isProfane) {
          console.log(`🚫 Profanity detected via allprofanity: "${text.substring(0, 50)}..."`);
          return true;
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  allprofanity check failed: ${error.message}`);
  }
  
  // STEP 3: Check with profanity-hindi (alternative Hindi detector)
  // NOTE: profanity-hindi uses isMessageDirty() method
  try {
    const profanityHindi = await loadProfanityHindi();
    if (profanityHindi && typeof profanityHindi.isMessageDirty === 'function') {
      const isProfane = profanityHindi.isMessageDirty(text);
      if (isProfane) {
        console.log(`🚫 Profanity detected via profanity-hindi: "${text.substring(0, 50)}..."`);
        return true;
      }
    }
  } catch (error) {
    console.warn(`⚠️  profanity-hindi check failed: ${error.message}`);
  }
  

  
  return false;
}

module.exports = {
  isGibberish,
  detectLanguage,
  containsProfanity
};
