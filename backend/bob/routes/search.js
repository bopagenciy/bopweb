/**
 * Bop Bob Backend - Search Route Handler
 * POST /api/bob/search
 * 
 * Secure internal retrieval endpoint for testing and QA
 */

import { knowledgeRetriever } from '../retrieval/retriever.js';
import { sendError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export async function handleSearch(req, res) {
  let bodyBuffer = '';
  let bytesRead = 0;

  req.on('data', (chunk) => {
    bytesRead += chunk.length;
    if (bytesRead > config.maxPayloadBytes) {
      req.destroy(new AppError('Payload exceeds maximum allowed size (32KB)', 413, 'PAYLOAD_TOO_LARGE'));
      return;
    }
    bodyBuffer += chunk.toString('utf8');
  });

  req.on('end', async () => {
    try {
      let rawJson;
      try {
        rawJson = JSON.parse(bodyBuffer || '{}');
      } catch (parseErr) {
        throw new AppError('Invalid JSON payload in request body', 400, 'INVALID_JSON');
      }

      const { query, language = 'es', top_k = 5, threshold } = rawJson;

      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new AppError('Missing or empty "query" parameter', 400, 'QUERY_EMPTY');
      }

      if (query.length > 500) {
        throw new AppError('Query exceeds maximum length of 500 characters', 400, 'QUERY_TOO_LONG');
      }

      const cleanLang = (language === 'en' ? 'en' : 'es');
      const cleanTopK = Math.min(Math.max(1, parseInt(top_k, 10) || 5), 10);

      const searchResult = await knowledgeRetriever.search({
        query: query.trim(),
        language: cleanLang,
        topK: cleanTopK,
        threshold
      });

      if (!searchResult.ok) {
        throw new AppError(searchResult.details || 'Search execution failed', 500, searchResult.error);
      }

      // Safe privacy logging (never log full query or full text chunks)
      logger.info('retrieval_search_executed', {
        route: '/api/bob/search',
        query_length: query.trim().length,
        language: cleanLang,
        top_k: cleanTopK,
        matches_count: searchResult.total_matches,
        results_count: searchResult.results.length,
        duration_ms: searchResult.duration_ms
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(searchResult));
    } catch (err) {
      sendError(res, err);
    }
  });

  req.on('error', (err) => {
    sendError(res, err);
  });
}
