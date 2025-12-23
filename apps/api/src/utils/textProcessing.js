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

  const queryTokens = new Set(normalizeTokens(query));
  const candidateTokens = new Set(normalizeTokens(candidateQuestion));

  if (queryTokens.size === 0 || candidateTokens.size === 0) return false;

  let overlapCount = 0;
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) {
      overlapCount++;
    }
  }

  return overlapCount > 0;
}

module.exports = {
  normalizeText,
  generateQuestionHash,
  hasMeaningfulOverlap
};
