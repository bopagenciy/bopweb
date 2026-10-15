/**
 * Bop Bob Backend - Native HTTP Server
 * Vanilla Node.js 18+ (zero npm dependencies)
 */

import http from 'node:http';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { sendError, AppError } from './utils/errors.js';
import { handleCors } from './middleware/cors.js';
import { checkRateLimit } from './middleware/rate-limit.js';
import { handleHealth } from './routes/health.js';
import { handleChat } from './routes/chat.js';
import { handleSearch } from './routes/search.js';

export function createServer() {
  return http.createServer((req, res) => {
    const startTime = Date.now();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase();

    // 1. CORS & Security Headers
    const corsHandled = handleCors(req, res);
    if (corsHandled) {
      return; // Preflight OPTIONS handled
    }

    // 2. Logging on response finish
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      logger.info('http_request', {
        method,
        path: pathname,
        statusCode: res.statusCode,
        durationMs
      });
    });

    // 3. Routing & Handlers
    try {
      // Health check endpoint (GET only)
      if (pathname === '/api/bob/health') {
        if (method !== 'GET') {
          throw new AppError('Method Not Allowed', 405, 'METHOD_NOT_ALLOWED');
        }
        return handleHealth(req, res);
      }

      // Chat endpoint (POST only)
      if (pathname === '/api/bob/chat') {
        if (method !== 'POST') {
          throw new AppError('Method Not Allowed', 405, 'METHOD_NOT_ALLOWED');
        }

        // Apply Rate Limiting
        const rateCheck = checkRateLimit(req, res);
        if (!rateCheck.allowed) {
          throw new AppError(
            'Rate limit exceeded. Please wait a moment before sending more messages.',
            429,
            'RATE_LIMIT_EXCEEDED'
          );
        }

        return handleChat(req, res);
      }

      // Search endpoint (POST only - Phase 11A.4 Internal QA)
      if (pathname === '/api/bob/search') {
        if (method !== 'POST') {
          throw new AppError('Method Not Allowed', 405, 'METHOD_NOT_ALLOWED');
        }

        const rateCheck = checkRateLimit(req, res);
        if (!rateCheck.allowed) {
          throw new AppError(
            'Rate limit exceeded. Please wait a moment before sending more requests.',
            429,
            'RATE_LIMIT_EXCEEDED'
          );
        }

        return handleSearch(req, res);
      }

      // 404 Not Found for any other path
      throw new AppError(`Endpoint not found: ${pathname}`, 404, 'NOT_FOUND');
    } catch (err) {
      sendError(res, err);
    }
  });
}

// Start standalone if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    logger.info('server_started', {
      host: config.host,
      port: config.port,
      provider: config.llmProvider,
      allowedOrigins: config.allowedOrigins,
      environment: config.nodeEnv
    });
    console.log(`[Bop Bob Backend] Listening on http://${config.host}:${config.port}`);
    console.log(`[Bop Bob Backend] Health: http://${config.host}:${config.port}/api/bob/health`);
    console.log(`[Bop Bob Backend] Chat:   POST http://${config.host}:${config.port}/api/bob/chat`);
  });
}
