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

// Hindi/English translation mappings for common business terms
const translationMap = {
  // Services related
  'services': ['service', 'services', 'seva', 'sevayen', 'kya', 'kya', 'kya', 'provide', 'provide', 'krta', 'karta', 'hai', 'hai'],
  'service': ['service', 'services', 'seva', 'sevayen', 'kya', 'kya', 'kya', 'provide', 'provide', 'krta', 'karta', 'hai', 'hai'],
  'seva': ['service', 'services', 'seva', 'sevayen', 'kya', 'kya', 'kya', 'provide', 'provide', 'krta', 'karta', 'hai', 'hai'],
  'sevayen': ['service', 'services', 'seva', 'sevayen', 'kya', 'kya', 'kya', 'provide', 'provide', 'krta', 'karta', 'hai', 'hai'],
  
  // What related
  'what': ['what', 'kya', 'kya', 'kya', 'kya'],
  'kya': ['what', 'kya', 'kya', 'kya', 'kya'],
  
  // Does related
  'does': ['does', 'krta', 'karta', 'hai', 'hai', 'provide'],
  'krta': ['does', 'krta', 'karta', 'hai', 'hai', 'provide'],
  'karta': ['does', 'krta', 'karta', 'hai', 'hai', 'provide'],
  'hai': ['does', 'krta', 'karta', 'hai', 'hai', 'provide'],
  
  // Provide related
  'provide': ['provide', 'provide', 'krta', 'karta', 'de', 'dena', 'services', 'seva'],
  'de': ['provide', 'provide', 'krta', 'karta', 'de', 'dena', 'services', 'seva'],
  'dena': ['provide', 'provide', 'krta', 'karta', 'de', 'dena', 'services', 'seva'],
  
  // Company related
  'company': ['company', 'company', 'firma', 'sangathan', 'organisation', 'organization'],
  'firma': ['company', 'company', 'firma', 'sangathan', 'organisation', 'organization'],
  'sangathan': ['company', 'company', 'firma', 'sangathan', 'organisation', 'organization'],
  
  // Mobiloitte related
  'mobiloitte': ['mobiloitte', 'mobilo', 'company', 'firma'],
  'mobilo': ['mobiloitte', 'mobilo', 'company', 'firma'],
  
  // Job related
  'job': ['job', 'naukri', 'kam', 'work'],
  'naukri': ['job', 'naukri', 'kam', 'work'],
  'kam': ['job', 'naukri', 'kam', 'work'],
  'work': ['job', 'naukri', 'kam', 'work'],
  
  // Available related
  'available': ['available', 'avilable', 'hai', 'mila', 'mil', 'milti'],
  'avilable': ['available', 'available', 'hai', 'mila', 'mil', 'milti'],
  'hai': ['available', 'avilable', 'hai', 'mila', 'mil', 'milti'],
  'mila': ['available', 'avilable', 'hai', 'mila', 'mil', 'milti'],
  'mil': ['available', 'avilable', 'hai', 'mila', 'mil', 'milti'],
  'milti': ['available', 'avilable', 'hai', 'mila', 'mil', 'milti'],
  
  // Opening related
  'opening': ['opening', 'khul', 'khuli', 'job', 'naukri'],
  'khul': ['opening', 'khul', 'khuli', 'job', 'naukri'],
  'khuli': ['opening', 'khul', 'khuli', 'job', 'naukri'],
  
  // This related
  'this': ['this', 'ye', 'yeh', 'yah', 'yahi'],
  'ye': ['this', 'ye', 'yeh', 'yah', 'yahi'],
  'yeh': ['this', 'ye', 'yeh', 'yah', 'yahi'],
  'yah': ['this', 'ye', 'yeh', 'yah', 'yahi'],
  'yahi': ['this', 'ye', 'yeh', 'yah', 'yahi'],
};

// Get expanded tokens for multilingual matching
function getExpandedTokens(text) {
  const originalTokens = normalizeText(text).split(" ");
  const allTokens = new Set(originalTokens);
  
  // Add synonyms for each token
  originalTokens.forEach(token => {
    if (translationMap[token]) {
      translationMap[token].forEach(synonym => {
        allTokens.add(synonym);
      });
    }
  });
  
  return Array.from(allTokens);
}

module.exports = {
  normalizeText,
  generateQuestionHash,
  hasMeaningfulOverlap,
  getExpandedTokens
};
