/**
 * Server-Owned Citation Mapper
 * 
 * Rules:
 * - Citations are EXCLUSIVELY derived from verified retrieval results.
 * - The LLM NEVER generates or hallucinates citation sources.
 * - Deduplicates citations by source_id while preserving ranked relevance order.
 */

export function mapRetrievalCitations(retrievalResults = []) {
  if (!Array.isArray(retrievalResults)) return [];

  const seenSourceIds = new Set();
  const citations = [];

  for (const item of retrievalResults) {
    const sourceId = item.source_id;
    if (!sourceId || seenSourceIds.has(sourceId)) {
      continue;
    }
    seenSourceIds.add(sourceId);

    citations.push({
      label: item.citation?.label || item.source_name || 'Bop Agencia',
      source: item.source_type || 'website',
      source_id: sourceId,
      section: item.section || 'General'
    });
  }

  return citations;
}

export default {
  mapRetrievalCitations
};
