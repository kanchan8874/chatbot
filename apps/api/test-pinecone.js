// Test script for Pinecone integration
require('dotenv').config({ path: './src/.env' });
const pineconeService = require('./src/services/pineconeService');

async function testPinecone() {
  try {
    console.log("Testing Pinecone integration...");
    
    // Test connection
    const connectionResult = await pineconeService.testConnection();
    console.log("Connection test result:", connectionResult);
    
    // Check if our index exists, if not create it
    const indexName = process.env.PINECONE_INDEX_NAME || 'chatbot-index';
    const dimension = parseInt(process.env.PINECONE_DIMENSION) || 1536;
    
    console.log(`Checking if index ${indexName} exists...`);
    const indexes = await pineconeService.listIndexes();
    const indexExists = indexes.some(idx => idx.name === indexName);
    
    if (!indexExists) {
      console.log(`Index ${indexName} does not exist. Creating it...`);
      await pineconeService.createIndex(indexName, dimension);
      console.log(`Successfully created index: ${indexName}`);
      
      // Wait a bit for the index to be ready
      console.log("Waiting for index to be ready...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log(`Index ${indexName} already exists.`);
    }
    
    // Test upserting sample vectors
    console.log("Upserting sample vectors...");
    const sampleVectors = [
      {
        id: 'sample-vector-1',
        values: Array(dimension).fill(0.1), // Mock embedding vector
        metadata: {
          text: 'This is a sample document chunk',
          source: 'sample-doc.pdf',
          audience: 'public',
          type: 'document'
        }
      },
      {
        id: 'sample-vector-2',
        values: Array(dimension).fill(0.2), // Mock embedding vector
        metadata: {
          question: 'What services do you provide?',
          answer: 'We provide AI development services including chatbots, NLP solutions, and machine learning models.',
          source: 'qa-csv',
          audience: 'public',
          type: 'qa'
        }
      }
    ];
    
    await pineconeService.upsertVectors(sampleVectors, 'test_namespace');
    console.log("Successfully upserted sample vectors");
    
    // Test querying vectors
    console.log("Querying vectors...");
    const queryVector = Array(dimension).fill(0.15); // Mock query vector
    const results = await pineconeService.queryVectors(
      queryVector, 
      5, 
      'test_namespace', 
      { audience: 'public' }
    );
    console.log("Query results:", JSON.stringify(results, null, 2));
    
    // Test deleting vectors
    console.log("Deleting sample vectors...");
    await pineconeService.deleteVectors({ type: 'document' }, 'test_namespace');
    console.log("Successfully deleted sample vectors");
    
    console.log("All Pinecone tests passed!");
  } catch (error) {
    console.error("Pinecone test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
testPinecone();