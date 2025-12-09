/**
 * Response Deduplication Service
 *
 * Detects and removes duplicated content in RAG responses
 * Uses Jaccard similarity to identify semantically similar paragraphs
 */

interface DeduplicationResult {
  text: string;
  duplicatesRemoved: number;
  originalParagraphs: number;
  finalParagraphs: number;
}

/**
 * Main deduplication function
 */
export function deduplicateResponse(response: string): DeduplicationResult {
  console.log('🔍 [DEDUPLICATE] Starting deduplication analysis');

  // Split response into paragraphs
  const paragraphs = response.split('\n\n').filter(p => p.trim().length > 0);
  console.log(`📊 [DEDUPLICATE] Found ${paragraphs.length} paragraphs`);

  const seen = new Set<string>();
  const deduplicated: string[] = [];
  let duplicatesRemoved = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // Normalize paragraph (remove whitespace, lowercase, remove formatting)
    const normalized = normalizeParagraph(para);

    // Skip very short paragraphs (< 20 chars) - likely formatting
    if (normalized.length < 20) {
      deduplicated.push(para);
      continue;
    }

    // Check if we've seen similar content (>70% similarity)
    let isDuplicate = false;
    let maxSimilarity = 0;

    const seenArray = Array.from(seen);
    for (let j = 0; j < seenArray.length; j++) {
      const seenPara = seenArray[j];
      const similarity = calculateSimilarity(normalized, seenPara);
      maxSimilarity = Math.max(maxSimilarity, similarity);

      if (similarity > 0.7) {
        isDuplicate = true;
        console.log(`❌ [DEDUPLICATE] Paragraph ${i + 1} is ${(similarity * 100).toFixed(1)}% similar - REMOVING`);
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(para);
      seen.add(normalized);
    } else {
      duplicatesRemoved++;
    }
  }

  const result = {
    text: deduplicated.join('\n\n'),
    duplicatesRemoved,
    originalParagraphs: paragraphs.length,
    finalParagraphs: deduplicated.length
  };

  if (duplicatesRemoved > 0) {
    console.log(`✅ [DEDUPLICATE] Removed ${duplicatesRemoved} duplicate paragraphs (${paragraphs.length} → ${deduplicated.length})`);
  } else {
    console.log(`✅ [DEDUPLICATE] No duplicates found`);
  }

  return result;
}

/**
 * Normalize paragraph for comparison
 */
function normalizeParagraph(paragraph: string): string {
  return paragraph
    .toLowerCase()
    .replace(/\*\*/g, '') // Remove bold
    .replace(/\*/g, '') // Remove italic
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
    .replace(/[•\-\*]/g, '') // Remove bullet points
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

/**
 * Calculate Jaccard similarity between two strings
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = a.split(' ').filter(w => w.length > 2); // Ignore short words
  const wordsB = b.split(' ').filter(w => w.length > 2);

  if (wordsA.length === 0 || wordsB.length === 0) {
    return 0;
  }

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  // Calculate intersection count
  let intersectionCount = 0;
  for (let i = 0; i < wordsA.length; i++) {
    if (setB.has(wordsA[i])) {
      intersectionCount++;
    }
  }

  // Calculate union using concat and Set
  const allWords = wordsA.concat(wordsB);
  const unionSet = new Set(allWords);

  return intersectionCount / unionSet.size;
}

export default { deduplicateResponse };
