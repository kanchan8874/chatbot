// Script to insert CSV Q&A data into MongoDB
// PRD ke according: CSV data ko MongoDB mein store karna hai

require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const QAPair = require('./src/database/models/QAPair');
const config = require('./src/config/env');

// Helper functions
function normalizeText(text) {
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function generateQuestionHash(question) {
  let hash = 0;
  for (let i = 0; i < question.length; i++) {
    const char = question.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString();
}

async function insertCSVToMongoDB() {
  try {
    console.log("🚀 Starting CSV to MongoDB insertion...\n");
    
    // Step 1: Connect to MongoDB
    console.log("1️⃣ Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri);
    console.log("✅ Connected to MongoDB successfully!\n");
    
    // Step 2: Read CSV file
    console.log("2️⃣ Reading CSV file...");
    const csvPath = path.join(__dirname, 'mobiloitte-qa-data.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error("CSV file is empty or has no data rows");
    }
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim());
    console.log(`   Headers: ${headers.join(', ')}`);
    
    // Step 3: Parse CSV rows
    console.log("\n3️⃣ Parsing CSV data...");
    const qaPairs = [];
    const sourceId = `mobiloitte-qa-${Date.now()}`;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV parsing (handles quoted values)
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Last value
      
      // Create row data object
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });
      
      // Validate required fields
      if (!rowData.question || !rowData.answer) {
        console.warn(`⚠️  Skipping row ${i + 1}: Missing question or answer`);
        continue;
      }
      
      // Create QA pair object
      const qaPair = {
        question: rowData.question,
        answer: rowData.answer,
        questionHash: generateQuestionHash(rowData.question),
        normalizedQuestion: normalizeText(rowData.question),
        sourceId: sourceId,
        audience: rowData.audience || 'public',
        tags: rowData.tags ? rowData.tags.split(',').map(t => t.trim()) : [],
        category: rowData.category || '',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      qaPairs.push(qaPair);
    }
    
    console.log(`✅ Parsed ${qaPairs.length} QA pairs from CSV\n`);
    
    // Step 4: Clear existing data (optional - comment out if you want to keep old data)
    console.log("4️⃣ Checking for existing data...");
    const existingCount = await QAPair.countDocuments({ sourceId: sourceId });
    if (existingCount > 0) {
      console.log(`   Found ${existingCount} existing records with same sourceId`);
      console.log("   Deleting old records...");
      await QAPair.deleteMany({ sourceId: sourceId });
      console.log("   ✅ Old records deleted\n");
    }
    
    // Step 5: Insert into MongoDB
    console.log("5️⃣ Inserting QA pairs into MongoDB...");
    await QAPair.insertMany(qaPairs);
    console.log(`✅ Successfully inserted ${qaPairs.length} QA pairs into MongoDB!\n`);
    
    // Step 6: Verify insertion
    console.log("6️⃣ Verifying data...");
    const insertedCount = await QAPair.countDocuments({ sourceId: sourceId });
    console.log(`✅ Verified: ${insertedCount} records in database\n`);
    
    // Step 7: Show sample data
    console.log("7️⃣ Sample data from database:");
    const sample = await QAPair.findOne({ sourceId: sourceId });
    if (sample) {
      console.log(`   Question: ${sample.question}`);
      console.log(`   Answer: ${sample.answer.substring(0, 100)}...`);
      console.log(`   Audience: ${sample.audience}`);
      console.log(`   Category: ${sample.category}`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ CSV DATA SUCCESSFULLY INSERTED INTO MONGODB!");
    console.log("=".repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   - Total QA pairs inserted: ${qaPairs.length}`);
    console.log(`   - Source ID: ${sourceId}`);
    console.log(`   - Database: ${config.mongoUri.split('/').pop()}`);
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Run: node test-mongodb-data.js (to verify data)`);
    console.log(`   2. Start backend: npm run dev`);
    console.log(`   3. Test chat API with questions from CSV`);
    
    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ MongoDB connection closed");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
insertCSVToMongoDB();
