/**
 * Tokenizer with Brand Term Preservation and Canonical Folding
 * 
 * Rules:
 * - Preserves compound brand phrases: 'bop agencia', 'bop universe', 'bop live', 'bop fusion',
 *   'bop crm', 'bop erp', 'bop rh', 'bop social', 'bob'
 * - Unicode normalization NFKC
 * - Strips punctuation while keeping hyphens inside alphanumeric words
 * - Removes accents/tildes optionally for canonical comparison (e.g., 'diseño' -> 'diseno')
 */

/**
 * Remove diacritics / accents for canonical matching
 * @param {string} str
 * @returns {string}
 */
export function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Tokenize a text string into an array of lowercase tokens
 * @param {string} text
 * @param {object} options
 * @param {boolean} [options.foldDiacritics=false]
 * @returns {string[]}
 */
export function tokenize(text, options = {}) {
  if (!text || typeof text !== 'string') return [];

  let cleaned = text.normalize('NFKC').toLowerCase();
  if (options.foldDiacritics) {
    cleaned = removeDiacritics(cleaned);
  }

  // Replace punctuation characters with space, preserving alphanumeric
  const tokens = cleaned
    .replace(/[^\p{L}\p{N}+_]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0);

  return tokens;
}
