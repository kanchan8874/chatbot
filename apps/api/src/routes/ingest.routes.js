const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const IngestionJob = require("../database/models/IngestionJob");
const QAPair = require("../database/models/QAPair");
const DocumentChunk = require("../database/models/DocumentChunk");
const documentProcessor = require("../services/documentProcessingService");
const pineconeService = require("../services/pineconeService");

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
    
    // Parse CSV data (simplified for now)
    // In a real implementation, you would use a CSV parser like PapaParse or csv-parser
    const csvContent = req.file?.buffer.toString("utf8");
    
    if (!csvContent) {
      throw new Error("No CSV content found");
    }
    
    // Simple CSV parsing (in reality, use a proper CSV parser)
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).filter(line => line.trim() !== "");
    
    // Validate CSV structure
    const validation = validateCSVData({ headers });
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    // Process each row
    const qaPairs = [];
    for (const row of rows) {
      const values = row.split(",").map(v => v.trim());
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index] || "";
      });
      
      // Create QA pair
      const qaPair = new QAPair({
        question: rowData.question,
        answer: rowData.answer,
        questionHash: generateQuestionHash(rowData.question),
        normalizedQuestion: normalizeText(rowData.question),
        sourceId,
        audience: rowData.audience || audience,
        tags: rowData.tags ? rowData.tags.split(";") : [],
        category: rowData.category,
        language: rowData.language || "en",
        updatedAt: new Date(),
      });
      
      qaPairs.push(qaPair);
    }
    
    // Save all QA pairs
    await QAPair.insertMany(qaPairs);
    
    // Update job status
    job.status = "indexed";
    await job.save();
    
    return res.json({ 
      message: "CSV ingestion completed successfully", 
      jobId: job._id,
      sourceId,
      qaPairsCount: qaPairs.length
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
    const { audience = "public", sourceId = uuidv4() } = req.body;
    
    // Create ingestion job
    const job = new IngestionJob({
      sourceId,
      sourceType: "doc",
      audience,
      status: "queued",
      version: "v1",
      metadata: {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
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
    
    // Save document chunks to database
    const documentChunks = chunks.map(chunk => ({
      chunkId: `${sourceId}-${chunk.position}`,
      chunkText: chunk.chunkText,
      sourceId: sourceId,
      audience: audience,
      title: metadata.title,
      wordCount: chunk.wordCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    await DocumentChunk.insertMany(documentChunks);
    
    // Generate embeddings and store in Pinecone
    // For now, we'll use mock embeddings
    const vectors = documentChunks.map(chunk => ({
      id: chunk.chunkId,
      values: Array(1536).fill(Math.random()), // Mock embedding vector
      metadata: {
        text: chunk.chunkText,
        source: sourceId,
        audience: chunk.audience,
        type: 'document',
        title: chunk.title
      }
    }));
    
    // Upsert vectors to Pinecone
    const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
    await pineconeService.upsertVectors(vectors, namespace);
    
    // Update job status
    job.status = "indexed";
    await job.save();
    
    return res.json({ 
      message: "Document ingestion completed successfully", 
      jobId: job._id,
      sourceId,
      chunksCount: documentChunks.length
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
    const { url, audience = "public", sourceId = uuidv4() } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        message: "URL is required for web crawling" 
      });
    }
    
    // Create ingestion job
    const job = new IngestionJob({
      sourceId,
      sourceType: "web",
      audience,
      status: "queued",
      version: "v1",
      metadata: {
        url: url,
      },
    });
    
    await job.save();
    
    // Process web content
    job.status = "processing";
    await job.save();
    
    // For now, we'll simulate web crawling with mock content
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
    
    // Convert to buffer for processing
    const buffer = Buffer.from(mockHtmlContent, 'utf-8');
    
    // Extract, clean, and chunk the document
    const { chunks, metadata } = await documentProcessor.processDocument(
      buffer,
      'text/html',
      url,
      { chunkSize: 500, overlap: 50 }
    );
    
    // Save document chunks to database
    const documentChunks = chunks.map(chunk => ({
      chunkId: `${sourceId}-${chunk.position}`,
      chunkText: chunk.chunkText,
      sourceId: sourceId,
      audience: audience,
      title: metadata.title,
      wordCount: chunk.wordCount,
      url: url,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    await DocumentChunk.insertMany(documentChunks);
    
    // Generate embeddings and store in Pinecone
    // For now, we'll use mock embeddings
    const vectors = documentChunks.map(chunk => ({
      id: chunk.chunkId,
      values: Array(1536).fill(Math.random()), // Mock embedding vector
      metadata: {
        text: chunk.chunkText,
        source: sourceId,
        audience: chunk.audience,
        type: 'web',
        title: chunk.title,
        url: url
      }
    }));
    
    // Upsert vectors to Pinecone
    const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
    await pineconeService.upsertVectors(vectors, namespace);
    
    // Update job status
    job.status = "indexed";
    await job.save();
    
    return res.json({ 
      message: "Web crawl ingestion completed successfully", 
      jobId: job._id,
      sourceId,
      chunksCount: documentChunks.length
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