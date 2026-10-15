/**
 * BOP AGENCIA — PHASE 11A.5
 * GROUNDED CONVERSATION ENGINE
 * 
 * Orchestrates end-to-end conversation:
 * 1. Validates inputs & history limits
 * 2. Runs local lexical BM25 retrieval
 * 3. Builds grounded context and server-owned citations
 * 4. Checks no-knowledge boundary
 * 5. Calls primary provider via ProviderFactory (or fallback if configured)
 * 6. Returns structured response contract with safe logging
 */

import { config } from '../config.js';
import { knowledgeRetriever } from '../retrieval/retriever.js';
import { ProviderFactory } from '../providers/provider-factory.js';
import { buildSystemPrompt } from './system-prompt.js';
import { buildGroundedContext } from './context-builder.js';
import { mapRetrievalCitations } from './citation-mapper.js';
import { getNoKnowledgeFallback, getPriceFallback } from './fallback.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class GroundedConversationService {
  constructor(customConfig = {}) {
    this.customConfig = customConfig;
  }

  /**
   * Process incoming user chat turn
   * 
   * @param {object} params
   * @param {string} params.message
   * @param {string} [params.language='es']
   * @param {string} [params.sessionId='anonymous']
   * @param {string} [params.page='home']
   * @param {Array<object>} [params.history=[]]
   * @returns {Promise<{ ok: boolean, reply: string, language: string, provider: string, source: string, sources: Array<object>, session_id: string }>}
   */
  async processMessage({ message, language = 'es', sessionId = 'anonymous', page = 'home', history = [] }) {
    const startTime = Date.now();
    const effectiveConfig = { ...config, ...this.customConfig };
    const lang = (language === 'en' ? 'en' : 'es');

    // 1. History validation & safety ceiling check
    if (history.length > effectiveConfig.maxHistoryEntries) {
      throw new AppError(
        `History cannot exceed ${effectiveConfig.maxHistoryEntries} entries.`,
        400,
        'HISTORY_TOO_LONG'
      );
    }

    let historyTotalChars = 0;
    for (const h of history) {
      // Reject any non-whitelisted roles injected by client
      if (h.role !== 'user' && h.role !== 'assistant') {
        throw new AppError(`Forbidden history role "${h.role}".`, 400, 'INVALID_HISTORY_ROLE');
      }
      historyTotalChars += (h.content || '').length;
    }

    if (historyTotalChars > effectiveConfig.maxHistoryChars) {
      throw new AppError('Total conversation history exceeds maximum allowed characters.', 400, 'HISTORY_TOO_LONG');
    }

    // 2. Feature Flag Check: If LLM is disabled, use Stub provider
    if (!effectiveConfig.llmEnabled) {
      const stub = ProviderFactory.createProvider('stub');
      const stubResult = await stub.generateResponse({
        message,
        language: lang,
        sessionId
      });

      return {
        ok: true,
        reply: stubResult.reply,
        language: lang,
        provider: 'stub',
        source: 'stub',
        sources: [],
        session_id: sessionId
      };
    }

    // 3. Retrieval Step
    const retrievalResponse = await knowledgeRetriever.search({
      query: message,
      language: lang,
      topK: effectiveConfig.retrievalTopK,
      threshold: effectiveConfig.retrievalThreshold
    });

    const searchResults = (retrievalResponse.ok && Array.isArray(retrievalResponse.results))
      ? retrievalResponse.results
      : [];

    const citations = mapRetrievalCitations(searchResults);

    // 4. No-Knowledge Fallback (Prevent hallucination if zero relevant chunks found)
    if (searchResults.length === 0) {
      const lowerMsg = message.toLowerCase();
      const isPriceQuery = lowerMsg.includes('precio') || lowerMsg.includes('costo') || lowerMsg.includes('tarifa') ||
                           lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('rate');

      const fallbackReply = isPriceQuery ? getPriceFallback(lang) : getNoKnowledgeFallback(lang);

      logger.info('chat_grounded_turn', {
        session_prefix: sessionId.slice(0, 8),
        message_length: message.length,
        language: lang,
        retrieval_results_count: 0,
        context_char_count: 0,
        provider: 'none',
        source: 'fallback',
        duration_ms: Date.now() - startTime
      });

      return {
        ok: true,
        reply: fallbackReply,
        language: lang,
        provider: effectiveConfig.llmProvider,
        source: 'fallback',
        sources: [],
        session_id: sessionId
      };
    }

    // 5. Build Context and System Prompt
    const groundedContext = buildGroundedContext(searchResults, effectiveConfig.maxContextChars);
    const systemPrompt = buildSystemPrompt(lang);

    // 6. Resolve Primary & Optional Fallback Providers
    const primaryProvider = ProviderFactory.getActiveProvider(effectiveConfig);
    const fallbackProvider = ProviderFactory.getFallbackProvider(effectiveConfig);

    let providerResult = null;
    let usedProviderName = primaryProvider.name;

    try {
      providerResult = await primaryProvider.generateResponse({
        message,
        language: lang,
        context: groundedContext,
        history,
        sessionId,
        systemInstruction: systemPrompt,
        maxOutputTokens: effectiveConfig.maxOutputTokens
      });
    } catch (primaryErr) {
      logger.warn('Primary LLM provider failed', {
        primary_provider: primaryProvider.name,
        error_code: primaryErr.code || primaryErr.message
      });

      // Execute fallback if configured and valid
      if (fallbackProvider) {
        logger.info('Invoking fallback provider', {
          primary_provider: primaryProvider.name,
          fallback_provider: fallbackProvider.name,
          fallback_reason_code: primaryErr.code || 'PRIMARY_FAILED'
        });

        usedProviderName = fallbackProvider.name;
        providerResult = await fallbackProvider.generateResponse({
          message,
          language: lang,
          context: groundedContext,
          history,
          sessionId,
          systemInstruction: systemPrompt,
          maxOutputTokens: effectiveConfig.maxOutputTokens
        });
      } else {
        // Fallback is 'none' or inactive: re-throw error cleanly
        throw primaryErr;
      }
    }

    const durationMs = Date.now() - startTime;

    // 7. Safe structured logging (zero user content or prompt logging)
    logger.info('chat_grounded_turn', {
      session_prefix: sessionId.slice(0, 8),
      message_length: message.length,
      history_length: history.length,
      language: lang,
      retrieval_results_count: searchResults.length,
      context_char_count: groundedContext.length,
      provider: usedProviderName,
      source: 'rag',
      duration_ms: durationMs
    });

    return {
      ok: true,
      reply: providerResult.reply,
      language: lang,
      provider: usedProviderName,
      source: 'rag',
      sources: citations,
      session_id: sessionId
    };
  }
}

export const groundedConversationService = new GroundedConversationService();
export default groundedConversationService;
