/**
 * ============================================================================
 * KODA 4-LAYER PIPELINE - TYPE DEFINITIONS
 * ============================================================================
 * 
 * Based on Note 6: Complete type system for the 4-layer answer pipeline
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

// ============================================================================
// PRIMARY INTENT
// ============================================================================

export type PrimaryIntent =
  | 'meta'                    // how many docs, what types, etc.
  | 'file_action'             // delete, rename, move
  | 'doc_search'              // which document talks about X
  | 'single_doc_factual'      // factual question from one doc
  | 'multi_doc_comparison'    // compare multiple docs
  | 'calculation'             // ROI, calculations
  | 'navigation'              // where is X in document
  | 'summary'                 // summarize document(s)
  | 'onboarding'              // how do I use Koda
  | 'no_docs_help'            // help when no docs uploaded
  | 'edge';                   // edge case / unknown

// ============================================================================
// ANSWER MODE
// ============================================================================

export type AnswerMode =
  | 'direct_short'            // greeting, yes/no, one short paragraph
  | 'bullet_list'             // lists, meta queries, file types, counts
  | 'structured_sections'     // ROI analysis, comparisons
  | 'steps'                   // onboarding, "how do I upload files?"
  | 'explanatory';            // longer explanation with light structure

// ============================================================================
// LANGUAGE
// ============================================================================

export type Language = 'pt' | 'en' | 'es' | 'fr';

// ============================================================================
// SOURCE / DOCUMENT
// ============================================================================

export interface Source {
  documentId: string;
  documentName?: string;
  filename?: string;
  title?: string;
  mimeType?: string;
  relevance?: number;
  pages?: number[];
}

// ============================================================================
// LAYER 1: STRUCTURE ENGINE
// ============================================================================

export interface StructureEngineInput {
  rawAnswer: string;
  query: string;
  primaryIntent: PrimaryIntent;
  answerMode: AnswerMode;
  language: Language;
  hasDocuments: boolean;
  sources?: Source[];
}

export interface StructureEngineOutput {
  structuredText: string;
  hasTitle: boolean;
  hasSections: boolean;
  sectionCount: number;
  paragraphCount: number;
  structureScore: number;  // 0-100, for debugging
}

// ============================================================================
// LAYER 2: FORMATTER
// ============================================================================

export interface FormatterInput {
  structuredText: string;
  sources: Source[];
  language: Language;
  answerMode: AnswerMode;
  options?: {
    addDocumentsUsedSection?: boolean;
    maxLength?: number;
  };
}

export interface FormatterOutput {
  formattedText: string;
  stats: {
    encodingFixesApplied: number;
    duplicatesRemoved: number;
    boldingsApplied: number;
    documentNamesFormatted: number;
  };
}

// ============================================================================
// LAYER 3: VALIDATOR
// ============================================================================

export interface ValidatorInput {
  formattedText: string;
  query: string;
  sources: Source[];
  language: Language;
  primaryIntent: PrimaryIntent;
}

export interface ValidatorOutput {
  isValid: boolean;
  score: number;  // 0-100
  warnings: string[];
  errors: string[];
  checks: {
    safety: boolean;
    personaLeak: boolean;
    hallucinatedDocs: boolean;
    completeness: boolean;
    numericConsistency: boolean;
  };
}

// ============================================================================
// LAYER 4: POST-PROCESSOR
// ============================================================================

export interface PostProcessorInput {
  formattedText: string;
}

export interface PostProcessorOutput {
  finalText: string;
  fixes: {
    artifactsRemoved: number;
    markdownFixed: boolean;
    whitespaceNormalized: boolean;
  };
}

// ============================================================================
// COMPLETE PIPELINE
// ============================================================================

export interface PipelineInput {
  rawAnswer: string;
  query: string;
  primaryIntent: PrimaryIntent;
  answerMode: AnswerMode;
  language: Language;
  sources: Source[];
  options?: {
    addDocumentsUsedSection?: boolean;
    maxLength?: number;
    skipValidation?: boolean;
  };
}

export interface PipelineOutput {
  finalAnswer: string;
  structure: StructureEngineOutput;
  formatting: FormatterOutput;
  validation?: ValidatorOutput;
  postProcessing: PostProcessorOutput;
  totalTimeMs: number;
}
