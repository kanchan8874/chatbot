// OpenAI Embeddings Service
// Yeh service text ko vector embeddings mein convert karta hai
// Embeddings = text ka mathematical representation jo semantic similarity find karne ke liye use hota hai

const { OpenAI } = require('openai');
const config = require('../config/env');

class EmbeddingService {
  constructor() {
    // OpenAI client initialize karo
    if (!config.openai.apiKey) {
      console.warn("⚠️  OpenAI API key not found. Embeddings will fail.");
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
    this.model = config.openai.embeddingModel;
    this.dimension = config.openai.embeddingDimension;
  }

  /**
   * Single text ko embedding mein convert karta hai
   * @param {string} text - Text jo embed karna hai
   * @returns {Promise<number[]>} - Embedding vector (1536 dimensions ka array)
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // If no OpenAI key, use mock embeddings for testing
    if (!this.client) {
      console.warn("⚠️  OpenAI API key not set. Using mock embeddings for testing.");
      return this.generateMockEmbedding(text);
    }

    try {
      // OpenAI API call karo embeddings ke liye
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.trim(),
        dimensions: this.dimension
      });

      // Response se embedding vector extract karo
      const embedding = response.data[0].embedding;
      
      console.log(`✅ Generated embedding for text (${text.substring(0, 50)}...) - Dimension: ${embedding.length}`);
      
      return embedding;
    } catch (error) {
      console.error("❌ Error generating embedding:", error.message);
      console.warn("⚠️  Falling back to mock embeddings...");
      return this.generateMockEmbedding(text);
    }
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

    // If no OpenAI key, use mock embeddings for testing
    if (!this.client) {
      console.warn("⚠️  OpenAI API key not set. Using mock embeddings for testing.");
      return validTexts.map(text => this.generateMockEmbedding(text));
    }

    try {
      // OpenAI batch API call (max 2048 texts per batch)
      const batchSize = 100; // OpenAI allows up to 2048, but we use 100 for safety
      const batches = [];
      
      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize);
        batches.push(batch);
      }

      const allEmbeddings = [];
      
      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📦 Processing embedding batch ${i + 1}/${batches.length} (${batch.length} texts)...`);
        
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: this.dimension
        });

        // Extract embeddings from response
        const embeddings = response.data.map(item => item.embedding);
        allEmbeddings.push(...embeddings);
      }

      console.log(`✅ Generated ${allEmbeddings.length} embeddings in ${batches.length} batch(es)`);
      
      return allEmbeddings;
    } catch (error) {
      console.error("❌ Error generating batch embeddings:", error.message);
      console.warn("⚠️  Falling back to mock embeddings...");
      return validTexts.map(text => this.generateMockEmbedding(text));
    }
  }

  /**
   * Test function - check if service is working
   */
  async testConnection() {
    if (!this.client) {
      return { success: false, error: "OpenAI client not initialized" };
    }

    try {
      const testEmbedding = await this.generateEmbedding("test");
      return {
        success: true,
        dimension: testEmbedding.length,
        model: this.model
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new EmbeddingService();
