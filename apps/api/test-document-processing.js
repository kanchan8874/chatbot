// Test script for document processing service
const fs = require('fs');
const path = require('path');
const documentProcessor = require('./src/services/documentProcessingService');

async function testDocumentProcessing() {
  try {
    console.log("Testing document processing service...");
    
    // Test with a sample text document
    console.log("\n--- Testing with plain text ---");
    const sampleText = `
This is a sample document for testing the document processing service.
It contains multiple paragraphs to test the chunking functionality.

Second paragraph with some content to see how chunking works.
This paragraph will help us understand if the chunking is working correctly.

Third paragraph with more content to ensure we have enough text for testing.
We want to make sure that the chunking algorithm properly splits the text
into manageable chunks for processing and storage in the vector database.

Fourth paragraph to add more content and test edge cases.
This will help us verify that the document processing service works correctly
with various document formats and sizes.
    `.trim();
    
    const textBuffer = Buffer.from(sampleText, 'utf-8');
    const result = await documentProcessor.processDocument(
      textBuffer, 
      'text/plain', 
      'sample.txt',
      { chunkSize: 50, overlap: 10 }
    );
    
    console.log("Processed text document:");
    console.log("Metadata:", result.metadata);
    console.log("Number of chunks:", result.chunks.length);
    console.log("First chunk:", result.chunks[0]?.chunkText.substring(0, 100) + "...");
    
    // Test cleaning function
    console.log("\n--- Testing text cleaning ---");
    const dirtyText = `
This is a sample document with some boilerplate text.
All rights reserved. Copyright 2023.
Page 1 of 10
Navigation Menu
Cookie Policy Accept Cookies
Privacy Policy Terms of Use
    
Main content that should remain after cleaning.
This is the valuable information we want to keep.
    `;
    
    const cleanedText = documentProcessor.cleanText(dirtyText);
    console.log("Original text length:", dirtyText.length);
    console.log("Cleaned text length:", cleanedText.length);
    console.log("Cleaned text:", cleanedText);
    
    console.log("\nAll document processing tests passed!");
  } catch (error) {
    console.error("Document processing test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
testDocumentProcessing();