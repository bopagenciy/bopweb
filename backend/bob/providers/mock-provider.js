import { ProviderInterface } from './provider-interface.js';

/**
 * Offline Mock Provider for automated test suites
 * Deterministic, zero network requests, zero API keys.
 */
export class MockProvider extends ProviderInterface {
  /**
   * @param {object} [options]
   * @param {string} [options.fixedReply]
   * @param {boolean} [options.shouldFail=false]
   * @param {string} [options.failError='MOCK_FAILURE']
   */
  constructor(options = {}) {
    super('mock');
    this.fixedReply = options.fixedReply || null;
    this.shouldFail = options.shouldFail || false;
    this.failError = options.failError || 'MOCK_FAILURE';
    this.callCount = 0;
    this.lastParams = null;
  }

  async generateResponse(params) {
    this.callCount++;
    this.lastParams = params;

    if (this.shouldFail) {
      throw new Error(this.failError);
    }

    if (this.fixedReply) {
      return {
        reply: this.fixedReply,
        source: 'rag',
        provider: 'mock',
        usage: { input_tokens: 10, output_tokens: 10 }
      };
    }

    const lang = params.language === 'en' ? 'en' : 'es';
    const hasContext = params.context && params.context.length > 0;

    let reply;
    if (hasContext) {
      reply = lang === 'en'
        ? `[Mock EN] Grounded response based on authorized Bop Agencia knowledge.`
        : `[Mock ES] Respuesta fundamentada en el conocimiento autorizado de Bop Agencia.`;
    } else {
      reply = lang === 'en'
        ? `I don’t have confirmed information about that in Bop Agencia’s knowledge base. I can help you contact the team if you’d like.`
        : `No tengo esa información confirmada en mi base de conocimiento de Bop Agencia. Si quieres, puedo ayudarte a contactar al equipo.`;
    }

    return {
      reply,
      source: hasContext ? 'rag' : 'fallback',
      provider: 'mock',
      usage: { input_tokens: 25, output_tokens: 20 }
    };
  }
}

export default MockProvider;
