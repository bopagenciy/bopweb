import fs from 'node:fs/promises';
import { extractText } from 'unpdf';

/**
 * Local PDF text extractor using unpdf (PDF.js modern isomorphic wrapper)
 * No OCR / Zero Cloud / No external services
 * If text cannot be extracted or is empty, marks needsOcr: true
 * @param {string} filePath Absolute path to PDF file
 * @returns {Promise<{ text: string, pageCount: number, needsOcr: boolean }>}
 */
export async function parsePdfBuffer(buffer) {
  // unpdf checks: if (Buffer.isBuffer(data)) throw new Error('Please provide binary data as Uint8Array, rather than Buffer.')
  // In Node.js, Buffer extends Uint8Array so `new Uint8Array(buffer)` retains Buffer prototype if not carefully created.
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  try {
    const { text, totalPages } = await extractText(uint8);
    const pageCount = Number(totalPages) || 1;
    
    // unpdf returns an array of strings, one per page
    const pagesText = Array.isArray(text) ? text : [String(text || '')];
    const fullText = pagesText.join('\n\n').trim();
    
    // If the PDF has pages but contains no extractable alphanumeric characters,
    // it is likely an image-only / scanned PDF that requires OCR.
    const alphanumericCount = (fullText.match(/[a-zA-Z0-9\u00C0-\u017F]/g) || []).length;
    const needsOcr = alphanumericCount < 10;

    return {
      format: 'pdf',
      text: fullText,
      pageCount,
      needsOcr
    };
  } catch (err) {
    throw new Error(`PDF_PARSE_FAILED: ${err.message}`);
  }
}

export async function parsePdf(filePath) {
  const buffer = await fs.readFile(filePath);
  return parsePdfBuffer(buffer);
}
