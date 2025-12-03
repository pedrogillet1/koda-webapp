/**
 * Output Integration Service
 *
 * This service provides integration wrappers for all 24 output types.
 * It replaces ALL hardcoded responses with dynamic, AI-generated outputs.
 *
 * Usage:
 * Instead of: return "Hello! How can I help you?"
 * Use: return await outputIntegration.generateGreeting(language, documentCount)
 */

import {
  unifiedFormattingService,
  FormatContext,
  OutputType,
} from './unifiedFormatting.service';

// ============================================================================
// CATEGORY 1: CONVERSATIONAL OUTPUTS
// ============================================================================

/**
 * Generates a dynamic greeting
 * Replaces: fastPathDetector.service.ts hardcoded greetings
 */
export async function generateGreeting(
  language: string,
  documentCount: number
): Promise<string> {
  const context: FormatContext = {
    outputType: 'greeting',
    language,
    documentCount,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a dynamic capabilities response
 * Replaces: fastPathDetector.service.ts hardcoded capabilities
 */
export async function generateCapabilities(
  language: string,
  documentCount: number
): Promise<string> {
  const context: FormatContext = {
    outputType: 'capabilities',
    language,
    documentCount,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a dynamic farewell
 * Replaces: fastPathDetector.service.ts hardcoded farewells
 */
export async function generateFarewell(language: string): Promise<string> {
  const context: FormatContext = {
    outputType: 'farewell',
    language,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// CATEGORY 2: FILE ACTION OUTPUTS
// ============================================================================

/**
 * Generates a dynamic file listing response
 * Replaces: rag.service.ts handleDocumentListing()
 */
export async function generateFileListing(
  language: string,
  files: any[],
  totalCount: number,
  displayLimit: number = 15
): Promise<string> {
  const context: FormatContext = {
    outputType: 'file_listing',
    language,
    documentCount: totalCount,
    data: {
      files: files.slice(0, displayLimit),
      totalCount,
      displayLimit,
      hasMore: totalCount > displayLimit,
    },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a dynamic folder listing response
 * Replaces: rag.service.ts handleFolderListing()
 */
export async function generateFolderListing(
  language: string,
  folders: any[]
): Promise<string> {
  const context: FormatContext = {
    outputType: 'folder_listing',
    language,
    data: { folders },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a dynamic file search results response
 * Replaces: rag.service.ts handleFileSearch()
 */
export async function generateFileSearchResults(
  language: string,
  query: string,
  results: any[]
): Promise<string> {
  const context: FormatContext = {
    outputType: 'file_search',
    language,
    userQuery: query,
    data: { results },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a dynamic file not found response
 * Replaces: Generic error messages
 */
export async function generateFileNotFound(
  language: string,
  fileName: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'file_not_found',
    language,
    data: { fileName },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// CATEGORY 3: RAG ANSWER OUTPUTS
// ============================================================================

/**
 * Generates a simple factual answer
 * Replaces: rag.service.ts answer generation (simple queries)
 */
export async function generateSimpleAnswer(
  language: string,
  userQuery: string,
  answer: string,
  sources?: string[]
): Promise<string> {
  const context: FormatContext = {
    outputType: 'simple_answer',
    language,
    userQuery,
    data: { answer, sources },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a complex analytical answer
 * Replaces: rag.service.ts answer generation (complex queries)
 */
export async function generateComplexAnswer(
  language: string,
  userQuery: string,
  retrievedChunks: any[],
  documentSize: 'small' | 'medium' | 'large'
): Promise<string> {
  const context: FormatContext = {
    outputType: 'complex_answer',
    language,
    userQuery,
    retrievedChunks,
    documentSize,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a comparison answer
 * Replaces: rag.service.ts comparison logic
 */
export async function generateComparison(
  language: string,
  userQuery: string,
  items: any[]
): Promise<string> {
  const context: FormatContext = {
    outputType: 'comparison',
    language,
    userQuery,
    data: { items },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a summary answer
 * Replaces: rag.service.ts summarization
 */
export async function generateSummary(
  language: string,
  userQuery: string,
  content: string,
  documentSize: 'small' | 'medium' | 'large'
): Promise<string> {
  const context: FormatContext = {
    outputType: 'summary',
    language,
    userQuery,
    documentSize,
    data: { content },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a data extraction answer
 * Replaces: rag.service.ts extraction logic
 */
export async function generateDataExtraction(
  language: string,
  userQuery: string,
  extractedData: any[]
): Promise<string> {
  const context: FormatContext = {
    outputType: 'data_extraction',
    language,
    userQuery,
    data: { extractedData },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// CATEGORY 4: KNOWLEDGE EXTRACTION OUTPUTS
// ============================================================================

/**
 * Generates a methodology explanation
 * Replaces: methodologyExtraction.service.ts formatKnowledgeForResponse()
 */
export async function generateMethodologyExplanation(
  language: string,
  userQuery: string,
  methodology: any
): Promise<string> {
  const context: FormatContext = {
    outputType: 'methodology',
    language,
    userQuery,
    data: { methodology },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a definition explanation
 * Replaces: definitionExtraction.service.ts formatKnowledgeForResponse()
 */
export async function generateDefinitionExplanation(
  language: string,
  userQuery: string,
  definition: any
): Promise<string> {
  const context: FormatContext = {
    outputType: 'definition',
    language,
    userQuery,
    data: { definition },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a causal explanation
 * Replaces: causalExtraction.service.ts formatKnowledgeForResponse()
 */
export async function generateCausalExplanation(
  language: string,
  userQuery: string,
  causal: any
): Promise<string> {
  const context: FormatContext = {
    outputType: 'causal',
    language,
    userQuery,
    data: { causal },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// CATEGORY 5: ERROR AND EDGE CASE OUTPUTS
// ============================================================================

/**
 * Generates a "no documents found" error
 * Replaces: Generic error messages
 */
export async function generateNoDocumentsError(language: string): Promise<string> {
  const context: FormatContext = {
    outputType: 'no_documents',
    language,
    documentCount: 0,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates an "insufficient context" error
 * Replaces: Generic error messages
 */
export async function generateInsufficientContextError(
  language: string,
  userQuery: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'insufficient_context',
    language,
    userQuery,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates an "ambiguous query" response
 * Replaces: Generic disambiguation messages
 */
export async function generateAmbiguousQueryResponse(
  language: string,
  userQuery: string,
  options: string[]
): Promise<string> {
  const context: FormatContext = {
    outputType: 'ambiguous_query',
    language,
    userQuery,
    data: { options },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates an "out of scope" response
 * Replaces: Generic rejection messages
 */
export async function generateOutOfScopeResponse(
  language: string,
  userQuery: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'out_of_scope',
    language,
    userQuery,
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a "processing error" response
 * Replaces: Generic "something went wrong" messages
 */
export async function generateProcessingError(
  language: string,
  errorType?: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'processing_error',
    language,
    data: { errorType },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// CATEGORY 6: DOCUMENT GENERATION OUTPUTS
// ============================================================================

/**
 * Generates a document generation confirmation
 * Replaces: chatDocumentGeneration.service.ts template messages
 */
export async function generateDocumentGenerationConfirm(
  language: string,
  documentType: string,
  documentName: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'document_generation_confirm',
    language,
    data: { documentType, documentName },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates a document generation progress message
 * Replaces: Streaming progress messages
 */
export async function generateDocumentGenerationProgress(
  language: string,
  step: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'document_generation_progress',
    language,
    data: { step },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// CATEGORY 7: PAGINATION OUTPUTS
// ============================================================================

/**
 * Generates a pagination message
 * Replaces: Hardcoded "Showing first X files" messages
 */
export async function generatePaginationMessage(
  language: string,
  shown: number,
  total: number
): Promise<string> {
  const context: FormatContext = {
    outputType: 'pagination',
    language,
    data: { shown, total, hasMore: total > shown },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

/**
 * Generates next steps suggestion
 * Replaces: Hardcoded "Next step:" labels
 */
export async function generateNextSteps(
  language: string,
  context_type: string
): Promise<string> {
  const context: FormatContext = {
    outputType: 'next_steps',
    language,
    data: { context_type },
  };

  const output = await unifiedFormattingService.generateFormattedOutput(context);
  return output.content;
}

// ============================================================================
// EXPORT
// ============================================================================

export const outputIntegration = {
  // Conversational
  generateGreeting,
  generateCapabilities,
  generateFarewell,

  // File Actions
  generateFileListing,
  generateFolderListing,
  generateFileSearchResults,
  generateFileNotFound,

  // RAG Answers
  generateSimpleAnswer,
  generateComplexAnswer,
  generateComparison,
  generateSummary,
  generateDataExtraction,

  // Knowledge Extraction
  generateMethodologyExplanation,
  generateDefinitionExplanation,
  generateCausalExplanation,

  // Errors
  generateNoDocumentsError,
  generateInsufficientContextError,
  generateAmbiguousQueryResponse,
  generateOutOfScopeResponse,
  generateProcessingError,

  // Document Generation
  generateDocumentGenerationConfirm,
  generateDocumentGenerationProgress,

  // Pagination
  generatePaginationMessage,
  generateNextSteps,
};

export default outputIntegration;
