// Phase 1 Integration Test Script
// Yeh script test karta hai ki sab kuch properly kaam kar raha hai

require('dotenv').config({ path: './src/.env' });
const embeddingService = require('./src/services/embeddingService');
const llmService = require('./src/services/llmService');
const pineconeService = require('./src/services/pineconeService');

async function testPhase1Integration() {
  console.log("🚀 Phase 1 Integration Test Starting...\n");
  
  // Test 1: Embedding Service
  console.log("=".repeat(60));
  console.log("TEST 1: Embedding Service");
  console.log("=".repeat(60));
  try {
    const testText = "What services does Mobiloitte provide?";
    console.log(`📝 Testing embedding generation for: "${testText}"`);
    const embedding = await embeddingService.generateEmbedding(testText);
    console.log(`✅ Embedding generated successfully!`);
    console.log(`   Dimension: ${embedding.length}`);
    console.log(`   Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
  } catch (error) {
    console.error(`❌ Embedding test failed: ${error.message}`);
    return;
  }
  
  // Test 2: LLM Service
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: LLM Service");
  console.log("=".repeat(60));
  try {
    const testQuestion = "What is 2+2?";
    const testContext = {
      type: 'qa',
      answer: "The answer is 4."
    };
    console.log(`📝 Testing LLM response generation...`);
    const response = await llmService.generateResponse(testQuestion, testContext, 'client');
    console.log(`✅ LLM response generated successfully!`);
    console.log(`   Response: ${response.substring(0, 100)}...`);
  } catch (error) {
    console.error(`❌ LLM test failed: ${error.message}`);
    return;
  }
  
  // Test 3: Pinecone Connection
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Pinecone Connection");
  console.log("=".repeat(60));
  try {
    const connectionTest = await pineconeService.testConnection();
    if (connectionTest.success) {
      console.log(`✅ Pinecone connection successful!`);
      console.log(`   Available indexes: ${connectionTest.indexes.join(', ')}`);
    } else {
      console.error(`❌ Pinecone connection failed: ${connectionTest.error}`);
      return;
    }
  } catch (error) {
    console.error(`❌ Pinecone test failed: ${error.message}`);
    return;
  }
  
  // Test 4: Complete Flow Simulation
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Complete Flow Simulation");
  console.log("=".repeat(60));
  try {
    const userQuery = "What services does Mobiloitte provide?";
    console.log(`📝 Simulating complete flow for query: "${userQuery}"`);
    
    // Step 1: Generate query embedding
    console.log(`\n1️⃣ Generating query embedding...`);
    const queryEmbedding = await embeddingService.generateEmbedding(userQuery);
    console.log(`   ✅ Embedding generated (${queryEmbedding.length} dimensions)`);
    
    // Step 2: Query Pinecone (will return empty if no data, but should work)
    console.log(`\n2️⃣ Querying Pinecone "qa" namespace...`);
    const matches = await pineconeService.queryVectors(queryEmbedding, 5, "qa", {});
    console.log(`   ✅ Query successful! Found ${matches.length} matches`);
    if (matches.length > 0) {
      console.log(`   Top match score: ${matches[0].score}`);
    } else {
      console.log(`   ⚠️  No matches found (this is OK if no data is indexed yet)`);
    }
    
    // Step 3: Generate LLM response (with mock context if no matches)
    console.log(`\n3️⃣ Generating LLM response...`);
    const mockContext = matches.length > 0 
      ? { type: 'document', chunks: matches }
      : { type: 'qa', answer: "Mobiloitte provides AI development services, chatbot solutions, and NLP technologies." };
    const finalResponse = await llmService.generateResponse(userQuery, mockContext, 'client');
    console.log(`   ✅ LLM response generated!`);
    console.log(`   Response: ${finalResponse.substring(0, 200)}...`);
    
  } catch (error) {
    console.error(`❌ Complete flow test failed: ${error.message}`);
    return;
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ ALL TESTS PASSED! Phase 1 Integration Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Next Steps:");
  console.log("1. Add OPENAI_API_KEY to .env file");
  console.log("2. Add PINECONE_API_KEY to .env file");
  console.log("3. Upload CSV Q&A data via /api/ingest/csv");
  console.log("4. Upload documents via /api/ingest/docs");
  console.log("5. Test chat via /api/chat/message");
}

// Run tests
testPhase1Integration().catch(console.error);
