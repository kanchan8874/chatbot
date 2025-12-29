// Embeddings Service - Supports Cohere (FREE)
// Yeh service text ko vector embeddings mein convert karta hai
// Embeddings = text ka mathematical representation jo semantic similarity find karne ke liye use hota hai

const { CohereClient } = require('cohere-ai');
const config = require('../config/env');

class EmbeddingService {
  constructor() {
    // Priority: Cohere (FREE) > Mock
    
    // Initialize Cohere (FREE API - Priority 1)
    if (config.cohere.apiKey) {
      try {
        this.cohereClient = new CohereClient({
          token: config.cohere.apiKey
        });
        this.cohereModel = config.cohere.embeddingModel || "embed-english-v3.0";
        this.cohereDimension = config.cohere.embeddingDimension || 1024;
        console.log("✅ Cohere embeddings initialized (FREE API)");
      } catch (error) {
        console.warn("⚠️  Cohere initialization failed:", error.message);
        this.cohereClient = null;
      }
    } else {
      this.cohereClient = null;
    }
    
    // Determine which service to use
    this.useCohere = !!this.cohereClient;
    
    // Set active dimension based on service
    this.dimension = this.useCohere ? this.cohereDimension : 1536;
  }


  async generateEmbedding(text, inputType = 'search_document') {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Priority 1: Try Cohere (FREE API)
    if (this.useCohere) {
      try {
        const response = await this.cohereClient.embed({
          texts: [text.trim()],
          model: this.cohereModel,
          inputType: inputType, // 'search_query' for queries, 'search_document' for documents
          truncate: 'END'
        });
        
        const embedding = response.embeddings[0];
        console.log(`✅ Generated Cohere embedding (${inputType}) (${text.substring(0, 50)}...) - Dimension: ${embedding.length}`);
        return embedding;
      } catch (error) {
        console.error("❌ Cohere embedding error:", error.message);
       
        // Fall through to mock
      }
    }

    // Priority 2: Mock embeddings (fallback)
    console.warn("⚠️  No embedding API available. Using mock embeddings for testing.");
    return this.generateMockEmbedding(text);
  }

  /**
   * Generate mock embedding for testing (when OpenAI key not available)
   */
  generateMockEmbedding(text) {
    // Simple hash-based mock embedding (consistent for same text)
    const hash = this.simpleHash(text);
    const embedding = Array(this.dimension).fill(0);
    
    // Fill with pseudo-random values based on hash
    for (let i = 0; i < this.dimension; i++) {
      embedding[i] = Math.sin(hash + i) * 0.5 + 0.5; // Normalize to 0-1
    }
    
    console.log(`📝 Generated mock embedding for text (${text.substring(0, 50)}...) - Dimension: ${embedding.length}`);
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Multiple texts ko batch mein embeddings generate karta hai (faster)
   * Priority: Cohere (FREE) > Mock
   * @param {string[]} texts - Array of texts
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateEmbeddingsBatch(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter empty texts
    const validTexts = texts.filter(t => t && t.trim().length > 0);
    
    if (validTexts.length === 0) {
      return [];
    }

    // Priority 1: Try Cohere (FREE API) - supports batch natively
    if (this.useCohere) {
      try {
        // Cohere supports batch up to 96 texts per request
        const batchSize = 96;
        const batches = [];
        
        for (let i = 0; i < validTexts.length; i += batchSize) {
          batches.push(validTexts.slice(i, i + batchSize));
        }

        const allEmbeddings = [];
        // For batch mode we always treat these as documents by default
        const inputType = 'search_document';
        
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`📦 Processing Cohere batch ${i + 1}/${batches.length} (${batch.length} texts)...`);
          
          const response = await this.cohereClient.embed({
            texts: batch,
            model: this.cohereModel,
            inputType: inputType, // 'search_query' for queries, 'search_document' for documents
            truncate: 'END'
          });
          
          allEmbeddings.push(...response.embeddings);
        }

        console.log(`✅ Generated ${allEmbeddings.length} Cohere embeddings in ${batches.length} batch(es)`);
        return allEmbeddings;
      } catch (error) {
        console.error("❌ Cohere batch embedding error:", error.message);
        console.warn("⚠️  Falling back to mock...");
        // Fall through to mock
      }
    }

    // Priority 2: Mock embeddings (fallback)
    console.warn("⚠️  No embedding API available. Using mock embeddings for testing.");
    return validTexts.map(text => this.generateMockEmbedding(text));
  }

  /**
   * Test function - check if service is working
   */
  async testConnection() {
    const serviceInfo = {
      cohere: this.useCohere ? "✅ Active" : "❌ Not available",
      mock: !this.useCohere ? "✅ Using mock" : "❌ Not needed"
    };

    try {
      const testEmbedding = await this.generateEmbedding("test");
      return {
        success: true,
        dimension: testEmbedding.length,
        service: this.useCohere ? "Cohere" : "Mock",
        model: this.useCohere ? this.cohereModel : "mock",
        services: serviceInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        services: serviceInfo
      };
    }
  }
}

// Export singleton instance
module.exports = new EmbeddingService();
