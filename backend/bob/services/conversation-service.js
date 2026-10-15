/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — CONVERSATION SERVICE
 * 
 * Orchestrates conversation workflow:
 * 1. Base system prompt guidelines
 * 2. Future knowledge retriever insertion point (Phase 11A.4)
 * 3. Provider invocation with strict timeout wrapper
 */

import { config } from '../config.js';
import { StubProvider } from '../providers/stub-provider.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Provider delegation handled via ProviderFactory and GroundedConversationService

import { groundedConversationService } from '../conversation/grounded-conversation-service.js';
import { ProviderFactory } from '../providers/provider-factory.js';

/**
 * Executes a conversation turn via GroundedConversationService.
 * @param {Object} params
 * @returns {Promise<{ ok: boolean, reply: string, language: string, source: string, sources: Array, session_id: string }>}
 */
export async function processMessage(params) {
  return groundedConversationService.processMessage(params);
}

export const conversationService = {
  processMessage,
  getActiveProviderName: () => ProviderFactory.getActiveProvider().name
};

export default conversationService;
