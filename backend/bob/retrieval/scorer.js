import { tokenize, removeDiacritics } from './tokenizer.js';

/**
 * Deterministic Lexical BM25 & Field-Boost Scorer
 * 
 * Hyperparameters:
 * - k1 = 1.2 (term frequency saturation)
 * - b = 0.75 (length normalization)
 * 
 * Boosts:
 * - Exact phrase match in body: +10.0
 * - Exact phrase match in title / section: +15.0
 * - Token match in title / section: +3.0 per keyword
 * - Language match: 2.0x multiplier (cross-language penalized 0.4x)
 */

export class BM25Scorer {
  /**
   * @param {Array<object>} chunks
   * @param {Map<string, object>} sourcesMap
   */
  constructor(chunks = [], sourcesMap = new Map()) {
    this.k1 = 1.2;
    this.b = 0.75;
    this.chunks = chunks;
    this.sourcesMap = sourcesMap;

    this.docCount = chunks.length;
    this.docTokens = new Map();
    this.docFoldedTokens = new Map();
    this.docLengths = new Map();
    this.docFrequencies = new Map(); // term -> number of docs containing term
    this.totalLength = 0;

    this._buildIndex();
  }

  _buildIndex() {
    this.totalLength = 0;
    this.docFrequencies.clear();

    for (const chunk of this.chunks) {
      const source = this.sourcesMap.get(chunk.source_id) || {};
      const fullContent = `${source.title || ''} ${chunk.section || ''} ${chunk.text || ''}`;

      const tokens = tokenize(fullContent, { foldDiacritics: false });
      const foldedTokens = tokenize(fullContent, { foldDiacritics: true });

      this.docTokens.set(chunk.chunk_id, tokens);
      this.docFoldedTokens.set(chunk.chunk_id, foldedTokens);
      this.docLengths.set(chunk.chunk_id, foldedTokens.length);
      this.totalLength += foldedTokens.length;

      const uniqueTerms = new Set(foldedTokens);
      for (const term of uniqueTerms) {
        this.docFrequencies.set(term, (this.docFrequencies.get(term) || 0) + 1);
      }
    }

    this.avgDocLength = this.docCount > 0 ? this.totalLength / this.docCount : 1;
  }

  /**
   * Calculate IDF for a given term
   */
  idf(term) {
    const df = this.docFrequencies.get(term) || 0;
    // Standard Lucene/BM25 smoothed IDF formula
    return Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));
  }

  /**
   * Score a specific chunk against normalized query parameters
   * 
   * @param {object} chunk
   * @param {object} queryParams
   * @param {string[]} queryParams.keywords
   * @param {string[]} queryParams.phrases
   * @param {string} queryParams.language 'es' or 'en'
   * @returns {{ score: number, bm25Score: number, phraseBoost: number, fieldBoost: number, langMultiplier: number }}
   */
  scoreChunk(chunk, queryParams) {
    const { keywords = [], phrases = [], language = 'es' } = queryParams;
    const source = this.sourcesMap.get(chunk.source_id) || {};
    const docFolded = this.docFoldedTokens.get(chunk.chunk_id) || [];
    const docLen = this.docLengths.get(chunk.chunk_id) || 1;

    // 1. BM25 Score across keywords
    let bm25Score = 0;
    const termFreqs = new Map();
    for (const t of docFolded) {
      termFreqs.set(t, (termFreqs.get(t) || 0) + 1);
    }

    const foldedKeywords = keywords.map(k => removeDiacritics(k.toLowerCase()));

    for (const term of foldedKeywords) {
      const tf = termFreqs.get(term) || 0;
      if (tf > 0) {
        const idfVal = this.idf(term);
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        bm25Score += idfVal * (numerator / denominator);
      }
    }

    // 2. Exact Phrase Match Boost
    let phraseBoost = 0;
    const lowerBody = (chunk.text || '').toLowerCase();
    const lowerTitle = (source.title || '').toLowerCase();
    const lowerSection = (chunk.section || '').toLowerCase();

    // Section alias generation for exact section resolution
    const sectionAliases = [lowerSection, removeDiacritics(lowerSection)];
    if (lowerSection.includes(' / ')) {
      const parts = lowerSection.split(' / ').map(p => p.trim());
      for (const p of parts) {
        sectionAliases.push(p);
        sectionAliases.push(removeDiacritics(p));
      }
    }
    if (lowerSection.includes(' — ')) {
      const parts = lowerSection.split(' — ').map(p => p.trim());
      for (const p of parts) {
        sectionAliases.push(p);
        sectionAliases.push(removeDiacritics(p));
      }
    }

    for (const phrase of phrases) {
      const cleanPhrase = phrase.toLowerCase();
      const foldedPhrase = removeDiacritics(cleanPhrase);

      // Body exact phrase boost
      if (lowerBody.includes(cleanPhrase) || removeDiacritics(lowerBody).includes(foldedPhrase)) {
        phraseBoost += 8.0;
      }

      // Exact section alias match (e.g. phrase "bop crm" matches section "bop crm")
      // Broad brand phrases like "bop agencia" apply standard boost rather than overriding specific topic sections
      const isBroadBrandPhrase = cleanPhrase === 'bop agencia' || cleanPhrase === 'bop' || cleanPhrase === 'agencia';
      let hasExactSectionMatch = false;

      if (!isBroadBrandPhrase) {
        for (const alias of sectionAliases) {
          if (alias === cleanPhrase || alias === foldedPhrase) {
            phraseBoost += 35.0;
            hasExactSectionMatch = true;
            break;
          } else if (alias.startsWith(cleanPhrase) || alias.startsWith(foldedPhrase)) {
            phraseBoost += 20.0;
            hasExactSectionMatch = true;
            break;
          }
        }
      }

      // Title & section exact phrase boost (if not already exact match)
      if (!hasExactSectionMatch) {
        if (
          lowerTitle.includes(cleanPhrase) ||
          removeDiacritics(lowerTitle).includes(foldedPhrase) ||
          lowerSection.includes(cleanPhrase) ||
          removeDiacritics(lowerSection).includes(foldedPhrase)
        ) {
          phraseBoost += 10.0;
        }
      }
    }

    // Domain intent term matching (e.g., restaurante -> Bop Fusion, supermercado -> Bop Market)
    const hasRestaurante = foldedKeywords.some(k => k === 'restaurante' || k === 'restaurantes');
    if (hasRestaurante && (lowerSection.includes('fusion') || lowerBody.includes('restaurantes'))) {
      phraseBoost += 25.0;
    }
    const hasSupermercado = foldedKeywords.some(k => k === 'supermercado' || k === 'supermercados');
    if (hasSupermercado && (lowerSection.includes('market') || lowerBody.includes('supermercados'))) {
      phraseBoost += 25.0;
    }

    // 3. Title / Section Field Boost (term by term)
    let fieldBoost = 0;
    const titleAndSectionFolded = tokenize(`${source.title || ''} ${chunk.section || ''}`, { foldDiacritics: true });
    const titleSet = new Set(titleAndSectionFolded);

    for (const term of foldedKeywords) {
      if (titleSet.has(term)) {
        // High-signal category anchors like "portfolio" or "portafolio" get strong weight
        if (term === 'portfolio' || term === 'portafolio') {
          fieldBoost += (chunk.source_id && chunk.source_id.startsWith('website-portfolio')) ? 24.0 : 18.0;
        } else {
          fieldBoost += 4.0;
        }
      }
    }

    // 4. Language Alignment Multiplier
    const isTargetLang = (chunk.language || 'es').toLowerCase() === (language || 'es').toLowerCase();
    const langMultiplier = isTargetLang ? 1.5 : 0.4;

    const baseScore = bm25Score + phraseBoost + fieldBoost;
    const finalScore = Number((baseScore * langMultiplier).toFixed(3));

    return {
      score: finalScore,
      bm25Score: Number(bm25Score.toFixed(3)),
      phraseBoost,
      fieldBoost,
      langMultiplier
    };
  }
}
