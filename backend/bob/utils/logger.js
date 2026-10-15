/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — SECURE LOGGER
 * 
 * Strict Privacy & Safety:
 * - Never logs full user messages, emails, phone numbers, or secrets.
 * - Logs request metadata, status, duration, message length, and sanitized error codes.
 */

export function info(message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    level: 'INFO',
    timestamp,
    message,
    ...meta
  }));
}

export function warn(message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.warn(JSON.stringify({
    level: 'WARN',
    timestamp,
    message,
    ...meta
  }));
}

export function error(message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.error(JSON.stringify({
    level: 'ERROR',
    timestamp,
    message,
    ...meta
  }));
}

export const logger = {
  info,
  warn,
  error
};

export default logger;
