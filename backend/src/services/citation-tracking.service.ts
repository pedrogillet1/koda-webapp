// ════════════════════════════════════════════════════════════════════════════════
// ACCURATE SOURCE TRACKING - Citation Extraction
// ════════════════════════════════════════════════════════════════════════════════
// Purpose: Track which documents the LLM actually used in its answer
// Problem: Currently showing ALL retrieved documents, even if unused
// Solution: Extract citations from LLM response + fallback to name matching

import prisma from '../config/database';

export interface Citation {
  documentId: string;
  pages: number[];
}

/**
 * Extract citations from LLM response
 *
 * The LLM is instructed to include a hidden citation block:
 * ---CITATIONS---
 * documentId: abc123, pages: [1, 3]
 * documentId: def456, pages: [2]
 * ---END_CITATIONS---
 */
export function extractCitations(llmResponse: string): Citation[] {
  // Look for citation block
  const match = llmResponse.match(/---CITATIONS---\n([\s\S]*?)\n---END_CITATIONS---/);

  if (!match) {
    console.log('⚠️ [CITATIONS] No citation block found in LLM response');
    return [];
  }

  const citationText = match[1].trim();

  // Check if LLM explicitly stated no documents used
  if (citationText === 'NONE') {
    console.log('✅ [CITATIONS] LLM explicitly stated no documents used');
    return [];
  }

  const citations: Citation[] = [];
  const lines = citationText.split('\n');

  for (const line of lines) {
    // Parse format: documentId: abc123, pages: [1, 3, 5]
    const docMatch = line.match(/documentId:\s*([a-zA-Z0-9_-]+),\s*pages:\s*\[([\d,\s]*)\]/);
    if (docMatch) {
      const documentId = docMatch[1];
      const pagesStr = docMatch[2];

      // Parse page numbers
      const pages = pagesStr
        .split(',')
        .map(p => parseInt(p.trim()))
        .filter(p => !isNaN(p) && p > 0);

      citations.push({
        documentId,
        pages: pages.length > 0 ? pages : []
      });
    }
  }

  console.log(`✅ [CITATIONS] Extracted ${citations.length} citations from LLM response`);
  return citations;
}

/**
 * Build sources from LLM citations
 */
export async function buildSourcesFromCitations(
  citations: Citation[],
  retrievedChunks: any[]
): Promise<any[]> {

  if (citations.length === 0) {
    return [];
  }

  const sources: any[] = [];
  const documentIds = [...new Set(citations.map(c => c.documentId))];

  console.log(`📚 [SOURCES] Building sources from ${documentIds.length} cited documents`);

  // Fetch document metadata from database
  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, filename: true, mimeType: true }
  });

  const docMap = new Map(documents.map(d => [d.id, d]));

  for (const citation of citations) {
    const doc = docMap.get(citation.documentId);

    if (!doc) {
      console.warn(`⚠️ [SOURCES] Document ${citation.documentId} not found in database`);
      continue;
    }

    // Find the chunk with the highest score for this document
    const docChunks = retrievedChunks.filter(c => c.metadata?.documentId === citation.documentId);
    const bestScore = docChunks.length > 0 ? Math.max(...docChunks.map(c => c.score || c.rerankScore || 0)) : 1.0;

    sources.push({
      documentId: doc.id,
      documentName: doc.filename,
      pageNumber: citation.pages[0] || null, // First page used
      score: bestScore,
      mimeType: doc.mimeType
    });
  }

  console.log(`✅ [SOURCES] Built ${sources.length} sources from citations`);
  return sources;
}

/**
 * Fallback: Match documents by name in answer
 *
 * Used when LLM doesn't provide citation block.
 * Checks if document filename appears in the answer text.
 */
export function fallbackToNameMatching(answer: string, retrievedChunks: any[]): any[] {
  console.log('⚠️ [CITATIONS] Falling back to document name matching');

  const lowerAnswer = answer.toLowerCase();
  const usedDocIds = new Set<string>();

  // Check each chunk's document name
  for (const chunk of retrievedChunks) {
    const docName = chunk.metadata?.filename || '';
    if (!docName) continue;

    // Remove file extension for matching
    const baseName = docName.toLowerCase().replace(/\.[^/.]+$/, '');

    // Check if document name appears in answer
    if (lowerAnswer.includes(baseName)) {
      usedDocIds.add(chunk.metadata?.documentId);
    }
  }

  if (usedDocIds.size === 0) {
    console.log('⚠️ [CITATIONS] Name matching found no documents');
    return [];
  }

  // Build sources from matched documents
  const sources = retrievedChunks
    .filter(c => usedDocIds.has(c.metadata?.documentId))
    .map(c => ({
      documentId: c.metadata?.documentId,
      documentName: c.metadata?.filename,
      pageNumber: c.metadata?.page || c.metadata?.pageNumber || null,
      score: c.score || c.rerankScore || 0,
      mimeType: c.metadata?.mimeType
    }));

  // Deduplicate by documentId (keep highest score)
  const uniqueSources = Array.from(
    new Map(sources.map(s => [s.documentId, s])).values()
  );

  console.log(`✅ [CITATIONS] Name matching found ${uniqueSources.length} documents`);
  return uniqueSources;
}

/**
 * Remove citation block from answer before sending to user
 */
export function removeCitationBlock(answer: string): string {
  return answer.replace(/---CITATIONS---\n[\s\S]*?\n---END_CITATIONS---\n?/g, '').trim();
}

/**
 * Main function: Build accurate sources from LLM response
 *
 * Strategy:
 * 1. Try to extract citations from LLM response
 * 2. If no citations, fallback to name matching
 * 3. If no matches, return empty sources
 */
export async function buildAccurateSources(
  llmResponse: string,
  retrievedChunks: any[]
): Promise<any[]> {

  console.log('🔍 [SOURCES] Building accurate sources from LLM response');

  // Step 1: Try to extract citations
  const citations = extractCitations(llmResponse);

  if (citations.length > 0) {
    console.log('✅ [SOURCES] Using LLM citations (most accurate)');
    return await buildSourcesFromCitations(citations, retrievedChunks);
  }

  // Step 2: Fallback to name matching
  const matchedSources = fallbackToNameMatching(llmResponse, retrievedChunks);

  if (matchedSources.length > 0) {
    console.log('✅ [SOURCES] Using name matching fallback');
    return matchedSources;
  }

  // Step 3: No documents used
  console.log('✅ [SOURCES] No documents used in answer (empty sources)');
  return [];
}
