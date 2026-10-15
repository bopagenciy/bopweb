import fs from 'node:fs/promises';
import mammoth from 'mammoth';

/**
 * Local DOCX text extractor using mammoth
 * Zero Cloud / Pure local Word text extraction
 * @param {string} filePath Absolute path to DOCX file
 * @returns {Promise<{ text: string, pageCount: number, needsOcr: boolean }>}
 */
export async function parseDocxBuffer(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const fullText = (result.value || '').trim();
    const alphanumericCount = (fullText.match(/[a-zA-Z0-9\u00C0-\u017F]/g) || []).length;
    const needsOcr = alphanumericCount === 0;

    return {
      text: fullText,
      pageCount: 1,
      needsOcr
    };
  } catch (err) {
    throw new Error(`DOCX_PARSE_FAILED: ${err.message}`);
  }
}

export async function parseDocx(filePath) {
  const buffer = await fs.readFile(filePath);
  return parseDocxBuffer(buffer);
}
