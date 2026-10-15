import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOB_DIR = path.resolve(__dirname, '..');
const BOTINFO_DIR = path.resolve(BOB_DIR, 'botinfo');
const GENERATED_DIR = path.resolve(BOTINFO_DIR, 'generated');

/**
 * Display knowledge corpus status from generated manifest.json
 */
export async function showKnowledgeStatus(generatedDir = GENERATED_DIR) {
  const manifestPath = path.join(generatedDir, 'manifest.json');

  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);

    console.log(`\n==================================================`);
    console.log(`BOP AGENCIA — BOB KNOWLEDGE CORPUS STATUS`);
    console.log(`==================================================`);
    console.log(`Schema Version:      ${manifest.schema_version}`);
    console.log(`Last Generated:      ${manifest.generated_at}`);
    console.log(`Sources:             ${manifest.source_count}`);
    console.log(`  - Documents:       ${manifest.document_count}`);
    console.log(`  - Website sections: ${manifest.website_source_count}`);
    console.log(`Total Chunks:        ${manifest.chunk_count}`);
    console.log(`\nLanguages (Sources):`);
    console.log(`  ES:                ${manifest.language_counts.es || 0}`);
    console.log(`  EN:                ${manifest.language_counts.en || 0}`);
    console.log(`  Unknown:           ${manifest.language_counts.unknown || 0}`);
    console.log(`\nLanguages (Chunks):`);
    console.log(`  ES:                ${manifest.chunk_language_counts.es || 0}`);
    console.log(`  EN:                ${manifest.chunk_language_counts.en || 0}`);
    console.log(`  Unknown:           ${manifest.chunk_language_counts.unknown || 0}`);
    console.log(`\nDiagnostics:`);
    console.log(`  Needs OCR:         ${manifest.needs_ocr_count}`);
    console.log(`  Failed:            ${manifest.failed_count}`);

    if (manifest.failed_sources && manifest.failed_sources.length > 0) {
      console.log(`\nFailed Sources:`);
      for (const fs of manifest.failed_sources) {
        console.log(`  - ${fs.name}: ${fs.error}`);
      }
    }

    console.log(`==================================================\n`);
    return manifest;
  } catch (err) {
    console.log(`\n[INFO] No generated knowledge corpus found at ${manifestPath}.`);
    console.log(`Run 'npm run knowledge:ingest' to process documents and generate the initial corpus.\n`);
    return null;
  }
}

if (process.argv[1] && process.argv[1].endsWith('status.js')) {
  showKnowledgeStatus().catch((err) => {
    console.error('Fatal status error:', err);
    process.exit(1);
  });
}
