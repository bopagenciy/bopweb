#!/usr/bin/env node
/**
 * BOP Agencia — Bob Knowledge Retrieval CLI
 * 
 * Usage:
 *   node search-cli.js "qué servicios ofrece Bop Agencia"
 *   node search-cli.js --query "Bop Fusion" --lang es --top 3
 *   npm run knowledge:search -- "what services does Bop Agencia offer" --lang en
 */

import { knowledgeRetriever } from './retriever.js';

function parseArgs(args) {
  let query = '';
  let language = 'es';
  let topK = 5;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--lang' && args[i + 1]) {
      language = args[++i];
    } else if (arg === '--top' && args[i + 1]) {
      topK = parseInt(args[++i], 10) || 5;
    } else if (arg === '--query' && args[i + 1]) {
      query = args[++i];
    } else if (!arg.startsWith('--') && !query) {
      query = arg;
    }
  }

  return { query, language, topK };
}

async function run() {
  const { query, language, topK } = parseArgs(process.argv.slice(2));

  if (!query) {
    console.log(`
Usage:
  npm run knowledge:search -- "<query>" [--lang es|en] [--top 5]

Example:
  npm run knowledge:search -- "qué servicios ofrece Bop Agencia" --lang es
  npm run knowledge:search -- "what services does Bop Agencia offer" --lang en
`);
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`BOP AGENCIA — BOB KNOWLEDGE RETRIEVAL`);
  console.log(`Query:     "${query}"`);
  console.log(`Language:  ${language.toUpperCase()}`);
  console.log(`Top K:     ${topK}`);
  console.log(`==================================================\n`);

  const response = await knowledgeRetriever.search({
    query,
    language,
    topK
  });

  if (!response.ok) {
    console.error(`Error: [${response.error}] ${response.details || ''}`);
    process.exit(1);
  }

  console.log(`Found ${response.total_matches} matching chunk(s) in ${response.duration_ms}ms.\n`);

  if (response.results.length === 0) {
    console.log(`(No results met the relevance threshold)`);
  }

  for (const item of response.results) {
    console.log(`--------------------------------------------------`);
    console.log(`#${item.rank} | Score: ${item.score} | Lang: ${item.language.toUpperCase()}`);
    console.log(`Citation: ${item.citation.label}`);
    console.log(`Section:  ${item.section}`);
    console.log(`Source:   ${item.source_id}`);
    console.log(`Snippet:  "${item.snippet}"`);
  }

  console.log(`--------------------------------------------------\n`);
}

run().catch(err => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
