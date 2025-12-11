/**
 * Koda Answer Pipeline - SINGLE ENTRY POINT for all answer formatting
 * 
 * This is the ONLY service that should be called from controllers/routes.
 * It orchestrates the complete 4-layer formatting pipeline.
 * 
 * Usage from controllers:
 * ```typescript
 * const result = await kodaAnswerPipeline.processAnswer({
 *   rawText: geminiOutput,
 *   query: userQuery,
 *   intent: 'factual_question',
 *   language: 'Portuguese',
 *   sourceMetadata: ragSources,
 *   fallbackType: null, // or 'no_documents', 'no_context', 'error'
 * });
 * 
 * return res.json({
 *   text: result.finalText,
 *   citations: result.citations,
 *   answerType: result.answerType,
 *   metadata: result.metadata,
 * });
 * ```
 */

import { kodaOutputStructureEngine } from './kodaOutputStructureEngine.service';
import kodaFormatEngine from './kodaFormatEngine.service';
import { kodaAnswerValidationEngine } from './kodaAnswerValidationEngine.service';
import { kodaUnifiedPostProcessor } from './kodaUnifiedPostProcessor.service';
import { kodaCitationFormatService as kodaCitationFormat } from './kodaCitationFormat.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AnswerPipelineInput {
  // Required
  rawText: string;                    // Raw output from Gemini
  query: string;                      // User's original query
  
  // Context
  intent?: string;                    // 'factual_question', 'comparison', 'greeting', etc.
  language?: string;                  // 'Portuguese', 'English', 'Spanish'
  documentCount?: number;             // Number of documents in user's library
  
  // Source metadata (for citations)
  sourceMetadata?: SourceMetadata[];  // Raw doc metadata from RAG
  
  // Fallback handling
  fallbackType?: FallbackType | null; // null = normal answer
  
  // Optional flags
  isGreeting?: boolean;
  isDocListing?: boolean;
  enableCitations?: boolean;
  enableCodeBlocks?: boolean;
}

export interface SourceMetadata {
  documentId: string;
  filename: string;
  mimeType?: string;
  page?: number;
  slide?: number;
  sheet?: string;
  folder?: string;
  chunkText?: string;
}

export type FallbackType = 
  | 'no_documents'      // User has no documents uploaded
  | 'no_context'        // RAG found no relevant chunks
  | 'index_error'       // Vector index error
  | 'processing_error'; // Document processing error

export interface AnswerPipelineOutput {
  // Final answer
  finalText: string;                  // Ready for frontend
  
  // Citations
  citations: CitationSource[];        // Formatted citation list
  
  // Metadata
  answerType: 'normal' | 'fallback' | 'greeting' | 'doc_listing';
  fallbackType?: FallbackType;
  
  // Quality metrics
  qualityScore: number;               // 0-100
  validationIssues: ValidationIssue[];
  
  // Stats
  stats: {
    originalLength: number;
    finalLength: number;
    layersApplied: string[];
    processingTimeMs: number;
  };
}

export interface CitationSource {
  id: string;
  filename: string;
  location: string;                   // "Page 3", "Slide 5", "Sheet 'Data'", or just filename
  documentId: string;
  folder?: string;
}

export interface ValidationIssue {
  type: 'completeness' | 'coherence' | 'citation' | 'markdown' | 'language';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ============================================================================
// MAIN PIPELINE SERVICE
// ============================================================================

class KodaAnswerPipeline {
  /**
   * MAIN ENTRY POINT
   * Process raw LLM output through the complete 4-layer pipeline
   */
  async processAnswer(input: AnswerPipelineInput): Promise<AnswerPipelineOutput> {
    const startTime = Date.now();
    const layersApplied: string[] = [];
    
    // Validate input
    if (!input.rawText || input.rawText.trim().length === 0) {
      throw new Error('rawText is required and cannot be empty');
    }
    if (!input.query || input.query.trim().length === 0) {
      throw new Error('query is required and cannot be empty');
    }
    
    // Set defaults
    const language = input.language || 'Portuguese';
    const enableCitations = input.enableCitations !== false; // default true
    const enableCodeBlocks = input.enableCodeBlocks !== false; // default true
    
    // ========================================================================
    // LAYER 1: STRUCTURE (kodaOutputStructureEngine)
    // ========================================================================
    
    console.log('[KodaAnswerPipeline] Layer 1: Structure');
    
    const structuredOutput = kodaOutputStructureEngine.formatAnswer(input.rawText, {
      query: input.query,
      intent: input.intent,
      documentCount: input.documentCount,
      language,
      isGreeting: input.isGreeting,
      isDocListing: input.isDocListing,
    });
    
    layersApplied.push('structure');
    
    let currentText = structuredOutput.text;
    
    // ========================================================================
    // LAYER 2: FORMAT (kodaFormatEngine)
    // ========================================================================
    
    console.log('[KodaAnswerPipeline] Layer 2: Format');
    
    currentText = kodaFormatEngine.applyFormatting(currentText, {
      enableCitations,
      enableCodeBlocks,
      enableTables: true,
      enableLinks: true,
    });
    
    layersApplied.push('format');
    
    // ========================================================================
    // CITATION FORMATTING (kodaCitationFormat)
    // ========================================================================
    
    console.log('[KodaAnswerPipeline] Citation formatting');
    
    const citations: CitationSource[] = [];
    
    if (input.sourceMetadata && input.sourceMetadata.length > 0) {
      for (const source of input.sourceMetadata) {
        const citation = kodaCitationFormat.formatCitation(source);
        citations.push(citation);
      }
    }
    
    layersApplied.push('citations');
    
    // ========================================================================
    // LAYER 3: VALIDATION (kodaAnswerValidationEngine)
    // ========================================================================
    
    console.log('[KodaAnswerPipeline] Layer 3: Validation');
    
    // Use quickValidate for immediate validation (the only sync method)
    const validation = kodaAnswerValidationEngine.quickValidate(currentText);
    
    layersApplied.push('validation');
    
    // ========================================================================
    // LAYER 4: POLISH (kodaUnifiedPostProcessor)
    // ========================================================================
    
    console.log('[KodaAnswerPipeline] Layer 4: Polish');
    
    const postProcessResult = kodaUnifiedPostProcessor.process({
      answer: currentText,
      query: input.query,
      queryLanguage: language === 'Portuguese' ? 'pt' : language === 'English' ? 'en' : 'other',
      sources: input.sourceMetadata?.map(s => ({ id: s.documentId, title: s.documentTitle })) || [],
    });
    const finalText = postProcessResult.processedAnswer;
    
    layersApplied.push('polish');
    
    // ========================================================================
    // DETERMINE ANSWER TYPE
    // ========================================================================
    
    let answerType: 'normal' | 'fallback' | 'greeting' | 'doc_listing' = 'normal';
    
    if (input.fallbackType) {
      answerType = 'fallback';
    } else if (input.isGreeting) {
      answerType = 'greeting';
    } else if (input.isDocListing) {
      answerType = 'doc_listing';
    }
    
    // ========================================================================
    // BUILD FINAL OUTPUT
    // ========================================================================
    
    const processingTimeMs = Date.now() - startTime;
    
    console.log(`[KodaAnswerPipeline] Complete in ${processingTimeMs}ms`);
    console.log(`[KodaAnswerPipeline] Validation: ${validation.isValid ? 'passed' : 'issues found'}`);
    if (validation.issue) console.log(`[KodaAnswerPipeline] Issue: ${validation.issue}`);
    
    return {
      finalText,
      citations,
      answerType,
      fallbackType: input.fallbackType || undefined,
      qualityScore: validation.isValid ? 90 : 70,
      validationIssues: validation.issue ? [{ type: 'quality', message: validation.issue, severity: 'warning' as const }] : [],
      stats: {
        originalLength: input.rawText.length,
        finalLength: finalText.length,
        layersApplied,
        processingTimeMs,
      },
    };
  }
  
  /**
   * Quick formatting (skip validation for fast responses)
   * Use for greetings, simple queries, etc.
   */
  async quickFormat(input: AnswerPipelineInput): Promise<AnswerPipelineOutput> {
    const startTime = Date.now();
    
    // Layer 1: Structure
    const structured = kodaOutputStructureEngine.formatAnswer(input.rawText, {
      query: input.query,
      intent: input.intent,
      language: input.language || 'Portuguese',
      isGreeting: input.isGreeting,
      isDocListing: input.isDocListing,
    });
    
    // Layer 4: Polish (skip 2 & 3)
    const polishResult = kodaUnifiedPostProcessor.process({
      answer: structured.text,
      query: input.query,
      queryLanguage: (input.language || 'Portuguese') === 'Portuguese' ? 'pt' : 'en',
      sources: [],
    });
    const finalText = polishResult.processedAnswer;
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      finalText,
      citations: [],
      answerType: input.isGreeting ? 'greeting' : 'normal',
      qualityScore: 100,
      validationIssues: [],
      stats: {
        originalLength: input.rawText.length,
        finalLength: finalText.length,
        layersApplied: ['structure', 'polish'],
        processingTimeMs,
      },
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const kodaAnswerPipeline = new KodaAnswerPipeline();

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*

Example 1: Normal RAG answer with citations
-------------------------------------------

const result = await kodaAnswerPipeline.processAnswer({
  rawText: geminiOutput,
  query: "Qual é o ROI do projeto?",
  intent: "factual_question",
  language: "Portuguese",
  sourceMetadata: [
    {
      documentId: "doc123",
      filename: "relatorio.pdf",
      page: 5,
      folder: "Projetos",
    },
  ],
  enableCitations: true,
});

return res.json({
  text: result.finalText,
  citations: result.citations,
  answerType: result.answerType,
  qualityScore: result.qualityScore,
});


Example 2: Fallback (no documents)
-----------------------------------

const result = await kodaAnswerPipeline.processAnswer({
  rawText: "", // empty or minimal
  query: "Qual é o ROI?",
  fallbackType: "no_documents",
  language: "Portuguese",
});

// result.finalText will be: "Não encontrei documentos. Por favor, envie seus arquivos."


Example 3: Greeting (fast path)
--------------------------------

const result = await kodaAnswerPipeline.quickFormat({
  rawText: "Olá! Como posso ajudar?",
  query: "Oi",
  isGreeting: true,
  language: "Portuguese",
});

// result.finalText will be: "Olá! Como posso ajudar?"


Example 4: Document listing
----------------------------

const result = await kodaAnswerPipeline.processAnswer({
  rawText: documentListMarkdown, // from document service
  query: "Quais documentos tenho?",
  isDocListing: true,
  language: "Portuguese",
});

// result.finalText will have formatted document list with {{DOC:::}} markers

*/
