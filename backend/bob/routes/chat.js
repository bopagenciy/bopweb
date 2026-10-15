/**
 * Bop Bob Backend - Chat Route Handler
 * POST /api/bob/chat
 */

import { validateChatPayload } from '../middleware/validate.js';
import { conversationService } from '../services/conversation-service.js';
import { sendError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export async function handleChat(req, res) {
  // Enforce Max Payload size 32KB
  let bodyBuffer = '';
  let bytesRead = 0;

  req.on('data', (chunk) => {
    bytesRead += chunk.length;
    if (bytesRead > config.maxPayloadBytes) {
      req.destroy(new AppError('Payload exceeds maximum allowed size (32KB)', 413, 'PAYLOAD_TOO_LARGE'));
      return;
    }
    bodyBuffer += chunk.toString('utf8');
  });

  req.on('end', async () => {
    try {
      let rawJson;
      try {
        rawJson = JSON.parse(bodyBuffer || '{}');
      } catch (parseErr) {
        throw new AppError('Invalid JSON payload in request body', 400, 'INVALID_JSON');
      }

      // Validate schema
      const validatedData = validateChatPayload(rawJson);

      // Log sanitized metadata (strictly privacy-safe, never logs message content or secrets)
      logger.info('chat_request_processed', {
        route: '/api/bob/chat',
        status: 200,
        message_length: validatedData.message.length,
        history_length: validatedData.history.length,
        language: validatedData.language,
        session_prefix: validatedData.sessionId.slice(0, 8),
        page: validatedData.page
      });

      // Process conversation via abstraction service
      const response = await conversationService.processMessage(validatedData);

      // Return sanitized conversation response
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(response));
    } catch (err) {
      sendError(res, err);
    }
  });

  req.on('error', (err) => {
    sendError(res, err);
  });
}
