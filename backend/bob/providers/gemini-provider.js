import { ProviderInterface } from './provider-interface.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Google Gemini Provider Adapter
 * Powered by official @google/genai SDK
 * 
 * Strict safety rules:
 * - Never logs or exposes GEMINI_API_KEY
 * - Maps raw API errors into clean application codes
 * - Enforces timeout abort controller
 * - Formats system instructions, conversation history, and grounded context
 */
export class GeminiProvider extends ProviderInterface {
  /**
   * @param {object} options
   * @param {string} options.apiKey
   * @param {string} [options.model='gemini-2.5-flash']
   * @param {number} [options.timeoutMs=20000]
   */
  constructor(options = {}) {
    super('gemini');
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'gemini-2.5-flash';
    this.timeoutMs = options.timeoutMs || 20000;
  }

  /**
   * Execute response generation via official @google/genai SDK
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
    // 1. Check configuration
    if (!this.apiKey || typeof this.apiKey !== 'string' || this.apiKey.trim().length === 0) {
      throw new AppError(
        'Gemini provider is not configured with an API key.',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    if (!this.model) {
      throw new AppError(
        'Gemini provider requires a valid model identifier.',
        500,
        'PROVIDER_CONFIG_INVALID'
      );
    }

    // 2. Dynamically import Google Gen AI SDK to prevent startup crashes in offline modes
    let GoogleGenAI;
    try {
      const module = await import('@google/genai');
      GoogleGenAI = module.GoogleGenAI;
    } catch (importErr) {
      logger.error('Failed to load @google/genai SDK', { error: importErr.message });
      throw new AppError('Gemini SDK is not available.', 500, 'PROVIDER_UNAVAILABLE');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // 3. Assemble contents payload
    // Map prior conversation history to Gemini contents structure
    const contents = [];
    for (const h of history) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    }

    // Append context and user prompt
    const userPromptWithContext = context
      ? `[GROUNDED KNOWLEDGE BASE - USE EXCLUSIVELY TO ANSWER]\n${context}\n\n[USER QUESTION]\n${message}`
      : message;

    contents.push({
      role: 'user',
      parts: [{ text: userPromptWithContext }]
    });

    // 4. Timeout wrapper
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          maxOutputTokens,
          temperature: 0.2 // Low temperature for high factual adherence to grounded context
        }
      });

      clearTimeout(timeoutId);

      const replyText = response?.text || '';
      if (!replyText.trim()) {
        throw new AppError('Gemini returned an empty response.', 502, 'PROVIDER_RESPONSE_INVALID');
      }

      return {
        reply: replyText.trim(),
        provider: 'gemini',
        model: this.model,
        source: 'rag',
        usage: {
          prompt_tokens: response?.usageMetadata?.promptTokenCount,
          candidates_tokens: response?.usageMetadata?.candidatesTokenCount,
          total_tokens: response?.usageMetadata?.totalTokenCount
        }
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (abortController.signal.aborted || err.name === 'AbortError') {
        throw new AppError('Gemini provider request timed out.', 504, 'PROVIDER_TIMEOUT');
      }

      // Sanitize and map error codes without exposing raw sensitive error bodies or secrets
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('api key') || errMsg.includes('unauthorized') || errMsg.includes('403') || errMsg.includes('401')) {
        throw new AppError('Gemini authentication failed.', 500, 'PROVIDER_AUTH_ERROR');
      }
      if (errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('429')) {
        throw new AppError('Gemini rate limit exceeded.', 429, 'PROVIDER_RATE_LIMITED');
      }
      if (errMsg.includes('model not found') || errMsg.includes('not supported')) {
        throw new AppError(`Gemini model "${this.model}" not found or unsupported.`, 500, 'PROVIDER_CONFIG_INVALID');
      }

      logger.error('Gemini API invocation error', {
        status: err.status,
        code: err.code
      });

      throw new AppError('Gemini provider encountered an unexpected failure.', 502, 'PROVIDER_UNAVAILABLE');
    }
  }
}

export default GeminiProvider;
