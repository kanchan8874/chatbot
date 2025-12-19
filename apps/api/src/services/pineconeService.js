// Pinecone service for vector database operations
const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('../config/env');

class PineconeService {
  constructor() {
    this.client = null;
    this.index = null;
    this.isInitialized = false;
  }
  
  async initialize() {
    try {
      // Check if already initialized
      if (this.isInitialized && this.client && this.index) {
        return;
      }
      
      // Validate environment variables
      if (!config.pinecone.apiKey) {
        throw new Error("PINECONE_API_KEY is not set in environment variables");
      }
      
      if (!config.pinecone.indexName) {
        throw new Error("PINECONE_INDEX_NAME is not set in environment variables");
      }
      
      // Initialize Pinecone client
      this.client = new Pinecone({
        apiKey: config.pinecone.apiKey,
      });
      
      // Get the index
      this.index = this.client.Index(config.pinecone.indexName);
      this.isInitialized = true;
      
      console.log("Pinecone service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Pinecone service:", error.message);
      throw error;
    }
  }
  
  async upsertVectors(vectors, namespace = "") {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Validate input
      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
        throw new Error("Vectors must be a non-empty array");
      }
      
      // Add namespace to each vector if provided
      if (namespace) {
        vectors = vectors.map(vector => ({
          ...vector,
          metadata: {
            ...vector.metadata,
            _namespace: namespace // Store namespace in metadata since Pinecone V2 doesn't use namespace param directly
          }
        }));
      }
      
      // Upsert vectors to Pinecone (batch processing for large datasets)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
      }
      
      console.log(`Upserted ${vectors.length} vectors`);
      return { success: true };
    } catch (error) {
      console.error("Failed to upsert vectors to Pinecone:", error.message);
      throw error;
    }
  }
  
  async queryVectors(queryVector, topK = 10, namespace = "", filter = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Validate input
      if (!queryVector || !Array.isArray(queryVector)) {
        throw new Error("Query vector must be an array");
      }
      
      // Build filter with namespace (Pinecone V2 uses metadata filters)
      // Since we store namespace in metadata._namespace, filter by it
      const finalFilter = { ...filter };
      if (namespace) {
        // Filter by namespace stored in metadata
        finalFilter._namespace = { $eq: namespace };
      }
      
      // Prepare the query request (Pinecone V2 format)
      const queryRequest = {
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
        includeValues: false
      };
      
      // Add filter only if it has values
      if (Object.keys(finalFilter).length > 0) {
        queryRequest.filter = finalFilter;
      }
      
      // Query vectors from Pinecone
      const queryResponse = await this.index.query(queryRequest);
      return queryResponse.matches || [];
    } catch (error) {
      console.error("Failed to query vectors from Pinecone:", error.message);
      throw error;
    }
  }
  
  async deleteVectors(filter = {}, namespace = "") {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Build final filter with namespace (Pinecone V2 uses metadata filters)
      const finalFilter = { ...filter };
      if (namespace) {
        finalFilter._namespace = { $eq: namespace };
      }
      
      // Delete vectors from Pinecone using deleteMany with filter
      // Note: Pinecone V2 deleteMany requires filter object
      const deleteResult = await this.index.deleteMany(finalFilter);
      
      console.log(`✅ Deleted vectors with filter: ${JSON.stringify(finalFilter)}`);
      return { success: true, deletedCount: deleteResult?.deletedCount || 0 };
    } catch (error) {
      console.error("Failed to delete vectors from Pinecone:", error.message);
      throw error;
    }
  }
  
  async createIndex(indexName, dimension, metric = "cosine") {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Validate input
      if (!indexName || !dimension) {
        throw new Error("Index name and dimension are required");
      }
      
      // Create a new Pinecone index
      await this.client.createIndex({
        name: indexName,
        dimension: dimension,
        metric: metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: config.pinecone.environment || 'us-east-1'
          }
        }
      });
      
      console.log(`Created index: ${indexName} with dimension: ${dimension}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to create Pinecone index:", error.message);
      throw error;
    }
  }
  
  async deleteIndex(indexName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Validate input
      if (!indexName) {
        throw new Error("Index name is required");
      }
      
      // Delete a Pinecone index
      await this.client.deleteIndex(indexName);
      
      console.log(`Deleted index: ${indexName}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete Pinecone index:", error.message);
      throw error;
    }
  }
  
  async listIndexes() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // List all indexes
      const indexes = await this.client.listIndexes();
      return indexes.indexes || [];
    } catch (error) {
      console.error("Failed to list Pinecone indexes:", error.message);
      throw error;
    }
  }
  
  async describeIndex(indexName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Validate input
      if (!indexName) {
        throw new Error("Index name is required");
      }
      
      // Describe an index
      const indexDescription = await this.client.describeIndex(indexName);
      return indexDescription;
    } catch (error) {
      console.error("Failed to describe Pinecone index:", error.message);
      throw error;
    }
  }
  
  // Test connection to Pinecone
  async testConnection() {
    try {
      await this.initialize();
      const indexes = await this.listIndexes();
      console.log("Pinecone connection test successful. Available indexes:", indexes.map(idx => idx.name));
      return { success: true, indexes: indexes.map(idx => idx.name) };
    } catch (error) {
      console.error("Pinecone connection test failed:", error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new PineconeService();