import fs from 'node:fs/promises';

/**
 * Native Node.js parser for UTF-8 Plain Text and Markdown files
 * @param {string} filePath Absolute path to text file
 * @returns {Promise<{ text: string, pageCount: number, needsOcr: boolean }>}
 */
import path from 'node:path';

export async function parseTxt(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const text = content.replace(/^\uFEFF/, ''); // Strip BOM if present
  const needsOcr = text.trim().length === 0;
  const ext = path.extname(filePath).toLowerCase().replace('.', '');

  return {
    format: ext === 'md' ? 'md' : 'txt',
    text,
    pageCount: 1,
    needsOcr
  };
}
