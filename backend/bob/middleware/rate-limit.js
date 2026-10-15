/**
 * BOP AGENCIA — PHASE 11A.2
 * BOB WEB ASSISTANT — IN-MEMORY RATE LIMITER
 * 
 * Protects endpoints from floods and abusive automation.
 * Default: 20 requests / minute per client IP.
 * Cleaned up automatically on every interval to prevent memory growth.
 */

import { config } from '../config.js';

const clients = new Map();

// Periodic purge of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of clients.entries()) {
    if (now > data.resetTime) {
      clients.delete(key);
    }
  }
}, 60000).unref();

export function checkRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
             req.socket?.remoteAddress ||
             '127.0.0.1';

  const now = Date.now();
  let client = clients.get(ip);

  if (!client || now > client.resetTime) {
    client = {
      count: 1,
      resetTime: now + config.rateWindowMs
    };
    clients.set(ip, client);

    if (res && res.setHeader) {
      res.setHeader('X-RateLimit-Limit', config.rateLimit.toString());
      res.setHeader('X-RateLimit-Remaining', (config.rateLimit - 1).toString());
    }
    return { allowed: true, remaining: config.rateLimit - 1 };
  }

  client.count += 1;
  const remaining = Math.max(0, config.rateLimit - client.count);

  if (res && res.setHeader) {
    res.setHeader('X-RateLimit-Limit', config.rateLimit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
  }

  if (client.count > config.rateLimit) {
    const retryAfter = Math.ceil((client.resetTime - now) / 1000);
    if (res && res.setHeader) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
    return {
      allowed: false,
      retryAfterSeconds: retryAfter
    };
  }

  return { allowed: true, remaining };
}

export function resetRateLimits() {
  clients.clear();
}

export default {
  checkRateLimit,
  resetRateLimits
};
