/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — REQUEST VALIDATION MIDDLEWARE
 * 
 * Strict schema verification for POST /api/bob/chat:
 * - message: required string, non-empty, max 500 chars
 * - language: "es" | "en"
 * - session_id: optional string, max 100 chars
 * - page: optional string ("home")
 * - history: optional array, max 10 items
 */

import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

export function validateChatPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a JSON object.', 400, 'INVALID_PAYLOAD');
  }

  // 1. Message validation
  if (typeof body.message !== 'string') {
    throw new AppError('Field "message" must be a string.', 400, 'INVALID_MESSAGE');
  }

  const message = body.message.trim();
  if (message.length === 0) {
    throw new AppError('Field "message" cannot be empty.', 400, 'EMPTY_MESSAGE');
  }

  if (message.length > config.maxMessageLength) {
    throw new AppError(
      `Message length exceeds maximum allowed limit of ${config.maxMessageLength} characters.`,
      400,
      'MESSAGE_TOO_LONG'
    );
  }

  // 2. Language validation
  if (!body.language || (body.language !== 'es' && body.language !== 'en')) {
    throw new AppError('Field "language" must be either "es" or "en".', 400, 'INVALID_LANGUAGE');
  }
  const language = body.language;

  // 3. Session ID validation (anonymous identifier)
  let sessionId = 'anonymous';
  if (body.session_id !== undefined) {
    if (typeof body.session_id !== 'string') {
      throw new AppError('Field "session_id" must be a string.', 400, 'INVALID_SESSION_ID');
    }
    const cleanSession = body.session_id.trim();
    if (cleanSession.length > 100) {
      throw new AppError('Field "session_id" is too long (max 100 chars).', 400, 'INVALID_SESSION_ID');
    }
    sessionId = cleanSession || 'anonymous';
  }

  // 4. Page validation
  let page = 'home';
  if (body.page !== undefined) {
    if (typeof body.page !== 'string') {
      throw new AppError('Field "page" must be a string.', 400, 'INVALID_PAGE');
    }
    const allowedPages = ['home'];
    if (!allowedPages.includes(body.page.toLowerCase())) {
      throw new AppError('Field "page" must be an allowed page identifier.', 400, 'INVALID_PAGE');
    }
    page = body.page.toLowerCase();
  }

  // 5. History validation (optional)
  let history = [];
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      throw new AppError('Field "history" must be an array.', 400, 'INVALID_HISTORY');
    }

    if (body.history.length > config.maxHistoryEntries) {
      throw new AppError(
        `History cannot exceed ${config.maxHistoryEntries} entries.`,
        400,
        'HISTORY_TOO_LONG'
      );
    }

    for (let i = 0; i < body.history.length; i++) {
      const item = body.history[i];
      if (!item || typeof item !== 'object') {
        throw new AppError(`History item at index ${i} is invalid.`, 400, 'INVALID_HISTORY_ITEM');
      }
      if (item.role !== 'user' && item.role !== 'assistant') {
        throw new AppError(`History item at index ${i} has invalid role.`, 400, 'INVALID_HISTORY_ROLE');
      }
      if (typeof item.content !== 'string' || item.content.length > config.maxMessageLength) {
        throw new AppError(`History item at index ${i} has invalid content.`, 400, 'INVALID_HISTORY_CONTENT');
      }
      history.push({
        role: item.role,
        content: item.content.trim()
      });
    }
  }

  return {
    message,
    language,
    sessionId,
    page,
    history
  };
}

export default {
  validateChatPayload
};
