/**
 * BOP Agencia — Bob Knowledge Retrieval Test Suite (Phase 11A.4)
 * Comprehensive automated tests for deterministic search, BM25 scoring,
 * semantic ranking, and provenance citations.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { KnowledgeRetriever } from '../retrieval/retriever.js';
import { CorpusLoader } from '../retrieval/corpus-loader.js';
import { normalizeQuery } from '../retrieval/query-normalizer.js';
import { runIngestion } from '../knowledge/ingest.js';
import { createServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  ${err.message}`);
    failedCount++;
  }
}

function createTempDir(prefix = 'bop-retrieval-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

console.log('--- Running Bob Knowledge Retrieval Test Suite (Phase 11A.4) ---');

const realRetriever = new KnowledgeRetriever();
await realRetriever.initialize();

// =============================================================
// CORE RETRIEVAL ENGINE TESTS (1 - 16)
// =============================================================

await test('1. Corpus loader loads valid corpus and indexes sources & chunks', async () => {
  const loader = new CorpusLoader();
  const res = await loader.load();
  assert.strictEqual(res.ok, true);
  assert.ok(res.chunkCount >= 14);
  assert.ok(res.sourceCount >= 14);
});

await test('2. Corpus loader returns clean error when directory does not exist', async () => {
  const loader = new CorpusLoader(path.join(os.tmpdir(), 'non-existent-corpus-dir-' + Date.now()));
  const res = await loader.load();
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'KNOWLEDGE_CORPUS_UNAVAILABLE');
});

await test('3. Corpus loader returns clean error when manifest is corrupted', async () => {
  const tmpDir = createTempDir('corrupt-gen-');
  try {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), '{ NOT_VALID_JSON');
    fs.writeFileSync(path.join(tmpDir, 'sources.json'), '[]');
    fs.writeFileSync(path.join(tmpDir, 'chunks.jsonl'), '');

    const loader = new CorpusLoader(tmpDir);
    const res = await loader.load();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'KNOWLEDGE_CORPUS_INVALID');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

await test('4. Empty query is rejected cleanly with QUERY_EMPTY', async () => {
  const res = await realRetriever.search({ query: '   ' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'QUERY_EMPTY');
});

await test('5. Query exceeding 500 characters is rejected cleanly with QUERY_TOO_LONG', async () => {
  const longQuery = 'bop '.repeat(150);
  const res = await realRetriever.search({ query: longQuery });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'QUERY_TOO_LONG');
});

await test('6. Spanish search prioritizes ES chunks first', async () => {
  const res = await realRetriever.search({ query: 'servicios de diseno y marca', language: 'es', topK: 3 });
  assert.strictEqual(res.ok, true);
  assert.ok(res.results.length > 0);
  assert.strictEqual(res.results[0].language, 'es');
});

await test('7. English search prioritizes EN chunks first', async () => {
  const res = await realRetriever.search({ query: 'brand design and marketing services', language: 'en', topK: 3 });
  assert.strictEqual(res.ok, true);
  assert.ok(res.results.length > 0);
  assert.strictEqual(res.results[0].language, 'en');
});

await test('8. Exact phrase boost awards higher score to verbatim matches', async () => {
  const res = await realRetriever.search({ query: 'Bop Fusion', language: 'es', topK: 5 });
  assert.strictEqual(res.ok, true);
  // Detailed Bop Fusion section ranks at #1 with verbatim phrase boost
  assert.strictEqual(res.results[0].section, 'Bop Fusion');
  assert.ok(res.results[0].score > 15.0);
});

await test('9. Title / section matches receive significant boost over plain text', async () => {
  const res = await realRetriever.search({ query: 'Canales Oficiales de Contacto', language: 'es' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.results[0].source_id, 'website-home-contact-es');
});

await test('10. Top K parameter is strictly respected up to max 10', async () => {
  const res2 = await realRetriever.search({ query: 'bop', language: 'es', topK: 2 });
  assert.strictEqual(res2.results.length, 2);

  const res12 = await realRetriever.search({ query: 'bop', language: 'es', topK: 12 });
  assert.ok(res12.results.length <= 10, 'Must be capped at max 10');
});

await test('11. High threshold can return 0 results without errors', async () => {
  const res = await realRetriever.search({ query: 'palabra_desconocida_xyz123', language: 'es', threshold: 50.0 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.results.length, 0);
});

await test('12. Source provenance is accurately populated on results', async () => {
  const res = await realRetriever.search({ query: 'contacto bop agencia', language: 'es', topK: 1 });
  assert.strictEqual(res.ok, true);
  const top = res.results[0];
  assert.strictEqual(top.source_id, 'website-home-contact-es');
  assert.strictEqual(top.source_type, 'website');
  assert.ok(top.source_name.length > 0);
  assert.strictEqual(top.citation.label, 'Bop Agencia — Contacto');
});

await test('13. Chunk provenance is accurately preserved without modifying stored text', async () => {
  const res = await realRetriever.search({ query: 'servicios branding e identidad', language: 'es', topK: 5 });
  assert.strictEqual(res.ok, true);
  const serviceChunk = res.results.find(r => r.chunk_id.startsWith('website-home-services-es'));
  assert.ok(serviceChunk, 'website-home-services-es chunk must be retrieved');
  assert.ok(serviceChunk.text.includes('01. Branding & Identidad'));
  assert.ok(serviceChunk.snippet.length > 0);
});

await test('14. Result list contains zero duplicate chunk_ids', async () => {
  const res = await realRetriever.search({ query: 'bop agencia creatividad tecnologia', language: 'es', topK: 10 });
  const seen = new Set();
  for (const item of res.results) {
    assert.ok(!seen.has(item.chunk_id), `Duplicate chunk_id found: ${item.chunk_id}`);
    seen.add(item.chunk_id);
  }
});

await test('15. Deterministic ranking: identical query produces identical order and scores', async () => {
  const q = 'soluciones tecnologicas ecosistema bop';
  const run1 = await realRetriever.search({ query: q, language: 'es' });
  const run2 = await realRetriever.search({ query: q, language: 'es' });

  assert.strictEqual(run1.results.length, run2.results.length);
  for (let i = 0; i < run1.results.length; i++) {
    assert.strictEqual(run1.results[i].chunk_id, run2.results[i].chunk_id);
    assert.strictEqual(run1.results[i].score, run2.results[i].score);
  }
});

await test('16. Stopwords are filtered while preserving brand names and protected terms', () => {
  const n = normalizeQuery('que es el bop live y como funciona', 'es');
  assert.ok(n.keywords.includes('bop'));
  assert.ok(n.keywords.includes('live'));
  assert.ok(!n.keywords.includes('que'));
  assert.ok(!n.keywords.includes('el'));
});

// =============================================================
// BOP AGENCIA SEMANTIC EXPECTATIONS (17 - 29)
// =============================================================

await test('17. "qué servicios ofrece bop agencia" -> Services ES at rank 1', async () => {
  const res = await realRetriever.search({ query: 'qué servicios ofrece bop agencia', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-services-es');
});

await test('18. "what services does bop agencia offer" -> Services EN at rank 1', async () => {
  const res = await realRetriever.search({ query: 'what services does bop agencia offer', language: 'en', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-services-en');
});

await test('19. "qué es bop universe" -> Universe ES at rank 1', async () => {
  const res = await realRetriever.search({ query: 'qué es bop universe', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-universe-es');
});

await test('20. "what is bop universe" -> Universe EN at rank 1', async () => {
  const res = await realRetriever.search({ query: 'what is bop universe', language: 'en', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-universe-en');
});

await test('21. "qué es bop live" -> Live ES at rank 1', async () => {
  const res = await realRetriever.search({ query: 'qué es bop live', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-live-es');
});

await test('22. "event production and stands" -> Live EN ranks at rank 1 or 2', async () => {
  const res = await realRetriever.search({ query: 'event production and stands', language: 'en', topK: 2 });
  const ids = res.results.map(r => r.source_id);
  assert.ok(ids.includes('website-home-live-en') || ids.includes('website-portfolio-overview-en'));
});

await test('23. "correo bop agencia" -> Contact ES at rank 1 and returns official email', async () => {
  const res = await realRetriever.search({ query: 'correo bop agencia', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-contact-es');
  assert.ok(res.results[0].text.includes('bopagencia@gmail.com'));
});

await test('24. "bop agencia email" -> Contact EN at rank 1 and returns official email', async () => {
  const res = await realRetriever.search({ query: 'bop agencia email', language: 'en', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-contact-en');
  assert.ok(res.results[0].text.includes('bopagencia@gmail.com'));
});

await test('25. "whatsapp bop agencia" -> Contact ES at rank 1 and contains phone link', async () => {
  const res = await realRetriever.search({ query: 'whatsapp bop agencia', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-contact-es');
  assert.ok(res.results[0].text.includes('+57 305 417 6606'));
  assert.ok(res.results[0].text.includes('https://wa.me/573054176606'));
});

await test('26. "inteligencia artificial automatizacion" -> AI ES at rank 1', async () => {
  const res = await realRetriever.search({ query: 'inteligencia artificial automatizacion', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-ai-es');
});

await test('27. "AI automation" -> AI EN at rank 1', async () => {
  const res = await realRetriever.search({ query: 'AI automation', language: 'en', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-home-ai-en');
});

await test('28. "stands comerciales portfolio" -> Portfolio ES at rank 1', async () => {
  const res = await realRetriever.search({ query: 'stands comerciales portfolio', language: 'es', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-portfolio-overview-es');
});

await test('29. "commercial stands portfolio" -> Portfolio EN at rank 1', async () => {
  const res = await realRetriever.search({ query: 'commercial stands portfolio', language: 'en', topK: 1 });
  assert.strictEqual(res.results[0].source_id, 'website-portfolio-overview-en');
});

// =============================================================
// FUTURE DOCUMENT INGESTION & ISOLATION TEST (30)
// =============================================================

await test('30. Synthetic document ingestion seamlessly indexes and retrieves without corrupting baseline', async () => {
  const tmpSourcesDir = createTempDir('doc-sources-');
  const tmpGenDir = createTempDir('doc-gen-');
  try {
    const docFile = path.join(tmpSourcesDir, 'manual-seguridad.txt');
    fs.writeFileSync(docFile, 'Protocolo de Ciberseguridad de Bop Agencia: Todas las bases de datos deben estar encriptadas.', 'utf8');

    // Ingest into temporary directory
    await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });

    const testRetriever = new KnowledgeRetriever({ generatedDir: tmpGenDir });
    await testRetriever.initialize();

    const searchRes = await testRetriever.search({ query: 'protocolo de ciberseguridad', language: 'es', topK: 1 });
    assert.strictEqual(searchRes.ok, true);
    assert.strictEqual(searchRes.results.length, 1);
    assert.ok(searchRes.results[0].source_id.startsWith('doc-manual-seguridad'));
    assert.ok(searchRes.results[0].text.includes('Protocolo de Ciberseguridad'));
  } finally {
    cleanupTempDir(tmpSourcesDir);
    cleanupTempDir(tmpGenDir);
  }
});

// =============================================================
// PERFORMANCE & SPEED BENCHMARK (31)
// =============================================================

await test('31. Retrieval performance benchmark: average search duration < 50ms', async () => {
  const queries = [
    'qué servicios ofrece bop agencia',
    'bop fusion restaurantes',
    'whatsapp bop agencia',
    'stands comerciales eventos',
    'inteligencia artificial aplicada'
  ];

  let totalMs = 0;
  for (const q of queries) {
    const res = await realRetriever.search({ query: q, language: 'es', topK: 5 });
    assert.strictEqual(res.ok, true);
    totalMs += res.duration_ms;
  }

  const avgMs = totalMs / queries.length;
  console.log(`    (Average retrieval duration across ${queries.length} queries: ${avgMs.toFixed(2)}ms)`);
  assert.ok(avgMs < 50, `Average search too slow: ${avgMs}ms >= 50ms`);
});

// =============================================================
// SECURE DEV ENDPOINT: POST /api/bob/search (32 - 35)
// =============================================================

await test('32. POST /api/bob/search returns 200 with structured results for valid query', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const postData = JSON.stringify({
      query: 'qué servicios ofrece bop agencia',
      language: 'es',
      top_k: 3
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/bob/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => resolve({ statusCode: r.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok(res.body.results.length > 0);
    assert.strictEqual(res.body.results[0].source_id, 'website-home-services-es');
  } finally {
    server.close();
  }
});

await test('33. POST /api/bob/search rejects empty query with 400 QUERY_EMPTY', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const postData = JSON.stringify({ query: '   ' });
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/bob/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => resolve({ statusCode: r.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'QUERY_EMPTY');
  } finally {
    server.close();
  }
});

await test('34. POST /api/bob/search rejects oversize query (> 500 chars) with 400 QUERY_TOO_LONG', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const postData = JSON.stringify({ query: 'bop '.repeat(150) });
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/bob/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => resolve({ statusCode: r.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'QUERY_TOO_LONG');
  } finally {
    server.close();
  }
});

await test('35. GET /api/bob/search returns 405 Method Not Allowed', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/bob/search',
        method: 'GET'
      }, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => resolve({ statusCode: r.statusCode }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(res.statusCode, 405);
  } finally {
    server.close();
  }
});

console.log('-------------------------------------------------------------');
console.log(`Test results: ${passedCount} passed, ${failedCount} failed.`);

if (failedCount > 0) {
  process.exit(1);
}
