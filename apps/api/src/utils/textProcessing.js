/**
 * Text Processing Utilities
 * Handles text normalization, validation, and processing
 */

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

// Check lexical overlap between user query and candidate CSV question
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

  // Get expanded tokens for multilingual matching
  const queryTokens = new Set(getExpandedTokens(query));
  const candidateTokens = new Set(getExpandedTokens(candidateQuestion));

  if (queryTokens.size === 0 || candidateTokens.size === 0) return false;

  let overlapCount = 0;
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) {
      overlapCount++;
    }
  }

  return overlapCount > 0;
}

// Get expanded tokens for multilingual matching
function getExpandedTokens(text) {
  if (!text) return [];
  
  // Normalize and strip punctuation, then split into tokens
  const originalTokens = normalizeText(text)
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Strip punctuation
    .split(/\s+/)
    .filter(t => t);
    
  const allTokens = new Set(originalTokens);
  
  // Add synonyms for each token
  originalTokens.forEach(token => {
    // Check direct match
    if (translationMap[token]) {
      translationMap[token].forEach(synonym => allTokens.add(synonym));
    }
    
    // Check for possessive 's or common typos if not matched
    const baseWord = token.replace(/'s$/, "");
    if (translationMap[baseWord]) {
      translationMap[baseWord].forEach(synonym => allTokens.add(synonym));
    }
  });
  
  return Array.from(allTokens);
}

// Hindi/English translation mappings for common business terms
const translationMap = {
  // Mobiloitte related (including typos)
  mobiloitte: ['mobiloitte', 'mobiloite', 'mobilo', 'company'],
  mobiloite: ['mobiloitte', 'mobiloite', 'mobilo', 'company'],
  mobilo: ['mobiloitte', 'mobiloite', 'mobilo', 'company'],

  // Services related
  services: ['service', 'services', 'provide', 'offering', 'offerings'],
  service: ['service', 'services', 'provide', 'offering', 'offerings'],
  offering: ['service', 'services', 'provide', 'offering', 'offerings'],
  offerings: ['service', 'services', 'provide', 'offering', 'offerings'],

  // Information related
  information: ['information', 'info', 'details', 'detail', 'data'],
  info: ['information', 'info', 'details', 'detail', 'data'],
  details: ['information', 'info', 'details', 'detail', 'data'],
  detail: ['information', 'info', 'details', 'detail', 'data'],

  // Company related
  company: ['company', 'organization', 'organisation', 'firm', 'business'],
  organization: ['company', 'organization', 'organisation', 'firm', 'business'],
  organisation: ['company', 'organization', 'organisation', 'firm', 'business'],
  firm: ['company', 'organization', 'organisation', 'firm', 'business'],
  business: ['company', 'organization', 'organisation', 'firm', 'business'],
  
  // Generic expansion
  what: ['what'],
  does: ['does', 'provide'],
  provide: ['provide', 'services', 'service'],
  job: ['job', 'work', 'career', 'opening', 'openings'],
  work: ['job', 'work', 'career'],
  career: ['job', 'work', 'career'],
  opening: ['opening', 'job', 'openings'],
  openings: ['opening', 'job', 'openings'],
  hq: ['hq', 'headquarters', 'location', 'office', 'address'],
  headquarters: ['hq', 'headquarters', 'location', 'office', 'address'],
  this: ['this']
};

module.exports = {
  normalizeText,
  generateQuestionHash,
  hasMeaningfulOverlap,
  getExpandedTokens
};
