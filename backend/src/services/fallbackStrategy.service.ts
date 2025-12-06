/**
 * Fallback Strategy Service
 * Priority: P1 (HIGH)
 * 
 * Provides fallback responses when RAG answer quality is too low.
 * Ensures user always gets a helpful response, even when retrieval fails.
 * 
 * Key Functions:
 * - Generate fallback responses for different failure scenarios
 * - Provide document titles when content retrieval fails
 * - Suggest clarification when query is ambiguous
 * - Return "I don't know" when no relevant information found
 */

import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FallbackResponse {
  answer: string;
  fallbackType: 'no_chunks' | 'low_confidence' | 'ambiguous' | 'no_documents' | 'generic';
  suggestions: string[];
  documentTitles?: string[];
}

export interface FallbackOptions {
  includeDocumentTitles?: boolean;
  includeSuggestions?: boolean;
  conversationId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate fallback response based on failure scenario
 */
export async function generateFallback(
  query: string,
  failureReason: 'no_chunks' | 'low_confidence' | 'ambiguous' | 'no_documents',
  options: FallbackOptions = {}
): Promise<FallbackResponse> {
  const {
    includeDocumentTitles = true,
    includeSuggestions = true,
    conversationId,
  } = options;

  let answer: string;
  let suggestions: string[] = [];
  let documentTitles: string[] | undefined;

  switch (failureReason) {
    case 'no_chunks':
      answer = await generateNoChunksFallback(query);
      suggestions = [
        'Try rephrasing your question',
        'Be more specific about what you\'re looking for',
        'Check if the relevant documents are uploaded',
      ];
      break;

    case 'low_confidence':
      answer = await generateLowConfidenceFallback(query);
      if (includeDocumentTitles && conversationId) {
        documentTitles = await getRelevantDocumentTitles(conversationId);
        answer += '\n\n' + formatDocumentTitles(documentTitles);
      }
      suggestions = [
        'Try asking a more specific question',
        'Provide more context about what you need',
      ];
      break;

    case 'ambiguous':
      answer = await generateAmbiguousFallback(query);
      suggestions = await generateClarificationSuggestions(query);
      break;

    case 'no_documents':
      answer = 'I don\'t have any documents uploaded yet. Please upload documents first so I can help you find information.';
      suggestions = [
        'Upload relevant documents',
        'Check if documents are still processing',
      ];
      break;

    default:
      answer = 'I\'m sorry, I couldn\'t find relevant information to answer your question.';
      suggestions = ['Try rephrasing your question'];
  }

  return {
    answer,
    fallbackType: failureReason,
    suggestions: includeSuggestions ? suggestions : [],
    documentTitles,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate fallback when no chunks retrieved
 */
async function generateNoChunksFallback(query: string): Promise<string> {
  return `I couldn't find specific information about "${query}" in your documents. ` +
         `This might be because:\n\n` +
         `- The information isn't in the uploaded documents\n` +
         `- The question needs to be more specific\n` +
         `- The relevant documents haven't been uploaded yet`;
}

/**
 * Generate fallback when confidence is low
 */
async function generateLowConfidenceFallback(query: string): Promise<string> {
  return `I found some potentially relevant information, but I'm not confident it fully answers your question about "${query}". ` +
         `Here are the documents that might contain related information:`;
}

/**
 * Generate fallback when query is ambiguous
 */
async function generateAmbiguousFallback(query: string): Promise<string> {
  return `Your question "${query}" could mean several things. Could you clarify what you're looking for?`;
}

/**
 * Get relevant document titles for conversation
 */
async function getRelevantDocumentTitles(conversationId: string): Promise<string[]> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        scopeDocumentIds: true,
      },
    });

    if (!conversation || !conversation.scopeDocumentIds || conversation.scopeDocumentIds.length === 0) {
      return [];
    }

    // Get document filenames from Document table
    const documents = await prisma.document.findMany({
      where: {
        id: { in: conversation.scopeDocumentIds },
      },
      select: {
        filename: true,
      },
    });

    return documents.map(doc => doc.filename || 'Untitled Document');
  } catch (error) {
    console.error('[FallbackStrategy] Error getting document titles:', error);
    return [];
  }
}

/**
 * Format document titles for display
 */
function formatDocumentTitles(titles: string[]): string {
  if (titles.length === 0) {
    return '';
  }

  return '**Relevant Documents:**\n' + titles.map(title => `- ${title}`).join('\n');
}

/**
 * Generate clarification suggestions
 */
async function generateClarificationSuggestions(query: string): Promise<string[]> {
  // Simple heuristics for common ambiguous queries
  const suggestions: string[] = [];

  if (query.toLowerCase().includes('what') || query.toLowerCase().includes('who')) {
    suggestions.push('Are you asking about a specific person, concept, or document?');
  }

  if (query.toLowerCase().includes('how')) {
    suggestions.push('Are you looking for a process, explanation, or instructions?');
  }

  if (query.toLowerCase().includes('when')) {
    suggestions.push('Are you asking about a specific date, time period, or event?');
  }

  if (suggestions.length === 0) {
    suggestions.push('Could you provide more details about what you\'re looking for?');
  }

  return suggestions;
}

/**
 * Generate generic "I don't know" response
 */
export function generateIDontKnowResponse(query: string): string {
  return `I don't have enough information to answer "${query}". ` +
         `This could be because the information isn't in your uploaded documents, ` +
         `or the question needs to be phrased differently.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  generateFallback,
  generateIDontKnowResponse,
};
