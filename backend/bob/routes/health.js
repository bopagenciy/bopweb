/**
 * Bop Bob Backend - Minimalist Health Route Handler
 * GET /api/bob/health
 * 
 * Strict Privacy & Security:
 * Returns only the minimal public health contract without exposing
 * internal version numbers, uptime, environments, paths, configuration, or secrets.
 */

import { config } from '../config.js';

export function handleHealth(req, res) {
  const payload = {
    ok: true,
    service: 'bop-bob-backend',
    provider: config.llmProvider
  };

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

export default {
  handleHealth
};
