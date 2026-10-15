/**
 * Automated API Test Suite for Bop Bob Backend
 * Phase 11A.2.1 - Security & Contract Micro-Closure
 * 
 * Tests:
 * 1. GET /api/bob/health returns 200 with minimal payload {"ok":true,"service":"bop-bob-backend","provider":"stub"}
 * 2. GET /api/bob/health does NOT expose version, uptime_seconds, or environment
 * 3. POST /api/bob/chat returns 200 with structured stub response (ES)
 * 4. POST /api/bob/chat returns 200 with structured stub response (EN)
 * 5. POST /api/bob/chat returns 400 when message is empty
 * 6. POST /api/bob/chat returns 400 when language is invalid
 * 7. POST /api/bob/chat with 1999 chars is ACCEPTED (200)
 * 8. POST /api/bob/chat with 2000 chars is ACCEPTED (200)
 * 9. POST /api/bob/chat with 2001 chars is REJECTED (400 MESSAGE_TOO_LONG)
 * 10. GET /api/bob/chat returns 405 Method Not Allowed
 * 11. GET /api/bob/invalid returns 404
 * 12. OPTIONS /api/bob/chat returns CORS preflight headers
 */

process.env.BOP_BOB_LLM_ENABLED = 'false';
process.env.BOP_BOB_PROVIDER = 'stub';

import { createServer } from '../server.js';
import { config } from '../config.js';

config.llmEnabled = false;
config.llmProvider = 'stub';

const TEST_PORT = 8789;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runTests() {
  console.log('--- Starting Bop Bob Backend Tests (Phase 11A.2.1) ---');
  let passed = 0;
  let failed = 0;

  const server = createServer();
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Health check minimal payload
    await test('GET /api/bob/health returns 200 with exact minimalist keys', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/health`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.ok || body.service !== 'bop-bob-backend' || body.provider !== 'stub') {
        throw new Error(`Unexpected payload keys/values: ${JSON.stringify(body)}`);
      }
    });

    // 2. Health check does NOT leak sensitive/internal fields
    await test('GET /api/bob/health does NOT expose version, uptime_seconds, or environment', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/health`);
      const body = await res.json();
      if ('version' in body) throw new Error('Health check leaked "version"');
      if ('uptime_seconds' in body) throw new Error('Health check leaked "uptime_seconds"');
      if ('environment' in body) throw new Error('Health check leaked "environment"');
      if ('timestamp' in body) throw new Error('Health check leaked "timestamp"');
    });

    // 3. Chat ES
    await test('POST /api/bob/chat (ES) returns structured stub reply', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hola Bob, ¿cómo funciona BOP?',
          language: 'es',
          session_id: 'bob-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          page: 'home'
        })
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.ok || !body.reply || body.provider !== 'stub' || body.language !== 'es') {
        throw new Error(`Invalid response structure: ${JSON.stringify(body)}`);
      }
      if (!body.session_id || body.source !== 'stub' || !Array.isArray(body.sources)) {
        throw new Error(`Contract missing required keys: ${JSON.stringify(body)}`);
      }
    });

    // 4. Chat EN
    await test('POST /api/bob/chat (EN) returns structured stub reply', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello Bob, tell me about BOP agency',
          language: 'en',
          session_id: 'bob-123e4567-e89b-12d3-a456-426614174000'
        })
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.ok || !body.reply || body.language !== 'en') {
        throw new Error(`Invalid response structure: ${JSON.stringify(body)}`);
      }
    });

    // 5. Empty message validation
    await test('POST /api/bob/chat with empty message returns 400', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '   ',
          language: 'es'
        })
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.ok !== false || body.code !== 'EMPTY_MESSAGE') {
        throw new Error(`Expected EMPTY_MESSAGE code, got ${body.code}`);
      }
    });

    // 6. Invalid language validation
    await test('POST /api/bob/chat with invalid language returns 400', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Bonjour',
          language: 'fr'
        })
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.ok !== false || body.code !== 'INVALID_LANGUAGE') {
        throw new Error(`Expected INVALID_LANGUAGE code, got ${body.code}`);
      }
    });

    // 7. Message length 1999 characters (accepted 200)
    await test('POST /api/bob/chat with 1999 chars is accepted (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'a'.repeat(1999),
          language: 'es'
        })
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.ok) throw new Error('Expected ok: true');
    });

    // 8. Message length 2000 characters (accepted 200)
    await test('POST /api/bob/chat with exactly 2000 chars is accepted (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'b'.repeat(2000),
          language: 'es'
        })
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.ok) throw new Error('Expected ok: true');
    });

    // 9. Message length 2001 characters (rejected 400 MESSAGE_TOO_LONG)
    await test('POST /api/bob/chat with 2001 chars returns 400 MESSAGE_TOO_LONG', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'c'.repeat(2001),
          language: 'es'
        })
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.ok !== false || body.code !== 'MESSAGE_TOO_LONG') {
        throw new Error(`Expected MESSAGE_TOO_LONG code, got ${body.code}`);
      }
    });

    // 10. Method Not Allowed
    await test('GET /api/bob/chat returns 405 Method Not Allowed', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`);
      if (res.status !== 405) throw new Error(`Expected 405, got ${res.status}`);
    });

    // 11. 404 Route Not Found
    await test('GET /api/bob/non-existent returns 404', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/non-existent`);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    // 12. OPTIONS Preflight CORS
    await test('OPTIONS /api/bob/chat returns CORS preflight headers', async () => {
      const res = await fetch(`${BASE_URL}/api/bob/chat`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:8080',
          'Access-Control-Request-Method': 'POST'
        }
      });
      if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
      if (res.headers.get('access-control-allow-origin') !== 'http://localhost:8080') {
        throw new Error(`CORS header mismatch: ${res.headers.get('access-control-allow-origin')}`);
      }
    });

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nTest results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
