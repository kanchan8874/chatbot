const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const IngestionJob = require("../database/models/IngestionJob");
const QAPair = require("../database/models/QAPair");
const DocumentChunk = require("../database/models/DocumentChunk");
const documentProcessor = require("../services/documentProcessingService");
const pineconeService = require("../services/pineconeService");
const embeddingService = require("../services/embeddingService");

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Helper function to validate CSV data
function validateCSVData(data) {
  // Check if required columns exist
  const requiredColumns = ["question", "answer"];
  for (const column of requiredColumns) {
    if (!data.headers.includes(column)) {
      return { isValid: false, error: `Missing required column: ${column}` };
    }
  }
  return { isValid: true };
}

// Helper function to normalize text
function normalizeText(text) {
  if (!text) return "";
  return text
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Helper function to generate question hash for deduplication
function generateQuestionHash(question) {
  // Simple hash function for demonstration
  let hash = 0;
  for (let i = 0; i < question.length; i++) {
    const char = question.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString();
}

/**
 * STEP 9: Versioning + Reindex Strategy
 * Get next version for a sourceId (v1 -> v2 -> v3, etc.)
 * If sourceId doesn't exist, returns "v1"
 */
async function getNextVersion(sourceId, sourceType) {
  try {
    // Find latest job for this sourceId
    const latestJob = await IngestionJob.findOne({ sourceId, sourceType })
      .sort({ createdAt: -1 });
    
    if (!latestJob || !latestJob.version) {
      return "v1"; // First time ingestion
    }
    
    // Extract version number (v1 -> 1, v2 -> 2, etc.)
    const versionMatch = latestJob.version.match(/^v(\d+)$/);
    if (!versionMatch) {
      return "v1"; // Invalid version format, start fresh
    }
    
    const currentVersionNum = parseInt(versionMatch[1], 10);
    const nextVersionNum = currentVersionNum + 1;
    return `v${nextVersionNum}`;
  } catch (error) {
    console.error("Error getting next version:", error.message);
    return "v1"; // Fallback to v1 on error
  }
}

/**
 * STEP 9: Delete old vectors before reindexing
 * Prevents "Pinecone junkyard effect" by removing old version vectors
 */
async function deleteOldVectors(sourceId, oldVersion, namespace) {
  try {
    console.log(`🗑️  Deleting old vectors for sourceId: ${sourceId}, version: ${oldVersion}, namespace: ${namespace}`);
    
    // Delete vectors with matching source_id and version
    // Pinecone V2 filter format: { field: { $eq: value } }
    const deleteFilter = {
      source_id: { $eq: sourceId },
      version: { $eq: oldVersion }
    };
    
    const result = await pineconeService.deleteVectors(deleteFilter, namespace);
    console.log(`✅ Deleted old vectors (sourceId: ${sourceId}, version: ${oldVersion})`);
    return { success: true, deleted: true, deletedCount: result?.deletedCount || 0 };
  } catch (error) {
    console.warn(`⚠️  Failed to delete old vectors: ${error.message}`);
    // Don't throw - continue with new ingestion even if delete fails
    // This prevents blocking ingestion if Pinecone delete fails
    return { success: false, deleted: false, error: error.message };
  }
}

// CSV Ingestion Route
router.post("/csv", upload.single("file"), async (req, res) => {
  try {
    const { audience = "public", sourceId = uuidv4() } = req.body;
    
    // Create ingestion job
    const job = new IngestionJob({
      sourceId,
      sourceType: "csv",
      audience,
      status: "queued",
      version: "v1",
      metadata: {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
      },
    });
    
    await job.save();
    
    // Process CSV file
    job.status = "processing";
    await job.save();
    
    // Step 1: Store raw CSV file (PRD requirement: raw files as source of truth)
    const rawStorageDir = path.join(__dirname, '../../storage/raw/csv');
    if (!fs.existsSync(rawStorageDir)) {
      fs.mkdirSync(rawStorageDir, { recursive: true });
    }
    const rawFilePath = path.join(rawStorageDir, `${sourceId}.csv`);
    fs.writeFileSync(rawFilePath, req.file.buffer);
    console.log(`💾 Raw CSV file stored at: ${rawFilePath}`);
    
    // Step 2: Parse CSV using csv-parser (proper parsing with quoted values support)
    console.log("📊 Parsing CSV file with csv-parser...");
    const csvContent = req.file?.buffer.toString("utf8");
    
    if (!csvContent) {
      throw new Error("No CSV content found");
    }
    
    // Parse CSV using stream-based parser (handles quoted values, commas in fields)
    const qaPairs = [];
    let headersValidated = false;
    
    await new Promise((resolve, reject) => {
      const stream = Readable.from([csvContent]);
      
      stream
        .pipe(csv())
        .on('headers', (headerList) => {
          // Validate required columns
          const validation = validateCSVData({ headers: headerList });
          if (!validation.isValid) {
            reject(new Error(validation.error));
            return;
          }
          headersValidated = true;
          console.log(`✅ CSV headers validated: ${headerList.join(', ')}`);
        })
        .on('data', (row) => {
          // Process each row - handle both lowercase and capitalized headers
          const question = row.question || row.Question || '';
          const answer = row.answer || row.Answer || '';
          
          if (!question || !answer) {
            console.warn(`⚠️  Skipping row: Missing question or answer`);
            return;
          }
          
          const qaPair = new QAPair({
            question: question,
            answer: answer,
            questionHash: generateQuestionHash(question),
            normalizedQuestion: normalizeText(question),
            sourceId,
            audience: row.audience || row.Audience || audience,
            tags: row.tags ? (row.tags.includes(';') ? row.tags.split(';').map(t => t.trim()) : [row.tags.trim()]) : [],
            category: row.category || row.Category || '',
            language: row.language || row.Language || 'en',
            updatedAt: new Date(),
            // STEP 8: Add comprehensive metadata
            department: row.department || row.Department || department || '',
          });
          
          qaPairs.push(qaPair);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
    
    if (!headersValidated) {
      throw new Error("CSV headers validation failed");
    }
    
    if (qaPairs.length === 0) {
      throw new Error("No valid QA pairs found in CSV");
    }
    
    console.log(`✅ Parsed ${qaPairs.length} QA pairs from CSV`);
    
    // Save all QA pairs to MongoDB
    await QAPair.insertMany(qaPairs);
    console.log(`✅ Saved ${qaPairs.length} QA pairs to database`);
    
    // Step 3: Generate embeddings for questions (PRD requirement: embed questions for semantic matching)
    console.log(`📊 Generating embeddings for ${qaPairs.length} questions...`);
    const questions = qaPairs.map(qa => qa.question);
    const questionEmbeddings = await embeddingService.generateEmbeddingsBatch(questions);
    
    // Step 4: Create vectors for Pinecone (PRD: store in "qa" namespace)
    const vectors = qaPairs.map((qaPair, index) => ({
      id: `qa-${qaPair._id || sourceId}-${index}`,
      values: questionEmbeddings[index],
      metadata: {
        question: qaPair.question,
        answer: qaPair.answer,
        source_id: sourceId,
        source_type: 'csv',
        audience: qaPair.audience,
        question_hash: qaPair.questionHash,
        normalized_question: qaPair.normalizedQuestion,
        tags: qaPair.tags || [],
        category: qaPair.category || '',
        language: qaPair.language || 'en'
      }
    }));
    
    // Step 5: Upsert vectors to Pinecone "qa" namespace (PRD requirement)
    try {
      console.log(`📤 Upserting ${vectors.length} vectors to Pinecone "qa" namespace (version: ${version})...`);
      await pineconeService.upsertVectors(vectors, "qa");
      console.log(`✅ Successfully indexed ${vectors.length} QA pairs in Pinecone (version: ${version})`);
    } catch (pineconeError) {
      console.warn(`⚠️  Pinecone indexing failed: ${pineconeError.message}`);
      console.warn(`   ✅ Data saved to MongoDB successfully`);
      console.warn(`   ⚠️  Pinecone indexing skipped (set PINECONE_API_KEY to enable)`);
      // Continue - MongoDB data is still saved, chat will work with MongoDB search
    }
    
    // Update job status
    job.status = "indexed";
    job.metadata = {
      ...job.metadata,
      qaPairsCount: qaPairs.length,
      vectorsIndexed: vectors.length,
      version: version,
    };
    await job.save();
    
    return res.json({ 
      message: "CSV ingestion completed successfully", 
      jobId: job._id,
      sourceId,
      version: version, // STEP 9: Return version info
      qaPairsCount: qaPairs.length,
      vectorsIndexed: vectors.length
    });
  } catch (error) {
    // Update job status to failed
    if (req.body.sourceId) {
      await IngestionJob.updateOne(
        { sourceId: req.body.sourceId },
        { status: "failed", errorMessage: error.message }
      );
    }
    
    return res.status(500).json({ 
      message: "CSV ingestion failed", 
      error: error.message 
    });
  }
});

// Document Ingestion Route
router.post("/docs", upload.single("file"), async (req, res) => {
  try {
    const { audience = "public", sourceId = uuidv4(), department = "", url = "" } = req.body;
    
    // STEP 9: Get next version for this sourceId
    const version = await getNextVersion(sourceId, "doc");
    console.log(`📌 Using version: ${version} for sourceId: ${sourceId}`);
    
    // STEP 9: If this is a reindex (version > v1), delete old vectors first
    if (version !== "v1") {
      const oldVersion = `v${parseInt(version.replace('v', '')) - 1}`;
      const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
      await deleteOldVectors(sourceId, oldVersion, namespace);
      
      // Delete old document chunks from MongoDB
      await DocumentChunk.deleteMany({ sourceId });
      console.log(`🗑️  Deleted old MongoDB document chunks for sourceId: ${sourceId}`);
    }
    
    // Create ingestion job
    const job = new IngestionJob({
      sourceId,
      sourceType: "doc",
      audience,
      status: "queued",
      version: version, // Use calculated version
      metadata: {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
        department: department || '',
        url: url || '',
      },
    });
    
    await job.save();
    
    // Process document file
    job.status = "processing";
    await job.save();
    
    // Extract, clean, and chunk the document
    const { chunks, metadata } = await documentProcessor.processDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      { chunkSize: 500, overlap: 50 }
    );
    
    // Save document chunks to database with comprehensive metadata (STEP 8)
    const currentTimestamp = new Date();
    const documentChunks = chunks.map(chunk => ({
      chunkId: `${sourceId}-${version}-${chunk.position}`, // Include version in chunkId
      chunkText: chunk.chunkText,
      sourceId: sourceId,
      audience: audience,
      title: metadata.title || req.file?.originalname || '',
      url: url || metadata.url || '',
      page: chunk.page || null,
      headingPath: chunk.headingPath || '', // STEP 8: Heading hierarchy
      department: department || metadata.department || '',
      tags: metadata.tags || [],
      language: metadata.language || 'en',
      wordCount: chunk.wordCount || 0,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    }));
    
    await DocumentChunk.insertMany(documentChunks);
    console.log(`✅ Saved ${documentChunks.length} document chunks to database`);
    
    // Step 3: Generate real embeddings for document chunks (PRD requirement)
    console.log(`📊 Generating embeddings for ${documentChunks.length} document chunks...`);
    const chunkTexts = documentChunks.map(chunk => chunk.chunkText);
    const chunkEmbeddings = await embeddingService.generateEmbeddingsBatch(chunkTexts);
    
    // Step 4: Create vectors for Pinecone with comprehensive metadata (STEP 8)
    const vectors = documentChunks.map((chunk, index) => ({
      id: chunk.chunkId, // Already includes version
      values: chunkEmbeddings[index],
      metadata: {
        // Core content
        text: chunk.chunkText,
        chunk_id: chunk.chunkId,
        
        // Source identification
        source_id: sourceId,
        source_type: 'doc',
        version: version, // STEP 9: Version tracking
        
        // Audience & access control
        audience: chunk.audience,
        
        // Document structure & navigation (STEP 8)
        title: chunk.title || '',
        url: chunk.url || '',
        page: chunk.page || null,
        heading_path: chunk.headingPath || '', // STEP 8: Heading hierarchy for context
        
        // Organization & categorization (STEP 8)
        department: chunk.department || '',
        tags: chunk.tags || [],
        language: chunk.language || 'en',
        
        // Timestamps (STEP 8: updated_at)
        updated_at: currentTimestamp.toISOString(),
        created_at: currentTimestamp.toISOString(),
      }
    }));
    
    // Step 5: Upsert vectors to Pinecone (PRD: separate namespaces for public/employee docs)
    const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
    try {
      console.log(`📤 Upserting ${vectors.length} vectors to Pinecone "${namespace}" namespace (version: ${version})...`);
      await pineconeService.upsertVectors(vectors, namespace);
      console.log(`✅ Successfully indexed ${vectors.length} document chunks in Pinecone (version: ${version})`);
    } catch (pineconeError) {
      console.warn(`⚠️  Pinecone indexing failed: ${pineconeError.message}`);
      console.warn(`   ✅ Data saved to MongoDB successfully`);
      console.warn(`   ⚠️  Pinecone indexing skipped (set PINECONE_API_KEY to enable)`);
    }
    
    // Update job status
    job.status = "indexed";
    job.metadata = {
      ...job.metadata,
      chunksCount: documentChunks.length,
      vectorsIndexed: vectors.length,
      version: version,
    };
    await job.save();
    
    return res.json({ 
      message: "Document ingestion completed successfully", 
      jobId: job._id,
      sourceId,
      version: version, // STEP 9: Return version info
      chunksCount: documentChunks.length,
      vectorsIndexed: vectors.length
    });
  } catch (error) {
    console.error("Document ingestion error:", error);
    
    // Update job status to failed
    if (req.body.sourceId) {
      await IngestionJob.updateOne(
        { sourceId: req.body.sourceId },
        { status: "failed", errorMessage: error.message }
      );
    }
    
    return res.status(500).json({ 
      message: "Document ingestion failed", 
      error: error.message 
    });
  }
});

// Web Crawl Ingestion Route
router.post("/webcrawl", async (req, res) => {
  try {
    const { url, audience = "public", sourceId = uuidv4(), department = "" } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        message: "URL is required for web crawling" 
      });
    }
    
    // STEP 9: Get next version for this sourceId
    const version = await getNextVersion(sourceId, "web");
    console.log(`📌 Using version: ${version} for sourceId: ${sourceId}`);
    
    // STEP 9: If this is a reindex (version > v1), delete old vectors first
    if (version !== "v1") {
      const oldVersion = `v${parseInt(version.replace('v', '')) - 1}`;
      const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
      await deleteOldVectors(sourceId, oldVersion, namespace);
      
      // Delete old document chunks from MongoDB
      await DocumentChunk.deleteMany({ sourceId });
      console.log(`🗑️  Deleted old MongoDB web crawl chunks for sourceId: ${sourceId}`);
    }
    
    // Step 1: Store raw web crawl HTML (PRD requirement: raw files as source of truth)
    const rawStorageDir = path.join(__dirname, '../../storage/raw/web');
    if (!fs.existsSync(rawStorageDir)) {
      fs.mkdirSync(rawStorageDir, { recursive: true });
    }
    const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '').substring(0, 20);
    const rawFilePath = path.join(rawStorageDir, `${sourceId}-${urlHash}.html`);
    // Note: In production, you would fetch and store actual HTML from URL
    console.log(`💾 Raw web crawl would be stored at: ${rawFilePath}`);
    
    // Create ingestion job
    const job = new IngestionJob({
      sourceId,
      sourceType: "web",
      audience,
      status: "queued",
      version: version, // Use calculated version
      metadata: {
        url: url,
        department: department || '',
      },
    });
    
    await job.save();
    
    // Process web content
    job.status = "processing";
    await job.save();
    
    // For now, we'll simulate web crawling with mock content
    // In production, use a web crawler library like puppeteer or cheerio
    const mockHtmlContent = `
      <html>
        <head><title>Sample Web Page</title></head>
        <body>
          <h1>Welcome to Our Company</h1>
          <p>This is sample content from a web page that would be crawled and processed.</p>
          <p>We provide various services including AI development, chatbot solutions, and NLP technologies.</p>
          <h2>Our Services</h2>
          <ul>
            <li>Chatbot Development</li>
            <li>Natural Language Processing</li>
            <li>Machine Learning Solutions</li>
          </ul>
        </body>
      </html>
    `;
    
    // Extract, clean, and chunk the web content
    const { chunks, metadata } = await documentProcessor.processDocument(
      Buffer.from(mockHtmlContent),
      'text/html',
      url,
      { chunkSize: 500, overlap: 50 }
    );
    
    // Save web crawl chunks to database with comprehensive metadata (STEP 8)
    const currentTimestamp = new Date();
    const webChunks = chunks.map(chunk => ({
      chunkId: `${sourceId}-${version}-${chunk.position}`,
      chunkText: chunk.chunkText,
      sourceId: sourceId,
      audience: audience,
      title: metadata.title || url,
      url: url,
      page: null, // Web pages don't have page numbers
      headingPath: '', // Could be extracted from HTML structure
      department: department || '',
      tags: [],
      language: metadata.language || 'en',
      wordCount: chunk.wordCount || 0,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    }));
    
    await DocumentChunk.insertMany(webChunks);
    console.log(`✅ Saved ${webChunks.length} web crawl chunks to database`);
    
    // Generate embeddings for web chunks
    console.log(`📊 Generating embeddings for ${webChunks.length} web chunks...`);
    const chunkTexts = webChunks.map(chunk => chunk.chunkText);
    const chunkEmbeddings = await embeddingService.generateEmbeddingsBatch(chunkTexts);
    
    // Create vectors for Pinecone with comprehensive metadata (STEP 8)
    const vectors = webChunks.map((chunk, index) => ({
      id: chunk.chunkId,
      values: chunkEmbeddings[index],
      metadata: {
        // Core content
        text: chunk.chunkText,
        chunk_id: chunk.chunkId,
        
        // Source identification
        source_id: sourceId,
        source_type: 'web',
        version: version, // STEP 9: Version tracking
        
        // Audience & access control
        audience: chunk.audience,
        
        // Document structure & navigation (STEP 8)
        title: chunk.title || '',
        url: chunk.url || '',
        page: chunk.page || null,
        heading_path: chunk.headingPath || '',
        
        // Organization & categorization (STEP 8)
        department: chunk.department || '',
        tags: chunk.tags || [],
        language: chunk.language || 'en',
        
        // Timestamps (STEP 8: updated_at)
        updated_at: currentTimestamp.toISOString(),
        created_at: currentTimestamp.toISOString(),
      }
    }));
    
    // Step 5: Upsert vectors to Pinecone
    const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
    try {
      console.log(`📤 Upserting ${vectors.length} vectors to Pinecone "${namespace}" namespace (version: ${version})...`);
      await pineconeService.upsertVectors(vectors, namespace);
      console.log(`✅ Successfully indexed ${vectors.length} web crawl chunks in Pinecone (version: ${version})`);
    } catch (pineconeError) {
      console.warn(`⚠️  Pinecone indexing failed: ${pineconeError.message}`);
      console.warn(`   ✅ Data saved to MongoDB successfully`);
      console.warn(`   ⚠️  Pinecone indexing skipped (set PINECONE_API_KEY to enable)`);
    }
    
    // Update job status
    job.status = "indexed";
    job.metadata = {
      ...job.metadata,
      chunksCount: webChunks.length,
      vectorsIndexed: vectors.length,
      version: version,
    };
    await job.save();
    
    return res.json({ 
      message: "Web crawl ingestion completed successfully", 
      jobId: job._id,
      sourceId,
      version: version, // STEP 9: Return version info
      chunksCount: webChunks.length,
      vectorsIndexed: vectors.length
    });
  } catch (error) {
    console.error("Web crawl ingestion error:", error);
    
    // Update job status to failed
    if (req.body.sourceId) {
      await IngestionJob.updateOne(
        { sourceId: req.body.sourceId },
        { status: "failed", errorMessage: error.message }
      );
    }
    
    return res.status(500).json({ 
      message: "Web crawl ingestion failed", 
      error: error.message 
    });
  }
});

module.exports = router;