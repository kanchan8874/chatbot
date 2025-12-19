// Test Groq LLM Service
require('dotenv').config({ path: './src/.env' });
const freeLLMService = require('./src/services/freeLLMService');

async function testGroqService() {
  console.log("🧪 Testing Groq LLM Service...\n");
  
  // Test 1: Check if Groq client is initialized
  console.log("1️⃣ Checking Groq API key...");
  if (freeLLMService.client) {
    console.log("   ✅ Groq client initialized successfully!");
    console.log("   Model: " + freeLLMService.model);
  } else {
    console.log("   ⚠️  Groq client not initialized");
    console.log("   Check if GROQ_API_KEY is set in .env file");
    return;
  }
  
  // Test 2: Generate a test response
  console.log("\n2️⃣ Testing LLM response generation...");
  try {
    const testQuestion = "What is 2+2?";
    const testContext = {
      type: 'qa',
      answer: "The answer is 4."
    };
    
    console.log(`   Question: "${testQuestion}"`);
    console.log("   Generating response...");
    
    const response = await freeLLMService.generateResponse(
      testQuestion,
      testContext,
      'client'
    );
    
    console.log(`   ✅ Response generated successfully!`);
    console.log(`   Response: ${response.substring(0, 150)}...`);
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return;
  }
  
  // Test 3: Test with Mobiloitte question
  console.log("\n3️⃣ Testing with Mobiloitte question...");
  try {
    const mobiloitteQuestion = "What services does Mobiloitte provide?";
    const mobiloitteContext = {
      type: 'qa',
      answer: "Mobiloitte provides AI development services, chatbot solutions, and NLP technologies."
    };
    
    console.log(`   Question: "${mobiloitteQuestion}"`);
    const response = await freeLLMService.generateResponse(
      mobiloitteQuestion,
      mobiloitteContext,
      'client'
    );
    
    console.log(`   ✅ Response generated!`);
    console.log(`   Response: ${response.substring(0, 200)}...`);
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ GROQ SERVICE TEST COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Next Steps:");
  console.log("   1. Backend server restart karo (Ctrl+C, phir npm run dev)");
  console.log("   2. Chat API test karo");
  console.log("   3. Frontend se test karo");
}

testGroqService().catch(console.error);
