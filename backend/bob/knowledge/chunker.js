import crypto from 'node:crypto';

/**
 * Deterministic Semantic Text Chunker
 * 
 * Target size: 1000 - 1600 characters per chunk
 * Overlap: 150 - 250 characters
 * 
 * Prioritizes semantic boundaries:
 * 1. Double line break (paragraphs, sections)
 * 2. Single line break (list items, headings)
 * 3. Sentence end (.!?)
 * 4. Word boundary (space)
 * 
 * Never splits sentences or words abruptly unless an individual token exceeds max chunk size.
 * 
 * @param {string} text Normalized text to split
 * @param {object} options
 * @param {string} options.sourceId Source identifier
 * @param {string} options.language Language tag ('es', 'en', 'unknown')
 * @param {string} [options.section] Section name or title
 * @param {number} [options.minChars=800]
 * @param {number} [options.maxChars=1600]
 * @param {number} [options.overlapChars=200]
 * @returns {Array<object>} Array of structured chunks
 */
export function chunkText(text, options = {}) {
  const {
    sourceId = 'unknown-source',
    language = 'unknown',
    section = 'general',
    minChars = 800,
    maxChars = 1600,
    overlapChars = 200
  } = options;

  if (!text || typeof text !== 'string') {
    return [];
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [];
  }

  // If text is smaller than or equal to maxChars, return as a single clean chunk
  if (trimmed.length <= maxChars) {
    const chunkId = generateChunkId(sourceId, section, 0, trimmed);
    return [{
      chunk_id: chunkId,
      source_id: sourceId,
      chunk_index: 0,
      language,
      section,
      text: trimmed,
      char_count: trimmed.length,
      previous_chunk_id: null,
      next_chunk_id: null
    }];
  }

  // Break text into paragraphs/blocks
  const paragraphs = trimmed.split(/\n\n+/);
  const rawChunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;

    if (!currentChunk) {
      if (p.length > maxChars) {
        // Break large paragraph by sentences
        const subChunks = splitBySentences(p, maxChars, overlapChars);
        rawChunks.push(...subChunks);
      } else {
        currentChunk = p;
      }
    } else if (currentChunk.length + p.length + 2 <= maxChars) {
      currentChunk += '\n\n' + p;
    } else {
      // Current chunk is full
      rawChunks.push(currentChunk);

      // Carry overlap if feasible
      const overlapText = getOverlap(currentChunk, overlapChars);
      if (overlapText && (overlapText.length + p.length + 2 <= maxChars)) {
        currentChunk = overlapText + '\n\n' + p;
      } else {
        if (p.length > maxChars) {
          const subChunks = splitBySentences(p, maxChars, overlapChars);
          rawChunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = p;
        }
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    rawChunks.push(currentChunk.trim());
  }

  // Build final structured chunks with deterministic IDs and bidirectional links
  const result = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const chunkContent = rawChunks[i].trim();
    const chunkId = generateChunkId(sourceId, section, i, chunkContent);

    result.push({
      chunk_id: chunkId,
      source_id: sourceId,
      chunk_index: i,
      language,
      section,
      text: chunkContent,
      char_count: chunkContent.length,
      previous_chunk_id: null, // linked below
      next_chunk_id: null
    });
  }

  // Link previous and next chunks
  for (let i = 0; i < result.length; i++) {
    if (i > 0) result[i].previous_chunk_id = result[i - 1].chunk_id;
    if (i < result.length - 1) result[i].next_chunk_id = result[i + 1].chunk_id;
  }

  return result;
}

/**
 * Generate a deterministic chunk ID based on sourceId, section, index, and content fingerprint
 */
export function generateChunkId(sourceId, section, index, content) {
  const contentFingerprint = crypto.createHash('sha256').update(content).digest('hex').substring(0, 12);
  const normalizedSection = section.toLowerCase().replace(/[^a-z0-9_-]/g, '-').substring(0, 24);
  return `${sourceId}-${normalizedSection}-${index}-${contentFingerprint}`;
}

/**
 * Deterministic Section-Aware Markdown Chunker
 * 
 * Preserves document hierarchy (# Title, ## Section) without splitting
 * across headings or mixing distinct semantic topics.
 * 
 * @param {string} text Raw markdown text
 * @param {object} options
 * @param {string} options.sourceId Source identifier
 * @param {string} [options.documentTitle] Document title
 * @param {number} [options.maxChars=1600]
 * @param {number} [options.overlapChars=200]
 * @returns {Array<object>} Array of structured chunks
 */
export function chunkMarkdown(text, options = {}) {
  const {
    sourceId = 'unknown-source',
    documentTitle = 'Documento',
    maxChars = 1600,
    overlapChars = 200
  } = options;

  if (!text || typeof text !== 'string') {
    return [];
  }

  const lines = text.split('\n');
  let docTitle = documentTitle;
  const sections = [];
  let currentHeading = '';
  let currentLines = [];

  for (const line of lines) {
    if (line.match(/^#\s+/)) {
      docTitle = line.replace(/^#\s+/, '').trim();
    } else if (line.match(/^##\s+/)) {
      if (currentHeading || currentLines.length > 0) {
        sections.push({
          rawHeading: currentHeading,
          text: currentLines.join('\n').trim()
        });
      }
      currentHeading = line.replace(/^##\s+/, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentHeading || currentLines.length > 0) {
    sections.push({
      rawHeading: currentHeading,
      text: currentLines.join('\n').trim()
    });
  }

  function detectSectionLanguage(heading, txt) {
    const combined = `${heading} ${txt}`.toLowerCase();
    if (combined.includes('canonical english') || combined.includes('english summaries')) {
      return 'en';
    }
    const esMatches = (combined.match(/\b(el|la|los|las|de|en|y|que|es|un|una|para|con|por|este|esta|como|nuestro|nuestra)\b/g) || []).length;
    const enMatches = (combined.match(/\b(the|and|is|in|of|to|a|for|with|this|that|as|how|are|our|we)\b/g) || []).length;
    if (enMatches > esMatches * 1.5 && enMatches > 10) {
      return 'en';
    }
    return 'es';
  }

  const rawChunks = [];
  let chunkIdx = 0;

  for (const sec of sections) {
    const trimmedText = sec.text ? sec.text.trim() : '';
    if (!trimmedText && !sec.rawHeading) continue;

    // Clean section heading by stripping leading numbers (e.g., '9. Bop CRM' -> 'Bop CRM')
    let cleanSection = sec.rawHeading ? sec.rawHeading.replace(/^\d+\.\s*/, '').trim() : 'Introducción';
    if (!cleanSection) cleanSection = 'Introducción';

    const sectionPath = `${docTitle} > ${cleanSection}`;
    const lang = detectSectionLanguage(cleanSection, trimmedText);

    // If section fits completely into maxChars, create a single chunk
    if (trimmedText.length <= maxChars) {
      const chunkId = generateChunkId(sourceId, cleanSection, chunkIdx, trimmedText);
      rawChunks.push({
        chunk_id: chunkId,
        source_id: sourceId,
        chunk_index: chunkIdx++,
        language: lang,
        section: cleanSection,
        section_path: sectionPath,
        text: trimmedText,
        char_count: trimmedText.length,
        previous_chunk_id: null,
        next_chunk_id: null
      });
    } else {
      // Split larger section into paragraphs/sentences without crossing outside this section
      const paragraphs = trimmedText.split(/\n\n+/);
      const subChunks = [];
      let cur = '';

      for (const para of paragraphs) {
        const p = para.trim();
        if (!p) continue;

        if (!cur) {
          if (p.length > maxChars) {
            subChunks.push(...splitBySentences(p, maxChars, overlapChars));
          } else {
            cur = p;
          }
        } else if (cur.length + p.length + 2 <= maxChars) {
          cur += '\n\n' + p;
        } else {
          subChunks.push(cur);
          const overlap = getOverlap(cur, overlapChars);
          if (overlap && (overlap.length + p.length + 2 <= maxChars)) {
            cur = `${overlap}\n\n${p}`;
          } else {
            if (p.length > maxChars) {
              subChunks.push(...splitBySentences(p, maxChars, overlapChars));
              cur = '';
            } else {
              cur = p;
            }
          }
        }
      }

      if (cur.trim().length > 0) {
        subChunks.push(cur.trim());
      }

      for (let s = 0; s < subChunks.length; s++) {
        const subContent = subChunks[s].trim();
        const chunkId = generateChunkId(sourceId, cleanSection, chunkIdx, subContent);
        rawChunks.push({
          chunk_id: chunkId,
          source_id: sourceId,
          chunk_index: chunkIdx++,
          language: lang,
          section: cleanSection,
          section_path: sectionPath,
          text: subContent,
          char_count: subContent.length,
          previous_chunk_id: null,
          next_chunk_id: null
        });
      }
    }
  }

  // Bidirectional linking
  for (let i = 0; i < rawChunks.length; i++) {
    if (i > 0) rawChunks[i].previous_chunk_id = rawChunks[i - 1].chunk_id;
    if (i < rawChunks.length - 1) rawChunks[i].next_chunk_id = rawChunks[i + 1].chunk_id;
  }

  return rawChunks;
}

export function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

export function chunkDocument(doc, options = {}) {
  const text = doc.normalizedText || doc.text || '';
  const chunks = chunkText(text, {
    sourceId: doc.sourceId || doc.source_id,
    language: doc.language || 'es',
    section: doc.section || doc.category || 'general',
    minChars: options.targetMinChars || options.minChars || 800,
    maxChars: options.targetMaxChars || options.maxChars || 1600,
    overlapChars: options.overlapChars || 200
  });

  return chunks.map(c => ({
    ...c,
    content: c.text,
    content_hash: crypto.createHash('sha256').update(c.text).digest('hex').substring(0, 16),
    estimated_tokens: estimateTokenCount(c.text)
  }));
}

/**
 * Extract trailing overlap from text respecting word boundaries
 */
function getOverlap(text, maxOverlap) {
  if (text.length <= maxOverlap) return '';
  const slice = text.slice(-maxOverlap);
  const firstSpace = slice.indexOf(' ');
  if (firstSpace > -1 && firstSpace < slice.length - 10) {
    return slice.slice(firstSpace + 1).trim();
  }
  return slice.trim();
}

/**
 * Split a large block of text by sentence boundaries (.!?)
 */
function splitBySentences(text, maxChars, overlapChars) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  const chunks = [];
  let cur = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if (!cur) {
      cur = trimmed;
    } else if (cur.length + trimmed.length + 1 <= maxChars) {
      cur += ' ' + trimmed;
    } else {
      chunks.push(cur);
      const overlap = getOverlap(cur, overlapChars);
      cur = overlap ? `${overlap} ${trimmed}` : trimmed;
    }
  }

  if (cur.trim().length > 0) {
    chunks.push(cur.trim());
  }

  return chunks;
}
