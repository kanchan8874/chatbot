/**
 * Response Formatter Utility
 * Formats chatbot responses into clean, structured, readable chunks
 * Following Kenyt AI chat UI style: short sections, bullet points, multiple bubbles
 */

/**
 * Split text into sentences
 */
function splitIntoSentences(text) {
  if (!text) return [];
  // Split by sentence endings (. ! ?) but preserve them
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

/**
 * Check if text is too long for a single bubble (more than 3-5 lines)
 */
function isTooLong(text, maxLines = 5, charsPerLine = 60) {
  const estimatedLines = Math.ceil(text.length / charsPerLine);
  return estimatedLines > maxLines;
}

/**
 * Extract bullet points from text
 */
function extractBulletPoints(text) {
  const bulletPatterns = [
    /^[\s]*[•\-\*]\s+(.+)$/gm,  // • - *
    /^[\s]*\d+[\.\)]\s+(.+)$/gm, // 1. 1)
    /^[\s]*[a-z][\.\)]\s+(.+)$/gm, // a. a)
  ];
  
  const bullets = [];
  for (const pattern of bulletPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      bullets.push(...matches.map(m => m.replace(/^[\s]*[•\-\*\d\.\)a-z]\s+/, '').trim()));
    }
  }
  
  return bullets.length > 0 ? bullets : null;
}

/**
 * Format response into structured chunks
 * Returns array of formatted message chunks
 */
function formatResponse(responseText, options = {}) {
  const {
    maxLinesPerBubble = 5,
    charsPerLine = 60,
    enableShowMore = false, // Disabled - removed show more functionality
    showMoreThreshold = 15, // lines
  } = options;

  if (!responseText || !responseText.trim()) {
    return [{ type: 'text', content: responseText || '' }];
  }

  const trimmed = responseText.trim();
  const chunks = [];

  // Check if response is very long (needs "Show more")
  const estimatedLines = Math.ceil(trimmed.length / charsPerLine);
  const needsShowMore = enableShowMore && estimatedLines > showMoreThreshold;

  // Try to extract structured format (title, bullets, summary)
  const lines = trimmed.split('\n').filter(l => l.trim());
  
  // Check for structured format patterns
  let title = null;
  let bullets = [];
  let summary = null;
  let mainContent = [];

  // Pattern 1: Title on first line, then bullets, then summary
  if (lines.length >= 3) {
    const firstLine = lines[0].trim();
    // Check if first line looks like a title (short, no period, might be bold/uppercase)
    if (firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.endsWith('!') && !firstLine.endsWith('?')) {
      title = firstLine;
      
      // Extract bullets from middle lines
      const middleLines = lines.slice(1, -1);
      const extractedBullets = extractBulletPoints(middleLines.join('\n'));
      if (extractedBullets && extractedBullets.length > 0) {
        bullets = extractedBullets;
        summary = lines[lines.length - 1].trim();
      } else {
        // No bullets found, treat as regular content
        mainContent = lines;
        title = null;
      }
    }
  }

  // If structured format detected, format accordingly
  if (title && bullets.length > 0 && summary) {
    // Chunk 1: Title + greeting
    chunks.push({
      type: 'structured',
      title: title,
      greeting: `Here's information about ${title.toLowerCase()}:`,
    });

    // Chunk 2: Bullet points (split if too many)
    const maxBulletsPerChunk = 4;
    for (let i = 0; i < bullets.length; i += maxBulletsPerChunk) {
      const bulletChunk = bullets.slice(i, i + maxBulletsPerChunk);
      chunks.push({
        type: 'bullets',
        items: bulletChunk,
      });
    }

    // Chunk 3: Summary
    if (summary) {
      chunks.push({
        type: 'text',
        content: summary,
      });
    }

    return chunks;
  }

  // Fallback: Smart text splitting
  // Split by paragraphs first
  const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim());
  
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    // Check if paragraph has bullets
    const paragraphBullets = extractBulletPoints(paragraph);
    if (paragraphBullets && paragraphBullets.length > 0) {
      // Format as bullet list
      const maxBulletsPerChunk = 4;
      for (let i = 0; i < paragraphBullets.length; i += maxBulletsPerChunk) {
        chunks.push({
          type: 'bullets',
          items: paragraphBullets.slice(i, i + maxBulletsPerChunk),
        });
      }
      continue;
    }

    // Regular paragraph - split if too long
    if (isTooLong(paragraph, maxLinesPerBubble, charsPerLine)) {
      // Split into sentences
      const sentences = splitIntoSentences(paragraph);
      let currentChunk = '';

      for (const sentence of sentences) {
        const testChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        
        if (isTooLong(testChunk, maxLinesPerBubble, charsPerLine) && currentChunk) {
          // Save current chunk
          chunks.push({
            type: 'text',
            content: currentChunk.trim(),
          });
          currentChunk = sentence;
        } else {
          currentChunk = testChunk;
        }
      }

      // Add remaining chunk
      if (currentChunk.trim()) {
        chunks.push({
          type: 'text',
          content: currentChunk.trim(),
        });
      }
    } else {
      // Short enough for single bubble
      chunks.push({
        type: 'text',
        content: paragraph.trim(),
      });
    }
  }

  // If no chunks created, add the whole text
  if (chunks.length === 0) {
    chunks.push({
      type: 'text',
      content: trimmed,
    });
  }

  // Add "Show more" metadata if needed
  if (needsShowMore && chunks.length > 0) {
    chunks[0].showMore = true;
    chunks[0].fullContent = trimmed;
    // Truncate first chunk for preview
    const previewLength = showMoreThreshold * charsPerLine;
    if (chunks[0].content && chunks[0].content.length > previewLength) {
      chunks[0].previewContent = chunks[0].content.substring(0, previewLength) + '...';
    }
  }

  return chunks;
}

/**
 * Format response for API response
 * Returns formatted response object with chunks array
 */
function formatResponseForAPI(responseText, options = {}) {
  const chunks = formatResponse(responseText, options);
  
  return {
    formatted: true,
    chunks: chunks,
    originalText: responseText,
  };
}

module.exports = {
  formatResponse,
  formatResponseForAPI,
  isTooLong,
  extractBulletPoints,
};
