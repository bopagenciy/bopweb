import { tokenize, removeDiacritics } from './tokenizer.js';
import { ES_STOPWORDS } from './stopwords/es.js';
import { EN_STOPWORDS } from './stopwords/en.js';

export const MAX_QUERY_LENGTH = 500;

// Protected Brand and High-Signal Terms that must NEVER be stripped
export const PROTECTED_TERMS = new Set([
  'bop',
  'bob',
  'agencia',
  'universe',
  'fusion',
  'live',
  'crm',
  'erp',
  'rh',
  'social',
  'clients',
  'chatbot',
  'market',
  'reels',
  'studio',
  'umbrella',
  'core',
  'hospitality',
  'restaurante',
  'restaurantes',
  'supermercado',
  'supermercados',
  'retail',
  'prospectos',
  'ia',
  'ai',
  'branding',
  'stands',
  'stand',
  'portfolio',
  'email',
  'correo',
  'whatsapp',
  'contacto',
  'contact'
]);

/**
 * Normalize and validate a search query
 * 
 * @param {string} rawQuery User search query
 * @param {string} [language='es'] 'es' or 'en'
 * @returns {{ valid: boolean, error?: string, normalizedQuery: string, tokens: string[], keywords: string[], phrases: string[] }}
 */
export function normalizeQuery(rawQuery, language = 'es') {
  if (typeof rawQuery !== 'string') {
    return { valid: false, error: 'QUERY_NOT_A_STRING' };
  }

  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'QUERY_EMPTY' };
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: 'QUERY_TOO_LONG' };
  }

  const lang = (language || 'es').toLowerCase();
  const stopwords = lang === 'en' ? EN_STOPWORDS : ES_STOPWORDS;

  // 1. Lowercase and normalize whitespace
  const normalizedQuery = trimmed.replace(/\s+/g, ' ');

  // 2. Extract significant phrases (e.g., "bop fusion", "bop live", "bop universe", "bop agencia")
  const phrases = [];
  const lowerNormalized = normalizedQuery.toLowerCase();
  const brandCombos = [
    'bop agencia',
    'bop universe',
    'bop live',
    'bop fusion',
    'bop crm',
    'bop clients',
    'bop erp',
    'bop rh',
    'bop social',
    'bop chatbot',
    'bop market',
    'bop reels studio',
    'bop reels',
    'bop umbrella',
    'bop core',
    'bop assistant',
    'inteligencia artificial',
    'artificial intelligence',
    'stands comerciales',
    'commercial stands',
    'artes graficos',
    'artes gráficos',
    'graphic art',
    'diseno web',
    'diseño web',
    'web design'
  ];

  for (const combo of brandCombos) {
    if (lowerNormalized.includes(combo) || removeDiacritics(lowerNormalized).includes(removeDiacritics(combo))) {
      phrases.push(combo);
    }
  }

  // Dynamic phrase matching for any "bop <word>" pattern (e.g., "bop clients", "bop chatbot")
  const bopMatches = lowerNormalized.match(/\bbop\s+([a-z0-9]+(?:\s+[a-z0-9]+)?)\b/g);
  if (bopMatches) {
    for (const match of bopMatches) {
      if (!phrases.includes(match)) {
        phrases.push(match);
      }
    }
  }

  // Standalone high-signal entity triggers
  if (/\bbob\b/i.test(normalizedQuery) && !phrases.includes('bob')) {
    phrases.push('bob');
  }
  if (/conecta|conectan|conectar/i.test(normalizedQuery)) {
    phrases.push('como se conectan');
  }
  if (/restaurante|restaurantes/i.test(normalizedQuery)) {
    phrases.push('restaurante');
    phrases.push('restaurantes');
  }
  if (/supermercado|supermercados/i.test(normalizedQuery)) {
    phrases.push('supermercado');
    phrases.push('supermercados');
  }

  // 3. Tokenize query
  const rawTokens = tokenize(normalizedQuery, { foldDiacritics: false });
  const foldedTokens = tokenize(normalizedQuery, { foldDiacritics: true });

  // 4. Filter stopwords unless protected term
  const keywords = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const folded = foldedTokens[i];
    if (PROTECTED_TERMS.has(token) || PROTECTED_TERMS.has(folded)) {
      keywords.push(token);
    } else if (!stopwords.has(token) && !stopwords.has(folded) && token.length > 1) {
      keywords.push(token);
    }
  }

  // If all tokens were stopwords (e.g. "que es"), fall back to raw tokens to avoid empty search
  const effectiveKeywords = keywords.length > 0 ? keywords : rawTokens;

  return {
    valid: true,
    normalizedQuery,
    rawTokens,
    tokens: foldedTokens,
    keywords: effectiveKeywords,
    phrases
  };
}
