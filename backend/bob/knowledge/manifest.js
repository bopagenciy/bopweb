import fs from 'node:fs/promises';
import path from 'node:path';

const MANIFEST_SCHEMA_VERSION = '1.0.0';

/**
 * Generate a comprehensive manifest summarizing the ingestion state
 * 
 * @param {object} params
 * @param {Array<object>} params.sources Array of processed source documents
 * @param {Array<object>} params.chunks Array of all generated chunks
 * @param {Array<object>} params.failedSources Array of sources that failed validation or parsing
 * @returns {object} Manifest summary object
 */
export function buildManifest({ sources = [], chunks = [], failedSources = [] }) {
  const languageCounts = { es: 0, en: 0, unknown: 0 };
  const formatCounts = {};
  let documentCount = 0;
  let websiteSourceCount = 0;
  let needsOcrCount = 0;

  for (const src of sources) {
    if (src.source_type === 'document') {
      documentCount++;
    } else if (src.source_type === 'website') {
      websiteSourceCount++;
    }

    const lang = src.language || 'unknown';
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;

    const fmt = src.format || 'unknown';
    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;

    if (src.needs_ocr) {
      needsOcrCount++;
    }
  }

  // Count languages in chunks as well
  const chunkLanguageCounts = { es: 0, en: 0, unknown: 0 };
  for (const c of chunks) {
    const l = c.language || 'unknown';
    chunkLanguageCounts[l] = (chunkLanguageCounts[l] || 0) + 1;
  }

  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_count: sources.length,
    document_count: documentCount,
    website_source_count: websiteSourceCount,
    chunk_count: chunks.length,
    language_counts: languageCounts,
    chunk_language_counts: chunkLanguageCounts,
    format_counts: formatCounts,
    needs_ocr_count: needsOcrCount,
    failed_count: failedSources.length,
    failed_sources: failedSources.map(f => ({
      name: f.filename || f.source_name || 'unknown',
      error: f.error || 'UNKNOWN_ERROR'
    }))
  };
}

/**
 * Save generated corpus: manifest.json, sources.json, chunks.jsonl
 * 
 * @param {string} outputDir Target generated/ directory
 * @param {object} manifest Manifest object
 * @param {Array<object>} sources Array of sources
 * @param {Array<object>} chunks Array of chunks
 */
export async function saveGeneratedCorpus(outputDir, manifest, sources, chunks) {
  await fs.mkdir(outputDir, { recursive: true });

  const manifestPath = path.join(outputDir, 'manifest.json');
  const sourcesPath = path.join(outputDir, 'sources.json');
  const chunksPath = path.join(outputDir, 'chunks.jsonl');

  // Strip large raw text from sources.json for clean metadata index
  const sourcesMetadata = sources.map(s => {
    const copy = { ...s };
    delete copy.text; // Text lives in chunks.jsonl
    return copy;
  });

  const chunksJsonlContent = chunks.map(c => JSON.stringify(c)).join('\n') + (chunks.length ? '\n' : '');

  await Promise.all([
    fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8'),
    fs.writeFile(sourcesPath, JSON.stringify(sourcesMetadata, null, 2), 'utf-8'),
    fs.writeFile(chunksPath, chunksJsonlContent, 'utf-8')
  ]);
}
