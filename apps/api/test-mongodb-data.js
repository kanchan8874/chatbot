// Test script to verify MongoDB data insertion
require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const QAPair = require('./src/database/models/QAPair');
const config = require('./src/config/env');

async function testMongoDBData() {
  try {
    console.log("🔍 Testing MongoDB Data...\n");
    
    // Connect to MongoDB
    console.log("1️⃣ Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri);
    console.log("✅ Connected!\n");
    
    // Count total QA pairs
    console.log("2️⃣ Counting QA pairs...");
    const totalCount = await QAPair.countDocuments();
    console.log(`   Total QA pairs in database: ${totalCount}\n`);
    
    // Get sample questions
    console.log("3️⃣ Sample questions from database:");
    const samples = await QAPair.find().limit(5);
    samples.forEach((qa, index) => {
      console.log(`\n   ${index + 1}. Question: ${qa.question}`);
      console.log(`      Answer: ${qa.answer.substring(0, 80)}...`);
      console.log(`      Audience: ${qa.audience}, Category: ${qa.category}`);
    });
    
    // Test search
    console.log("\n4️⃣ Testing search functionality...");
    const searchTerm = "services";
    const results = await QAPair.find({
      $or: [
        { question: { $regex: searchTerm, $options: 'i' } },
        { answer: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(3);
    
    console.log(`   Found ${results.length} results for "${searchTerm}"`);
    results.forEach((qa, index) => {
      console.log(`   ${index + 1}. ${qa.question}`);
    });
    
    // Test exact match
    console.log("\n5️⃣ Testing exact match...");
    const exactQuestion = "What services does Mobiloitte provide?";
    const exactMatch = await QAPair.findOne({
      normalizedQuestion: exactQuestion.toLowerCase().trim()
    });
    
    if (exactMatch) {
      console.log(`   ✅ Found exact match!`);
      console.log(`   Answer: ${exactMatch.answer.substring(0, 100)}...`);
    } else {
      console.log(`   ⚠️  No exact match found`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ MONGODB DATA TEST COMPLETE!");
    console.log("=".repeat(60));
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testMongoDBData();
