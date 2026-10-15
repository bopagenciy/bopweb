/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — STUB PROVIDER
 * 
 * Safe testing provider adapter that validates the full pipeline (UI → API → Backend → Adapter → Response)
 * without incurring API costs or invoking external LLM inference.
 */

import { ProviderInterface } from './provider-interface.js';

export class StubProvider extends ProviderInterface {
  constructor() {
    super('stub');
  }

  /**
   * Generates a controlled, transparent stub response acknowledging the connection.
   * @param {Object} params
   * @returns {Promise<{ reply: string, source: string, sources: Array<any> }>}
   */
  async generateResponse({ language, sessionId }) {
    const sessionSuffix = (sessionId && typeof sessionId === 'string')
      ? sessionId.slice(0, 8)
      : 'demo';

    const reply = language === 'en'
      ? `Hello! Bob's secure backend connection is verified and operational (session: ${sessionSuffix}). The knowledge retriever and LLM engine will be connected in upcoming phases.`
      : `¡Hola! La conexión segura con el backend de Bob está verificada y operativa (sesión: ${sessionSuffix}). El motor de conocimiento y LLM se conectarán en las próximas fases.`;

    return {
      reply,
      source: 'stub',
      sources: []
    };
  }
}

export default StubProvider;
