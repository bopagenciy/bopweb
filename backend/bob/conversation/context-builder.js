/**
 * Context Builder for Grounded LLM Prompts
 * 
 * Formats retrieved chunks into clean, structured sections while strictly
 * respecting the maximum context character ceiling (BOP_BOB_MAX_CONTEXT_CHARS).
 */

export function buildGroundedContext(retrievalResults = [], maxChars = 12000) {
  if (!Array.isArray(retrievalResults) || retrievalResults.length === 0) {
    return '';
  }

  const sections = [];
  let currentLength = 0;

  for (let i = 0; i < retrievalResults.length; i++) {
    const item = retrievalResults[i];
    const sourceLabel = item.citation?.label || item.source_name || `Source ${i + 1}`;
    const sectionName = item.section || 'General';
    const sourceId = item.source_id || 'unknown';
    const textContent = (item.text || '').trim();

    const blockHeader = `[DOCUMENT ${i + 1}]\nSource: ${sourceLabel}\nSource ID: ${sourceId}\nSection: ${sectionName}\nContent:\n`;
    const block = `${blockHeader}${textContent}\n`;

    if (currentLength + block.length > maxChars && sections.length > 0) {
      // If adding the full block exceeds limit, attempt truncation if meaningful, otherwise stop
      const remainingChars = maxChars - currentLength - blockHeader.length - 10;
      if (remainingChars > 150) {
        const truncatedContent = textContent.substring(0, remainingChars).trim() + '...';
        sections.push(`${blockHeader}${truncatedContent}\n`);
      }
      break;
    }

    sections.push(block);
    currentLength += block.length;
  }

  return sections.join('\n');
}

export default {
  buildGroundedContext
};
