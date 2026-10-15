/**
 * BOP AGENCIA — PHASE 11A.5
 * BOB WEB ASSISTANT — LLM PROVIDER INTERFACE
 * 
 * Standard contract that any LLM provider adapter must implement:
 * 
 * generateResponse({
 *   message: string,
 *   language: 'es' | 'en',
 *   context?: string,
 *   history?: Array<{ role: 'user' | 'assistant', content: string }>,
 *   sessionId: string,
 *   maxOutputTokens?: number,
 *   timeoutMs?: number
 * }): Promise<{ reply: string, source: string, sources?: Array<any>, provider?: string, usage?: object }>
 */

export class ProviderInterface {
  constructor(name) {
    this.name = name;
  }

  /**
   * Generates a conversational response.
   * @param {Object} params
   * @returns {Promise<{ reply: string, source: string, sources?: Array<any>, provider?: string, usage?: object }>}
   */
  async generateResponse(_params) {
    throw new Error(`generateResponse() not implemented on provider "${this.name}".`);
  }
}

export default ProviderInterface;
