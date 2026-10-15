/**
 * BOP AGENCIA — TEXT NORMALIZER
 * 
 * Rules:
 * 1. Normalize line endings to LF (\n).
 * 2. Strip harmful non-printable control characters (except \n, \r, \t).
 * 3. Collapse horizontal whitespace (tabs, consecutive spaces) into single spaces.
 * 4. Collapse excessive consecutive line breaks (3+ into max 2).
 * 5. Trim lines and trim overall document.
 * 6. PRESERVE: casing, numbers, punctuation, email addresses, phone numbers (+57 305 417 6606),
 *    URLs, accents, tildes (ñ, á, é, í, ó, ú), BOP brand names.
 * 7. NO summarization, NO translation, NO rewriting, NO content alteration.
 */

export function normalizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    // Normalize CRLF to LF
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove control characters except newline and tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize non-breaking spaces and zero-width spaces
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Replace tabs with a space
    .replace(/\t/g, ' ')
    // Collapse horizontal whitespace within each line
    .replace(/[ ]{2,}/g, ' ')
    // Split lines, trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Collapse 3 or more consecutive line breaks into 2 (one empty line between paragraphs)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
