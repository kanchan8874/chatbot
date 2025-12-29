const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs/promises");
const path = require("path");
const IngestionJob = require("../database/models/IngestionJob");
const QAPair = require("../database/models/QAPair");
const DocumentChunk = require("../database/models/DocumentChunk");
const documentProcessor = require("../services/documentProcessingService");
const pineconeService = require("../services/pineconeService");
const embeddingService = require("../services/embeddingService");
const { requireAdmin } = require("../middlewares/auth");

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Base path for raw storage (acts as source of truth locally; replace with S3/Blob in prod)
const RAW_BASE_PATH = path.resolve(__dirname, "..", "..", "storage", "raw");

async function saveRawFile({ type, sourceId, extension = "", buffer }) {
  const dir = path.join(RAW_BASE_PATH, type);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${sourceId}${extension}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
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
router.post("/csv", requireAdmin, upload.single("file"), async (req, res) => {
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
    
    if (!req.file?.buffer) {
      throw new Error("CSV file is required");
    }

    // Persist raw CSV as source of truth
    const rawCsvPath = await saveRawFile({
      type: "csv",
      sourceId,
      extension: path.extname(req.file.originalname || ".csv") || ".csv",
      buffer: req.file.buffer,
    });
    
    // Parse CSV data (simplified for now)
    // In a real implementation, you would use a CSV parser like PapaParse or csv-parser
    const csvContent = req.file.buffer.toString("utf8");
    
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

    // Delete old vectors for this source/version before upsert (reindex hygiene)
    await pineconeService.deleteVectors(
      { source_id: sourceId, source_type: "csv", version: job.version || "v1" },
      "qa"
    );

    // Generate embeddings for questions and upsert to Pinecone "qa" namespace
    if (qaPairs.length > 0) {
      const questions = qaPairs.map((qa) => qa.question || "");
      const embeddings = await embeddingService.generateEmbeddingsBatch(questions);

      if (embeddings && embeddings.length === qaPairs.length) {
        const vectors = qaPairs.map((qa, index) => ({
          id: `${sourceId}-${qa.questionHash || index}`,
          values: embeddings[index],
          metadata: {
            question: qa.question,
            answer: qa.answer,
            audience: qa.audience,
            source_type: "csv",
            source_id: sourceId,
            question_hash: qa.questionHash,
            normalized_question: qa.normalizedQuestion,
            tags: qa.tags,
            category: qa.category,
            language: qa.language,
            version: job.version || "v1",
            updated_at: new Date(),
          },
        }));

        await pineconeService.upsertVectors(vectors, "qa");
      } else {
        console.warn("⚠️  Embeddings not generated for all questions; skipping Pinecone upsert.");
      }
    }
    
    // Update job status
    job.status = "indexed";
    job.metadata = {
      ...job.metadata,
      rawPath: rawCsvPath,
    };
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
router.post("/docs", requireAdmin, upload.single("file"), async (req, res) => {
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

    if (!req.file?.buffer) {
      throw new Error("Document file is required");
    }

    // Persist raw document as source of truth
    const rawDocPath = await saveRawFile({
      type: "docs",
      sourceId,
      extension: path.extname(req.file.originalname || ".bin") || ".bin",
      buffer: req.file.buffer,
    });
    
    // Delete old vectors for this source/version before upsert (reindex hygiene)
    await pineconeService.deleteVectors(
      { source_id: sourceId, source_type: "doc", version: job.version || "v1" },
      audience === 'employee' ? 'employee_docs' : 'public_docs'
    );

    // Extract, clean, and chunk the document
    const { chunks, metadata } = await documentProcessor.processDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      { chunkSize: 500, overlap: 50, audience, version: job.version || "v1" }
    );
    
    // Save document chunks to database
    const documentChunks = chunks.map(chunk => ({
      chunkId: `${sourceId}-${chunk.position}`,
      chunkText: chunk.chunkText,
      sourceId: sourceId,
      audience: audience,
      title: metadata.title,
      wordCount: chunk.wordCount,
      headingPath: chunk.metadata?.headingPath,
      page: chunk.metadata?.page,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    await DocumentChunk.insertMany(documentChunks);
    
    // Generate embeddings and store in Pinecone with strict metadata
    if (documentChunks.length > 0) {
      const embeddings = await embeddingService.generateEmbeddingsBatch(
        documentChunks.map((c) => c.chunkText)
      );

      if (embeddings && embeddings.length === documentChunks.length) {
        const vectors = documentChunks.map((chunk, index) => ({
          id: chunk.chunkId,
          values: embeddings[index],
          metadata: {
            text: chunk.chunkText,
            audience: chunk.audience,
            source_type: "doc",
            source_id: sourceId,
            chunk_id: chunk.chunkId,
            title: chunk.title,
            heading_path: chunk.headingPath,
            page: chunk.page,
            version: job.version || "v1",
          }
        }));
        
        // Upsert vectors to Pinecone
        const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
        await pineconeService.upsertVectors(vectors, namespace);
      } else {
        console.warn("⚠️  Embeddings not generated for all document chunks; skipping Pinecone upsert.");
      }
    }
    
    // Update job status
    job.status = "indexed";
    job.metadata = {
      ...job.metadata,
      rawPath: rawDocPath,
    };
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
router.post("/webcrawl", requireAdmin, async (req, res) => {
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

    // Persist raw HTML snapshot
    const rawWebPath = await saveRawFile({
      type: "web",
      sourceId,
      extension: ".html",
      buffer,
    });

    // Delete old vectors for this source/version before upsert (reindex hygiene)
    await pineconeService.deleteVectors(
      { source_id: sourceId, source_type: "web", version: job.version || "v1" },
      audience === 'employee' ? 'employee_docs' : 'public_docs'
    );
    
    // Extract, clean, and chunk the document
    const { chunks, metadata } = await documentProcessor.processDocument(
      buffer,
      'text/html',
      url,
      { chunkSize: 500, overlap: 50, audience, version: job.version || "v1" }
    );
    
    // Save document chunks to database
    const documentChunks = chunks.map(chunk => ({
      chunkId: `${sourceId}-${chunk.position}`,
      chunkText: chunk.chunkText,
      sourceId: sourceId,
      audience: audience,
      title: metadata.title,
      wordCount: chunk.wordCount,
      headingPath: chunk.metadata?.headingPath,
      page: chunk.metadata?.page,
      url: url,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    await DocumentChunk.insertMany(documentChunks);
    
    // Generate embeddings and store in Pinecone with strict metadata
    if (documentChunks.length > 0) {
      const embeddings = await embeddingService.generateEmbeddingsBatch(
        documentChunks.map((c) => c.chunkText)
      );

      if (embeddings && embeddings.length === documentChunks.length) {
        const vectors = documentChunks.map((chunk, index) => ({
          id: chunk.chunkId,
          values: embeddings[index],
          metadata: {
            text: chunk.chunkText,
            audience: chunk.audience,
            source_type: "web",
            source_id: sourceId,
            chunk_id: chunk.chunkId,
            title: chunk.title,
            heading_path: chunk.headingPath,
            page: chunk.page,
            url: url,
            version: job.version || "v1",
          }
        }));
        
        // Upsert vectors to Pinecone
        const namespace = audience === 'employee' ? 'employee_docs' : 'public_docs';
        await pineconeService.upsertVectors(vectors, namespace);
      } else {
        console.warn("⚠️  Embeddings not generated for all web chunks; skipping Pinecone upsert.");
      }
    }
    
    // Update job status
    job.status = "indexed";
    job.metadata = {
      ...job.metadata,
      rawPath: rawWebPath,
    };
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