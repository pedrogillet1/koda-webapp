/**
 * Multi-Intent Detection Service
 *
 * Detects when a user query contains multiple distinct intents
 * that should be handled separately.
 */

import { IntentClassificationV3 } from '../../types/ragV3.types';

export interface MultiIntentResult {
  isMultiIntent: boolean;
  segments: string[];
  intents?: IntentClassificationV3[];
}

class MultiIntentService {
  // Delimiters that separate intents (with surrounding spaces to avoid false positives)
  private readonly delimiterPatterns = [
    / and also /i,
    / and then /i,
    / and /i,
    / e também /i,
    / e depois /i,
    / e /i,
    / y también /i,
    / y luego /i,
    / y /i,
    /; /,
    /\. /,
  ];

  /**
   * Detect if query contains multiple intents by analyzing delimiters and structure.
   *
   * @param query - The raw user query
   * @returns MultiIntentResult with segments if multi-intent detected
   */
  public detect(query: string): MultiIntentResult {
    if (!query || query.trim().length === 0) {
      return { isMultiIntent: false, segments: [] };
    }

    const normalizedQuery = query.trim();

    // Don't split very short queries
    if (normalizedQuery.length < 20) {
      return { isMultiIntent: false, segments: [normalizedQuery] };
    }

    // Try to split by delimiters
    const segments = this.splitByDelimiters(normalizedQuery);

    // Filter out very short segments (likely not real intents)
    const validSegments = segments.filter(s => s.length >= 5);

    if (validSegments.length > 1) {
      return {
        isMultiIntent: true,
        segments: validSegments,
      };
    }

    return { isMultiIntent: false, segments: [normalizedQuery] };
  }

  /**
   * Split query by intent delimiters, respecting quotes and parentheses.
   */
  private splitByDelimiters(query: string): string[] {
    let workingQuery = query;

    // Protect quoted strings by replacing them temporarily
    const quotedStrings: string[] = [];
    workingQuery = workingQuery.replace(/["']([^"']+)["']/g, (match) => {
      quotedStrings.push(match);
      return `__QUOTED_${quotedStrings.length - 1}__`;
    });

    // Split by each delimiter pattern
    for (const pattern of this.delimiterPatterns) {
      const parts = workingQuery.split(pattern);
      if (parts.length > 1 && parts.every(p => p.trim().length >= 5)) {
        // Restore quoted strings
        const restored = parts.map(part => {
          return part.replace(/__QUOTED_(\d+)__/g, (_, idx) => quotedStrings[parseInt(idx)]);
        });
        return restored.map(s => s.trim());
      }
    }

    // Restore quoted strings for single segment
    workingQuery = workingQuery.replace(/__QUOTED_(\d+)__/g, (_, idx) => quotedStrings[parseInt(idx)]);

    return [workingQuery.trim()];
  }

  /**
   * Merge multiple intent results into a coherent multi-intent structure.
   */
  public mergeIntents(intents: IntentClassificationV3[]): MultiIntentResult {
    if (intents.length === 0) {
      return { isMultiIntent: false, segments: [] };
    }

    if (intents.length === 1) {
      return {
        isMultiIntent: false,
        segments: [intents[0].rawQuery || ''],
        intents,
      };
    }

    // Check if all intents are the same primary type
    const primaryTypes = new Set(intents.map(i => i.primaryIntent));

    return {
      isMultiIntent: primaryTypes.size > 1,
      segments: intents.map(i => i.rawQuery || '').filter(s => s.length > 0),
      intents,
    };
  }
}

export const multiIntentService = new MultiIntentService();
export default multiIntentService;
