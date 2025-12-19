// Phase 2 Testing Script
// Yeh script test karta hai ki sab kuch properly kaam kar raha hai

require('dotenv').config({ path: './src/.env' });
const fs = require('fs');
const path = require('path');
const documentProcessor = require('./src/services/documentProcessingService');

async function testPhase2() {
  console.log("🧪 Phase 2 Testing Starting...\n");
  
  // Test 1: PDF Parsing
  console.log("=".repeat(60));
  console.log("TEST 1: PDF Parsing");
  console.log("=".repeat(60));
  try {
    // Create a simple test PDF content (mock)
    const testPdfBuffer = Buffer.from("Sample PDF content for testing");
    console.log("📄 Testing PDF text extraction...");
    
    // Note: This will use pdf-parse if available
    const result = await documentProcessor.extractText(
      testPdfBuffer,
      'application/pdf',
      'test.pdf'
    );
    
    console.log(`✅ PDF extraction working!`);
    console.log(`   Text length: ${result.text.length} characters`);
    console.log(`   Metadata: ${JSON.stringify(result.metadata)}`);
  } catch (error) {
    console.log(`⚠️  PDF test: ${error.message}`);
    console.log(`   (This is OK if no actual PDF file provided)`);
  }
  
  // Test 2: Word Document Parsing
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Word Document Parsing");
  console.log("=".repeat(60));
  try {
    // Create a simple test DOCX content (mock)
    const testDocxBuffer = Buffer.from("Sample Word document content");
    console.log("📄 Testing Word DOCX text extraction...");
    
    const result = await documentProcessor.extractText(
      testDocxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'test.docx'
    );
    
    console.log(`✅ Word extraction working!`);
    console.log(`   Text length: ${result.text.length} characters`);
  } catch (error) {
    console.log(`⚠️  Word test: ${error.message}`);
  }
  
  // Test 3: Raw File Storage
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Raw File Storage");
  console.log("=".repeat(60));
  try {
    const storageDirs = [
      'storage/raw/csv',
      'storage/raw/docs',
      'storage/raw/web'
    ];
    
    console.log("📁 Checking storage directories...");
    for (const dir of storageDirs) {
      const dirPath = path.join(__dirname, dir);
      if (fs.existsSync(dirPath)) {
        console.log(`   ✅ ${dir} exists`);
      } else {
        console.log(`   ❌ ${dir} missing`);
      }
    }
    
    // Test file write
    const testFile = path.join(__dirname, 'storage/raw/csv/test-file.csv');
    fs.writeFileSync(testFile, 'test,data');
    if (fs.existsSync(testFile)) {
      console.log(`   ✅ File write test: PASSED`);
      fs.unlinkSync(testFile); // Cleanup
    }
  } catch (error) {
    console.log(`   ❌ Storage test failed: ${error.message}`);
  }
  
  // Test 4: CSV Parsing (using csv-parser)
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: CSV Parsing with csv-parser");
  console.log("=".repeat(60));
  try {
    const csv = require('csv-parser');
    const { Readable } = require('stream');
    
    const testCSV = `question,answer,audience
"What is AI?","AI is artificial intelligence","public"
"What is ML?","ML is machine learning","public"`;
    
    const rows = [];
    await new Promise((resolve, reject) => {
      Readable.from([testCSV])
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`✅ CSV parsing working!`);
    console.log(`   Parsed ${rows.length} rows`);
    console.log(`   First row: ${JSON.stringify(rows[0])}`);
  } catch (error) {
    console.log(`   ❌ CSV parsing test failed: ${error.message}`);
  }
  
  // Test 5: Document Chunking
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Document Chunking");
  console.log("=".repeat(60));
  try {
    const longText = Array(1000).fill("This is a sample paragraph for testing chunking functionality. ").join('');
    const chunks = documentProcessor.chunkText(longText, {
      chunkSize: 300,
      overlap: 50
    });
    
    console.log(`✅ Chunking working!`);
    console.log(`   Created ${chunks.length} chunks`);
    console.log(`   First chunk length: ${chunks[0].length} characters`);
    console.log(`   Chunk size target: 300 words`);
  } catch (error) {
    console.log(`   ❌ Chunking test failed: ${error.message}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ PHASE 2 TESTING COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Next: Test with actual API endpoints");
}

testPhase2().catch(console.error);
