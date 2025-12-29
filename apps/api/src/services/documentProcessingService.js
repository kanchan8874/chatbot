// Document processing service for extracting, cleaning, and chunking text
// Simplified version to avoid complex dependencies

class DocumentProcessingService {
  /**
   * Extract text from different document types
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type of the file
   * @param {string} filename - Name of the file
   * @returns {Promise<{text: string, metadata: object}>} Extracted text and metadata
   */
  async extractText(buffer, mimeType, filename) {
    try {
      let text = '';
      let metadata = {
        title: filename,
        mimeType: mimeType,
        pageCount: null,
        wordCount: null
      };

      switch (mimeType) {
        case 'application/pdf':
          // For now, we'll just convert PDF to text as a string
          // In a production environment, you would use a proper PDF parser
          text = buffer.toString('utf-8');
          console.warn("PDF parsing is simplified. In production, use a proper PDF parser.");
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          // For now, we'll just convert Word docs to text as a string
          // In a production environment, you would use a proper Word parser
          text = buffer.toString('utf-8');
          console.warn("Word document parsing is simplified. In production, use a proper Word parser.");
          break;

        case 'text/html':
          // For HTML content, extract text content
          text = this.extractTextFromHTML(buffer.toString());
          metadata.title = this.extractTitleFromHTML(buffer.toString()) || filename;
          break;

        case 'text/plain':
        default:
          text = buffer.toString();
          break;
      }

      // Calculate word count
      metadata.wordCount = text.split(/\s+/).length;

      return { text, metadata };
    } catch (error) {
      console.error('Error extracting text:', error.message);
      throw new Error(`Failed to extract text from document: ${error.message}`);
    }
  }

  /**
   * Extract text content from HTML
   * @param {string} html - HTML content
   * @returns {string} Extracted text
   */
  extractTextFromHTML(html) {
    // Simple regex-based approach to extract text from HTML
    // In production, use a proper HTML parser like cheerio or jsdom
    
    // Remove script and style tags
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove all HTML tags
    let text = html.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    
    return text;
  }

  /**
   * Extract title from HTML
   * @param {string} html - HTML content
   * @returns {string|null} Extracted title
   */
  extractTitleFromHTML(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  /**
   * Clean text by removing boilerplate and junk
   * @param {string} text - Raw text to clean
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text) return '';

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ');

    // Remove common boilerplate/footer patterns
    const boilerplatePatterns = [
      /\b(all rights reserved|copyright\s*\d{4}|terms of use|privacy policy)\b/gi,
      /\b(page\s+\d+\s+of\s+\d+)\b/gi,
      /\b(footer|header)\b/gi,
      /\b(nav|navigation|menu)\b/gi,
      /\b(cookie policy|accept cookies)\b/gi,
    ];

    boilerplatePatterns.forEach(pattern => {
      text = text.replace(pattern, '');
    });

    // Remove duplicate paragraphs (simple approach)
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    const uniqueParagraphs = [...new Set(paragraphs)];
    text = uniqueParagraphs.join('\n');

    // Trim and clean up
    text = text.trim();

    return text;
  }

  /**
   * Split text into chunks with overlap
   * @param {string} text - Text to chunk
   * @param {object} options - Chunking options
   * @param {number} options.chunkSize - Target chunk size in tokens/words
   * @param {number} options.overlap - Overlap between chunks
   * @param {string} options.separator - Separator for splitting
   * @returns {Array<string>} Array of text chunks
   */
  chunkText(text, options = {}) {
    const {
      chunkSize = 300,
      overlap = 50,
      separator = '\n\n'
    } = options;

    if (!text) return [];

    // Split by paragraphs first
    let chunks = [];
    const paragraphs = text.split(separator).filter(p => p.trim().length > 0);

    // Combine paragraphs into chunks
    let currentChunk = '';
    let currentLength = 0;

    for (const paragraph of paragraphs) {
      const paraLength = paragraph.split(/\s+/).length;

      // If adding this paragraph would exceed chunk size, save current chunk
      if (currentLength + paraLength > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        // Reset with overlap
        currentChunk = '';
        currentLength = 0;
      }

      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += separator + paragraph;
      } else {
        currentChunk = paragraph;
      }
      currentLength += paraLength;
    }

    // Add the last chunk if it exists
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Process a complete document: extract -> clean -> chunk
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} filename - Filename
   * @param {object} chunkOptions - Chunking options
   * @returns {Promise<{chunks: Array<object>, metadata: object}>} Processed chunks and metadata
   */
  async processDocument(buffer, mimeType, filename, chunkOptions = {}) {
    try {
      // Step 1: Extract text
      const { text, metadata } = await this.extractText(buffer, mimeType, filename);
      
      // Step 2: Clean text
      const cleanedText = this.cleanText(text);
      
      // Step 3: Chunk text
      const textChunks = this.chunkText(cleanedText, chunkOptions);
      
      // Step 4: Create chunk objects with metadata
      const chunks = textChunks.map((chunkText, index) => ({
        chunkId: `${filename}-chunk-${index}`,
        chunkText: chunkText,
        sourceId: filename,
        position: index,
        wordCount: chunkText.split(/\s+/).length,
        metadata: {
          ...metadata,
          chunkIndex: index,
          totalChunks: textChunks.length
        }
      }));

      return { chunks, metadata };
    } catch (error) {
      console.error('Error processing document:', error.message);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new DocumentProcessingService();