/**
 * BOP AGENCIA — PHASE 11A.5
 * BOB WEB ASSISTANT — BACKEND CONFIGURATION
 * 
 * Safely loads environment variables from .env file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val.replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (_) {}
  }
}

loadEnvFile();

export const config = {
  // Server network
  port: parseInt(process.env.BOP_BOB_PORT, 10) || 8787,
  host: process.env.BOP_BOB_HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Feature Flags & Providers
  llmEnabled: (process.env.BOP_BOB_LLM_ENABLED === 'true'),
  llmProvider: (process.env.BOP_BOB_PROVIDER || 'stub').toLowerCase(),
  fallbackProvider: (process.env.BOP_BOB_FALLBACK_PROVIDER || 'none').toLowerCase(),

  // Gemini settings
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.BOP_BOB_GEMINI_MODEL || 'gemini-2.5-flash',

  // OpenRouter settings
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: process.env.BOP_BOB_OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',

  // Security, CORS & Rate Limits
  allowedOrigins: (process.env.BOP_ALLOWED_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  rateLimit: parseInt(process.env.BOP_BOB_RATE_LIMIT, 10) || 20,
  rateWindowMs: parseInt(process.env.BOP_BOB_RATE_WINDOW_MS, 10) || 60000,

  // Constraints & Payload Limits
  maxMessageLength: parseInt(process.env.BOP_BOB_MAX_MESSAGE_LENGTH, 10) || 2000,
  maxPayloadBytes: 32 * 1024, // 32 KB strict payload limit
  providerTimeoutMs: parseInt(process.env.BOP_BOB_PROVIDER_TIMEOUT_MS, 10) || 20000,

  // Retrieval & Grounding Constraints
  maxContextChars: parseInt(process.env.BOP_BOB_MAX_CONTEXT_CHARS, 10) || 12000,
  maxOutputTokens: parseInt(process.env.BOP_BOB_MAX_OUTPUT_TOKENS, 10) || 800,
  retrievalTopK: parseInt(process.env.BOP_BOB_RETRIEVAL_TOP_K, 10) || 5,
  retrievalThreshold: parseFloat(process.env.BOP_BOB_RETRIEVAL_THRESHOLD) || 1.0,

  // History Limits
  maxHistoryEntries: parseInt(process.env.BOP_BOB_MAX_HISTORY_MESSAGES, 10) || 6,
  maxHistoryChars: parseInt(process.env.BOP_BOB_MAX_HISTORY_CHARS, 10) || 6000
};

export default config;
