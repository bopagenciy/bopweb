import { StubProvider } from './stub-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { MockProvider } from './mock-provider.js';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Provider Factory
 * Resolves active or fallback provider instance dynamically based on configuration.
 */
export class ProviderFactory {
  /**
   * Instantiate a provider by name
   * @param {string} providerName 'stub' | 'gemini' | 'openrouter' | 'mock'
   * @param {object} [customConfig]
   * @returns {import('./provider-interface.js').ProviderInterface}
   */
  static createProvider(providerName, customConfig = {}) {
    const name = (providerName || 'stub').toLowerCase().trim();

    switch (name) {
      case 'stub':
        return new StubProvider();

      case 'gemini':
        return new GeminiProvider({
          apiKey: customConfig.geminiApiKey ?? config.geminiApiKey,
          model: customConfig.geminiModel ?? config.geminiModel,
          timeoutMs: customConfig.providerTimeoutMs ?? config.providerTimeoutMs
        });

      case 'openrouter':
        return new OpenRouterProvider({
          apiKey: customConfig.openrouterApiKey ?? config.openrouterApiKey,
          model: customConfig.openrouterModel ?? config.openrouterModel,
          timeoutMs: customConfig.providerTimeoutMs ?? config.providerTimeoutMs
        });

      case 'mock':
        return new MockProvider(customConfig.mockOptions || {});

      default:
        throw new AppError(`Unsupported LLM provider "${providerName}".`, 500, 'PROVIDER_UNSUPPORTED');
    }
  }

  /**
   * Resolve active primary provider respecting the BOP_BOB_LLM_ENABLED flag
   * @param {object} [customConfig]
   * @returns {import('./provider-interface.js').ProviderInterface}
   */
  static getActiveProvider(customConfig = {}) {
    const isLlmEnabled = customConfig.llmEnabled ?? config.llmEnabled;
    const requestedProvider = customConfig.llmProvider ?? config.llmProvider;

    // Feature Flag Guard: If LLM is disabled, always resolve to StubProvider
    if (!isLlmEnabled) {
      return this.createProvider('stub');
    }

    return this.createProvider(requestedProvider, customConfig);
  }

  /**
   * Resolve optional fallback provider
   * @param {object} [customConfig]
   * @returns {import('./provider-interface.js').ProviderInterface|null}
   */
  static getFallbackProvider(customConfig = {}) {
    const isLlmEnabled = customConfig.llmEnabled ?? config.llmEnabled;
    const fallbackName = (customConfig.fallbackProvider ?? config.fallbackProvider ?? 'none').toLowerCase().trim();

    if (!isLlmEnabled || fallbackName === 'none' || !fallbackName) {
      return null;
    }

    return this.createProvider(fallbackName, customConfig);
  }
}

export default ProviderFactory;
