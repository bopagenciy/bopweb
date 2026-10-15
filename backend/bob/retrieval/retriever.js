import { CorpusLoader, DEFAULT_GENERATED_DIR } from './corpus-loader.js';
import { normalizeQuery } from './query-normalizer.js';
import { BM25Scorer } from './scorer.js';
import { buildCitation, buildSnippet } from './citation-builder.js';

export const DEFAULT_TOP_K = 5;
export const MAX_TOP_K = 10;
export const DEFAULT_SCORE_THRESHOLD = 1.0;

/**
 * Bob Knowledge Retriever Service
 * Zero Cloud / Pure local deterministic BM25 lexical search with citations
 */
export class KnowledgeRetriever {
  /**
   * @param {object} [options]
   * @param {string} [options.generatedDir]
   * @param {number} [options.scoreThreshold=1.0]
   */
  constructor(options = {}) {
    this.generatedDir = options.generatedDir || DEFAULT_GENERATED_DIR;
    this.scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
    this.loader = new CorpusLoader(this.generatedDir);
    this.scorer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize or reload the in-memory retrieval index
   * @param {boolean} [forceReload=false]
   */
  async initialize(forceReload = false) {
    const loadResult = await this.loader.load(forceReload);
    if (!loadResult.ok) {
      return loadResult;
    }

    this.scorer = new BM25Scorer(this.loader.getChunks(), this.loader.sourcesMap);
    this.isInitialized = true;
    return { ok: true, chunkCount: loadResult.chunkCount, sourceCount: loadResult.sourceCount };
  }

  /**
   * Reload corpus after new documents or website updates
   */
  async reload() {
    return this.initialize(true);
  }

  /**
   * Search knowledge base for relevant chunks
   * 
   * @param {object} params
   * @param {string} params.query
   * @param {string} [params.language='es'] 'es' or 'en'
   * @param {number} [params.topK=5]
   * @param {number} [params.threshold]
   * @returns {Promise<{ ok: boolean, error?: string, query: string, language: string, total_matches: number, results: Array<object>, duration_ms: number }>}
   */
  async search(params = {}) {
    const startTime = Date.now();
    const {
      query = '',
      language = 'es',
      topK = DEFAULT_TOP_K,
      threshold = this.scoreThreshold
    } = params;

    // 1. Ensure initialized
    if (!this.isInitialized || !this.scorer) {
      const initRes = await this.initialize();
      if (!initRes.ok) {
        return {
          ok: false,
          error: initRes.error || 'KNOWLEDGE_CORPUS_UNAVAILABLE',
          details: initRes.details,
          query: String(query || ''),
          language,
          total_matches: 0,
          results: [],
          duration_ms: Date.now() - startTime
        };
      }
    }

    // 2. Normalize and validate query
    const norm = normalizeQuery(query, language);
    if (!norm.valid) {
      return {
        ok: false,
        error: norm.error,
        query: String(query || ''),
        language,
        total_matches: 0,
        results: [],
        duration_ms: Date.now() - startTime
      };
    }

    // 3. Score all chunks
    const chunks = this.loader.getChunks();
    const scoredList = [];

    for (const chunk of chunks) {
      const scoreObj = this.scorer.scoreChunk(chunk, {
        keywords: norm.keywords,
        phrases: norm.phrases,
        language
      });

      if (scoreObj.score >= threshold) {
        scoredList.push({
          chunk,
          scoreObj
        });
      }
    }

    // 4. Deterministic sorting: highest score first, tie-break by chunk_id
    scoredList.sort((a, b) => {
      if (b.scoreObj.score !== a.scoreObj.score) {
        return b.scoreObj.score - a.scoreObj.score;
      }
      return a.chunk.chunk_id.localeCompare(b.chunk.chunk_id);
    });

    // 5. Slice top K (capped at MAX_TOP_K)
    const effectiveTopK = Math.min(Math.max(1, topK || DEFAULT_TOP_K), MAX_TOP_K);
    const topMatches = scoredList.slice(0, effectiveTopK);

    // 6. Build structured results
    const results = topMatches.map((item, idx) => {
      const source = this.loader.getSource(item.chunk.source_id) || {};
      const citation = buildCitation(item.chunk, source);
      const snippet = buildSnippet(item.chunk.text, norm.keywords);

      return {
        rank: idx + 1,
        score: item.scoreObj.score,
        chunk_id: item.chunk.chunk_id,
        source_id: item.chunk.source_id,
        source_type: source.source_type || 'website',
        source_name: source.title || source.source_name || item.chunk.section,
        section: item.chunk.section,
        language: item.chunk.language,
        text: item.chunk.text,
        snippet,
        citation
      };
    });

    const durationMs = Date.now() - startTime;

    return {
      ok: true,
      query: norm.normalizedQuery,
      language,
      total_matches: scoredList.length,
      results,
      duration_ms: durationMs
    };
  }
}

// Default singleton instance
export const knowledgeRetriever = new KnowledgeRetriever();
