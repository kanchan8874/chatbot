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
 * Enhanced gibberish detection using word-level analysis, vowel ratios, entropy, and dictionary checks
 */
/**
 * Enhanced gibberish detection using word-level analysis, vowel ratios, entropy, and dictionary checks
 */
function isGibberish(text, userRole = "client") {
  if (!text) return true;

  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  const lowerText = trimmed.toLowerCase();
  
  // 1. QUESTION PATTERNS - Preliminary check for clear questions
  const legitimateQuestionPatterns = [
    /^(how|what|when|where|why|who|which|whom|can|could|should|would|do|does|did|is|are|was|were|will|tell|explain|describe|share|show|give|provide)\s+/i,
  ];
  if (legitimateQuestionPatterns.some(pattern => pattern.test(trimmed))) return false;

  // 2. PROFESSIONAL KEYWORDS - Whitelist for domain-specific terms
  const professionalKeywords = [
    "leave", "attendance", "payroll", "salary", "holiday", "hr", "employee", "benefits",
    "policy", "procedure", "process", "appraisal", "onboarding", "resignation", "exit",
    "casual", "sick", "earned", "privilege", "maternity", "paternity", "compensatory",
    "working hours", "shift", "work from home", "wfh", "hybrid", "flexible",
    "payslip", "ctc", "pf", "esi", "tds", "deduction", "allowance", "hra",
    "holiday calendar", "weekly off", "helpdesk", "people partner",
    "service", "services", "solution", "solutions", "company", "mobiloitte", "mobiloite", "client", "project", "team",
    "technology", "ai", "blockchain", "development", "integration",
    "founder", "founders", "director", "directors", "ceo", "chairman", "leadership",
    "started", "founded", "established", "created", "began", "incorporated",
    "training", "center", "cmad", "skill", "internship",
    "information", "info", "private", "limited", "pvt", "ltd"
  ];

  // 3. COMMON WORDS - Simplified dictionary hit check
  const commonWords = new Set([
     "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
     "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
     "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
     "people", "into", "year", "your", "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
     "back", "after", "use", "two", "how", "our", "work", "first", "well", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
     "hi", "hello", "hey", "hii", "please", "help", "world", "doing", "today", "thanks", "thank", "you"
  ]);

  const words = trimmed.split(/\s+/);
  let meaningfulCount = 0;
  let gibberishCount = 0;
  let totalValidTokens = 0;

  for (const word of words) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length === 0) continue; // Skip tokens that are only punctuation or numbers

    totalValidTokens++;

    // 1. Dictionary Match (Common + Professional)
    if (commonWords.has(w) || professionalKeywords.some(kw => w === kw)) {
      meaningfulCount++;
      continue;
    }

    // 2. Token-level heuristics for unknown words
    let isTokenGibberish = false;

    // A. Character Repetition (e.g., "aaaaa" or "bbbbb")
    if (/(.)\1{3,}/.test(w)) { // 4+ identical chars
      isTokenGibberish = true;
    }

    // B. Vowel Ratio (Strict)
    if (!isTokenGibberish) {
      const vowels = w.match(/[aeiouy]/gi) || [];
      const ratio = vowels.length / w.length;
      if (ratio < 0.2 || ratio > 0.8) { 
        isTokenGibberish = true;
      }
    }

    // C. Entropy (Randomness sensitivity)
    if (!isTokenGibberish && w.length > 4) {
      const charMap = {};
      for (const char of w) {
        charMap[char] = (charMap[char] || 0) + 1;
      }
      const entropy = Object.values(charMap).reduce((acc, count) => {
        const p = count / w.length;
        return acc - p * Math.log2(p);
      }, 0);

      // Entropy thresholds based on word length
      if (w.length > 7 && entropy > 3.0) isTokenGibberish = true;
      else if (w.length > 5 && entropy > 2.6) isTokenGibberish = true;
      else if (entropy > 2.3) isTokenGibberish = true;
    }

    if (isTokenGibberish) {
      gibberishCount++;
    } else {
      // Unknown but follows phonotactic-ish patterns
      meaningfulCount++;
    }
  }

  // If no alpha tokens, it's not gibberish (e.g., numbers, emojis, punctuation) - let downstream handle
  if (totalValidTokens === 0) return false;

  // MAJORITY RULE: If 50% or more of valid tokens are nonsensical, classify as gibberish
  const isFinalGibberish = gibberishCount >= (totalValidTokens * 0.5);
  
  if (isFinalGibberish) {
    console.log(`⚠️ Gibberish detected: ${gibberishCount}/${totalValidTokens} tokens failed validation. Input: "${text}"`);
  }

  return isFinalGibberish;
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

/**
 * Checks if the text is a meaningful inquiry/question for the chatbot
 * Returns false for fragments like "blue sky", "random text", or declarations that aren't questions
 */
function isMeaningfulInquiry(text) {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Question Patterns (How, What, Kya, etc.)
  const questionWords = [
    "how", "what", "when", "where", "why", "who", "which", "can", "could", "should", "would", 
    "do", "does", "did", "is", "are", "tell", "explain", "describe", "kaise", "kya", "kab", "kaha"
  ];
  const startsWithQuestion = questionWords.some(word => lower.startsWith(word + " "));
  const endsWithQuestionMark = trimmed.endsWith("?");
  
  if (startsWithQuestion || endsWithQuestionMark) return true;

  // 2. High-Value Professional Keywords (Even if not a formal question, it's an inquiry)
  const keyDomainTerms = [
    "mobiloitte", "service", "services", "ai", "blockchain", "training", "center", 
    "leave", "payroll", "salary", "contact", "address", "hq", "ceo", "founder", "hiring", "job"
  ];
  const hasDomainTerm = keyDomainTerms.some(term => lower.includes(term));
  if (hasDomainTerm) return true;

  // 3. Verb-based imperative requests (e.g. "Explain services", "Show location")
  const imperatives = ["explain", "show", "give", "share", "provide", "list"];
  if (imperatives.some(verb => lower.startsWith(verb + " "))) return true;

  // 4. Fragment check (Too short and no domain/question signal)
  const words = trimmed.split(/\s+/);
  if (words.length <= 3 && !hasDomainTerm && !startsWithQuestion) {
    return false;
  }

  // 5. If it contains at least one meaningful professional token from our expanded list in isGibberish, 
  // we give it the benefit of the doubt as a query. 
  // Otherwise, if it's just common words like "the blue sky" or "today is nice", it fails.
  return hasDomainTerm; 
}

module.exports = {
  isGibberish,
  isMeaningfulInquiry,
  detectLanguage,
  containsProfanity
};
