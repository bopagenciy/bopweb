/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — CORS & SECURITY HEADERS MIDDLEWARE
 * 
 * Enforces allowed origins and security response headers (nosniff, no-cache, DENY).
 */

import { config } from '../config.js';

export function handleCors(req, res) {
  const origin = req.headers.origin;

  // Set essential security headers on every response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // Verify and set CORS headers if origin is present
  if (origin) {
    if (config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true; // handled
  }

  return false; // continue routing
}

export default {
  handleCors
};
