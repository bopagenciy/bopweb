import { ProviderInterface } from './provider-interface.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * OpenRouter Provider Adapter
 * Compatible Server-Side Fetch Implementation (Zero npm dependencies)
 * 
 * Strict safety rules:
 * - Server-to-server only; never executed from client
 * - Never logs or reveals OPENROUTER_API_KEY
 * - Maps raw responses cleanly
 * - Enforces timeout abort controller
 */
export class OpenRouterProvider extends ProviderInterface {
  /**
   * @param {object} options
   * @param {string} options.apiKey
   * @param {string} [options.model='meta-llama/llama-3.3-70b-instruct']
   * @param {number} [options.timeoutMs=20000]
   */
  constructor(options = {}) {
    super('openrouter');
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'meta-llama/llama-3.3-70b-instruct';
    this.timeoutMs = options.timeoutMs || 20000;
    this.endpointUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * Execute chat completion via OpenRouter endpoint
   */
  async generateResponse({
    message,
    language = 'es',
    context = '',
    history = [],
    sessionId = 'anonymous',
    systemInstruction = '',
    maxOutputTokens = 800
  }) {
    if (!this.apiKey || typeof this.apiKey !== 'string' || this.apiKey.trim().length === 0) {
      throw new AppError(
        'OpenRouter provider is not configured with an API key.',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    if (!this.model) {
      throw new AppError(
        'OpenRouter provider requires a valid model identifier.',
        500,
        'PROVIDER_CONFIG_INVALID'
      );
    }

    // Build standard messages array
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    for (const h of history) {
      messages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
      });
    }

    const userContent = context
      ? `[GROUNDED KNOWLEDGE BASE - USE EXCLUSIVELY TO ANSWER]\n${context}\n\n[USER QUESTION]\n${message}`
      : message;

    messages.push({ role: 'user', content: userContent });

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://bopagencia.com',
          'X-Title': 'Bop Agencia Bob Assistant'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: maxOutputTokens,
          temperature: 0.2
        }),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          throw new AppError('OpenRouter authentication failed.', 500, 'PROVIDER_AUTH_ERROR');
        }
        if (status === 429) {
          throw new AppError('OpenRouter rate limit exceeded.', 429, 'PROVIDER_RATE_LIMITED');
        }
        if (status === 404) {
          throw new AppError(`OpenRouter model "${this.model}" not found.`, 500, 'PROVIDER_CONFIG_INVALID');
        }
        throw new AppError('OpenRouter provider returned an error.', 502, 'PROVIDER_UNAVAILABLE');
      }

      const json = await response.json();
      const replyText = json?.choices?.[0]?.message?.content || '';

      if (!replyText.trim()) {
        throw new AppError('OpenRouter returned an empty response.', 502, 'PROVIDER_RESPONSE_INVALID');
      }

      return {
        reply: replyText.trim(),
        provider: 'openrouter',
        model: this.model,
        source: 'rag',
        usage: {
          prompt_tokens: json?.usage?.prompt_tokens,
          completion_tokens: json?.usage?.completion_tokens,
          total_tokens: json?.usage?.total_tokens
        }
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (abortController.signal.aborted || err.name === 'AbortError') {
        throw new AppError('OpenRouter provider request timed out.', 504, 'PROVIDER_TIMEOUT');
      }

      if (err instanceof AppError) {
        throw err;
      }

      logger.error('OpenRouter fetch failure', {
        error: err.message
      });

      throw new AppError('OpenRouter provider encountered an unexpected failure.', 502, 'PROVIDER_UNAVAILABLE');
    }
  }
}

export default OpenRouterProvider;
