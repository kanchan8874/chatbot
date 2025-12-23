/**
 * Search Utilities
 * Handles MongoDB and Pinecone searches
 */

const QAPair = require("../database/models/QAPair");
const embeddingService = require("../services/embeddingService");
const pineconeService = require("../services/pineconeService");
const { normalizeText, generateQuestionHash } = require('./textProcessing');
const { detectTopicIntent } = require('./intentDetection');

const INTENT_TO_CANONICAL_QUESTION = require('./intentDetection').INTENT_TO_CANONICAL_QUESTION;

/**
 * Search CSV Q&A using semantic matching in Pinecone "qa" namespace
 */
async function searchCSVQA(query, audience) {
  try {
    const queryEmbedding = await embeddingService.generateEmbedding(query, 'search_query');
    
    let filter;
    if (audience === 'admin') {
      filter = { audience: { $in: ['admin', 'public'] } };
    } else if (audience === 'employee') {
      filter = { audience: { $in: ['public', 'employee'] } };
    } else {
      filter = { audience: 'public' };
    }
    
    console.log(`🔍 Searching CSV Q&A in Pinecone "qa" namespace...`);
    const matches = await pineconeService.queryVectors(
      queryEmbedding,
      5,
      "qa",
      filter
    );
    
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
 * Search documents using Pinecone
 */
async function searchDocuments(query, audience, namespace) {
  try {
    console.log(`🔍 Generating query embedding for: "${query.substring(0, 50)}..."`);
    const queryEmbedding = await embeddingService.generateEmbedding(query, 'search_query');
    
    const filter = {
      audience: audience === 'employee' ? { $in: ['public', 'employee'] } : 'public'
    };
    
    console.log(`📊 Querying Pinecone namespace "${namespace}" with filter:`, filter);
    const topK = 10;
    const matches = await pineconeService.queryVectors(
      queryEmbedding,
      topK,
      namespace,
      filter
    );
    
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
    
    return chunks.slice(0, 8);
  } catch (error) {
    console.error("❌ Error searching Pinecone:", error.message);
    return [];
  }
}

/**
 * MongoDB keyword search with synonym expansion and pluralization
 */
async function searchMongoDBByKeywords(normalizedMessage, audienceFilter, options = {}) {
  const {
    skipFAQCheck = false,
    prioritizeFounder = false
  } = options;

  const commonWords = ['the', 'are', 'is', 'was', 'were', 'what', 'who', 'when', 'where', 'how', 'why', 'can', 'could', 'should', 'would', 'do', 'does', 'did', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'about', 'into', 'onto', 'upon', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'this', 'that', 'these', 'those'];
  let words = normalizedMessage.split(/\s+/).filter(w => w.length > 3 && !commonWords.includes(w.toLowerCase()));
  
  // Handle "Tell me about" queries
  if (normalizedMessage.includes("tell") && normalizedMessage.includes("about")) {
    if (normalizedMessage.includes("mobiloitte") || normalizedMessage.includes("company")) {
      if (!words.includes("mobiloitte")) words.push("mobiloitte");
      if (!words.includes("company")) words.push("company");
    }
  }
  
  // Skip FAQ queries
  if (!skipFAQCheck) {
    const lowerNormalized = normalizedMessage.toLowerCase();
    const isFAQQuery = 
      lowerNormalized.includes("frequently asked questions") ||
      lowerNormalized.includes("frequently asked") ||
      (lowerNormalized.includes("faq") && (lowerNormalized.includes("what") || lowerNormalized.includes("are"))) ||
      lowerNormalized === "faq" ||
      lowerNormalized === "faqs";
    
    if (isFAQQuery) {
      console.log("⚠️  FAQ query detected in keyword search - skipping keyword match.");
      return null;
    }
  }
  
  // Expand synonyms
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
  
  const expandedWords = [...words];
  words.forEach(word => {
    const lowerWord = word.toLowerCase();
    if (synonymMap[lowerWord]) {
      expandedWords.push(...synonymMap[lowerWord]);
    }
    Object.keys(synonymMap).forEach(synonym => {
      if (lowerWord.includes(synonym) || synonym.includes(lowerWord)) {
        expandedWords.push(...synonymMap[synonym]);
      }
    });
  });
  
  // Handle company name typos
  words.forEach(word => {
    const lowerWord = word.toLowerCase();
    if (lowerWord.includes('mobilo') || lowerWord.includes('mobiloi')) {
      expandedWords.push('mobiloitte');
    }
  });
  
  // Handle pluralization
  expandedWords.forEach(word => {
    if (word.endsWith('r') && !word.endsWith('er') && !word.endsWith('or')) {
      expandedWords.push(word + 's');
    } else if (word.endsWith('er') || word.endsWith('or')) {
      expandedWords.push(word + 's');
    } else if (word.endsWith('y')) {
      expandedWords.push(word.slice(0, -1) + 'ies');
    } else if (!word.endsWith('s')) {
      expandedWords.push(word + 's');
    }
    if (word.endsWith('ies')) {
      expandedWords.push(word.slice(0, -3) + 'y');
    } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) {
      expandedWords.push(word.slice(0, -1));
    }
  });
  
  words = [...new Set(expandedWords)];
  
  // Prioritize founder keywords if requested
  const founderKeywords = ['founder', 'founders', 'director', 'directors', 'ceo', 'chairman', 'started', 'founded', 'established', 'created', 'began', 'incorporated'];
  const hasFounderKeyword = words.some(word => founderKeywords.includes(word.toLowerCase()));
  
  if (words.length === 0) return null;
  
  // PRIORITY 1: Founder keywords
  if (hasFounderKeyword && prioritizeFounder) {
    console.log("🔍 Founder keywords detected, prioritizing founder Q&A search...");
    const founderWords = words.filter(word => founderKeywords.includes(word.toLowerCase()));
    
    const founderQueries = [];
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
    
    for (const query of founderQueries) {
      const qaPair = await QAPair.findOne({
        $and: [
          query,
          { audience: audienceFilter }
        ]
      });
      
      if (qaPair) {
        console.log(`✅ Found founder Q&A match via priority search: "${qaPair.question.substring(0, 60)}..."`);
        return qaPair;
      }
    }
  }
  
  // PRIORITY 2: General keyword search
  const keywordQueries = [];
  
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
  
  for (const query of keywordQueries) {
    const qaPair = await QAPair.findOne({
      $and: [
        query,
        { audience: audienceFilter }
      ]
    });
    
    if (qaPair) {
      console.log(`✅ Found Q&A match via keyword search: "${qaPair.question.substring(0, 60)}..."`);
      return qaPair;
    }
  }
  
  return null;
}

/**
 * Search Q&A in MongoDB (exact, hash, partial match)
 */
async function searchMongoDBQA(normalizedMessage, audienceFilter, userRole, message) {
  const normalizedQuestion = normalizedMessage;
  const questionHash = generateQuestionHash(normalizedQuestion);
  
  // Try exact match
  let qaPair = await QAPair.findOne({ 
    normalizedQuestion: normalizedQuestion,
    audience: audienceFilter
  });
  
  // Try hash-based match
  if (!qaPair) {
    qaPair = await QAPair.findOne({ 
      questionHash: questionHash,
      audience: audienceFilter
    });
  }
  
  // For admin, try partial match
  if (!qaPair && userRole === "admin") {
    qaPair = await QAPair.findOne({
      $or: [
        { question: { $regex: message.substring(0, 30), $options: "i" } },
        { question: { $regex: normalizedMessage.substring(0, 30), $options: "i" } }
      ],
      audience: { $in: ["admin", "public"] }
    });
  }
  
  return qaPair;
}

module.exports = {
  searchCSVQA,
  searchDocuments,
  searchMongoDBByKeywords,
  searchMongoDBQA
};
