/**
 * Format citation labels and source provenance for search results
 */

/**
 * Build a human-friendly citation object for a retrieved chunk
 * @param {object} chunk
 * @param {object} source
 * @returns {{ label: string, source: string, section?: string, url?: string }}
 */
export function buildCitation(chunk, source = {}) {
  const isWebsite = chunk.source_id?.startsWith('website-') || source.source_type === 'website';
  const section = chunk.section || source.section || 'General';

  let label;
  if (isWebsite) {
    if (chunk.source_id.includes('services')) {
      label = chunk.language === 'en' ? 'Bop Agencia — Services' : 'Bop Agencia — Servicios';
    } else if (chunk.source_id.includes('universe')) {
      label = 'Bop Agencia — BOP Universe';
    } else if (chunk.source_id.includes('live')) {
      label = 'Bop Agencia — BOP Live';
    } else if (chunk.source_id.includes('ai')) {
      label = chunk.language === 'en' ? 'Bop Agencia — Applied AI' : 'Bop Agencia — Inteligencia Artificial';
    } else if (chunk.source_id.includes('contact')) {
      label = chunk.language === 'en' ? 'Bop Agencia — Contact' : 'Bop Agencia — Contacto';
    } else if (chunk.source_id.includes('portfolio')) {
      label = chunk.language === 'en' ? 'Bop Agencia — Portfolio' : 'Bop Agencia — Portafolio';
    } else {
      label = source.title || `Bop Agencia — ${section}`;
    }
  } else {
    if (section && section !== 'General' && section !== 'document' && section !== source.title) {
      label = `Bop Agencia Knowledge — ${section}`;
    } else {
      label = source.title || source.source_name || `Documento — ${section}`;
    }
  }

  return {
    label,
    source: source.source_type || (isWebsite ? 'website' : 'document'),
    section,
    source_id: chunk.source_id
  };
}

/**
 * Extract a clean, safe snippet centered on relevant query keywords
 * @param {string} text
 * @param {string[]} keywords
 * @param {number} [maxLength=220]
 * @returns {string}
 */
export function buildSnippet(text, keywords = [], maxLength = 220) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;

  // Find position of the first keyword match
  const lower = clean.toLowerCase();
  let bestIdx = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }

  if (bestIdx === -1 || bestIdx < 40) {
    return clean.substring(0, maxLength).trim() + '...';
  }

  const start = Math.max(0, bestIdx - 40);
  const end = Math.min(clean.length, start + maxLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';

  return prefix + clean.substring(start, end).trim() + suffix;
}
