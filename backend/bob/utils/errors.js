/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — ERROR CONTRACT UTILS
 * 
 * Standardized error response helper:
 * {
 *   "ok": false,
 *   "error": {
 *     "code": "...",
 *     "message": "..."
 *   }
 * }
 * 
 * Never exposes stack traces, paths, or environment variables.
 */

export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function sendError(res, err) {
  const statusCode = (err && err.statusCode) ? err.statusCode : 500;
  const code = (err && err.code) ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = (err && statusCode < 500)
    ? err.message
    : 'An internal error occurred while processing the request.';

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });

  res.end(JSON.stringify({
    ok: false,
    code,
    error: {
      code,
      message
    }
  }));
}

export default {
  AppError,
  sendError
};
