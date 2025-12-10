/**
 * ============================================================================
 * KODA CENTRALIZED TYPES - Single Source of Truth
 * ============================================================================
 * 
 * This file contains ALL types used across the centralized pattern and
 * formatting system. This ensures consistency and prevents type conflicts.
 * 
 * Based on:
 * - Note 1: Intent & Skill Patterns
 * - Note 2: Mode & Complexity Patterns  
 * - Note 3: File Action Patterns
 * - Note 4: Output Format Issues
 * - Note 5: Answer Mode Templates
 * 
 * @version 3.0.0
 * @date 2024-12-10
 */

// ============================================================================
// LANGUAGE TYPES
// ============================================================================

export type LanguageCode = 'en' | 'pt' | 'es' | 'fr';

export interface LanguageDetectionResult {
  language: LanguageCode;
  confidence: number;
  detectedPatterns: string[];
  source: 'query' | 'conversation' | 'default';
}

// ============================================================================
// INTENT TYPES
// ============================================================================

export enum QueryIntent {
  // Document Management
  LIST_DOCUMENTS = 'LIST_DOCUMENTS',
  COUNT_DOCUMENTS = 'COUNT_DOCUMENTS',
  OPEN_DOCUMENT = 'OPEN_DOCUMENT',
  SEARCH_DOCUMENTS = 'SEARCH_DOCUMENTS',
  DELETE_DOCUMENT = 'DELETE_DOCUMENT',
  UPLOAD_DOCUMENT = 'UPLOAD_DOCUMENT',
  
  // Information Retrieval
  FACTUAL_QUESTION = 'FACTUAL_QUESTION',
  ANALYTICAL_QUESTION = 'ANALYTICAL_QUESTION',
  COMPARISON_QUESTION = 'COMPARISON_QUESTION',
  SYNTHESIS_QUESTION = 'SYNTHESIS_QUESTION',
  
  // Conversation
  GREETING = 'GREETING',
  CLARIFICATION = 'CLARIFICATION',
  FOLLOW_UP = 'FOLLOW_UP',
  REFERENCE_RESOLUTION = 'REFERENCE_RESOLUTION',
  
  // Document Generation
  GENERATE_DOCUMENT = 'GENERATE_DOCUMENT',
  GENERATE_SUMMARY = 'GENERATE_SUMMARY',
  GENERATE_REPORT = 'GENERATE_REPORT',
  
  // Calculation & Analysis
  CALCULATION = 'CALCULATION',
  DATA_ANALYSIS = 'DATA_ANALYSIS',
  FINANCIAL_ANALYSIS = 'FINANCIAL_ANALYSIS',
  
  // Navigation
  NAVIGATE_TO_SECTION = 'NAVIGATE_TO_SECTION',
  FIND_IN_DOCUMENT = 'FIND_IN_DOCUMENT',
  
  // Onboarding/Support
  ONBOARDING = 'ONBOARDING',
  HELP = 'HELP',
  
  // Fallback
  UNKNOWN = 'UNKNOWN',
  AMBIGUOUS = 'AMBIGUOUS',
}

// ============================================================================
// SKILL TYPES
// ============================================================================

export enum SkillCategory {
  GENERAL = 'GENERAL',
  COMPARISON = 'COMPARISON',
  ENTITY_EXTRACTION = 'ENTITY_EXTRACTION',
  LEGAL = 'LEGAL',
  FINANCIAL = 'FINANCIAL',
  PROJECT = 'PROJECT',
  TECHNICAL = 'TECHNICAL',
  CALCULATION = 'CALCULATION',
  NAVIGATION = 'NAVIGATION',
}

export enum SkillMode {
  LIGHT = 'LIGHT',       // Quick, surface-level
  DEFAULT = 'DEFAULT',   // Standard depth
  DEEP = 'DEEP',         // Comprehensive analysis
}

// ============================================================================
// COMPLEXITY & SPEED TYPES
// ============================================================================

export enum QueryComplexity {
  TRIVIAL = 'TRIVIAL',           // < 500ms expected
  SIMPLE = 'SIMPLE',             // 500ms-2s expected
  MODERATE = 'MODERATE',         // 2-4s expected
  COMPLEX = 'COMPLEX',           // 4-8s expected
  VERY_COMPLEX = 'VERY_COMPLEX', // 8s+ expected
}

export enum SpeedProfile {
  ULTRA_FAST = 'ULTRA_FAST', // < 500ms (meta queries, greetings)
  FAST = 'FAST',             // < 2s (simple factual)
  NORMAL = 'NORMAL',         // 2-4s (standard queries)
  DEEP = 'DEEP',             // 4s+ (complex analysis)
}

// ============================================================================
// OUTPUT FORMAT TYPES
// ============================================================================

export enum OutputFormat {
  FACT = 'FACT',               // Single fact/value
  SUMMARY = 'SUMMARY',         // Brief summary
  DETAILED = 'DETAILED',       // Detailed explanation
  LIST = 'LIST',               // Bullet list
  TABLE = 'TABLE',             // Tabular data
  COMPARISON = 'COMPARISON',   // Side-by-side comparison
  TIMELINE = 'TIMELINE',       // Chronological events
  STEPS = 'STEPS',             // Step-by-step instructions
  REPORT = 'REPORT',           // Full structured report
  ERROR = 'ERROR',             // Error message
}

// ============================================================================
// ANSWER MODE TYPES (from Note 5)
// ============================================================================

export enum AnswerMode {
  META_SYSTEM = 'META_SYSTEM',           // Doc counts, file types, etc.
  SINGLE_DOC_FACTUAL = 'SINGLE_DOC_FACTUAL', // One value from specific file
  MULTI_DOC_COMPLEX = 'MULTI_DOC_COMPLEX',   // Compare docs, ROI, analysis
  NAVIGATION_SECTION = 'NAVIGATION_SECTION', // Where is X in document
  CALCULATION_ROI = 'CALCULATION_ROI',       // Numeric reasoning
  ONBOARDING_SUPPORT = 'ONBOARDING_SUPPORT', // How to use Koda
  NO_DATA_NOT_FOUND = 'NO_DATA_NOT_FOUND',   // Doc missing, info not present
}

// ============================================================================
// RETRIEVAL STRATEGY TYPES
// ============================================================================

export enum RetrievalStrategy {
  SEMANTIC = 'SEMANTIC',     // Vector search only
  KEYWORD = 'KEYWORD',       // BM25 only
  HYBRID = 'HYBRID',         // Both semantic + keyword
  NONE = 'NONE',             // No retrieval needed
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export enum EntityType {
  DOCUMENT_NAME = 'DOCUMENT_NAME',
  DOCUMENT_ID = 'DOCUMENT_ID',
  ORDINAL_REFERENCE = 'ORDINAL_REFERENCE',     // first, second, third
  PRONOUN_REFERENCE = 'PRONOUN_REFERENCE',     // it, this, that
  DOCUMENT_ALIAS = 'DOCUMENT_ALIAS',           // "the contract", "that file"
  DATE = 'DATE',
  NUMBER = 'NUMBER',
  CURRENCY = 'CURRENCY',
  PERCENTAGE = 'PERCENTAGE',
  PERSON_NAME = 'PERSON_NAME',
  COMPANY_NAME = 'COMPANY_NAME',
  LOCATION = 'LOCATION',
  SECTION_REFERENCE = 'SECTION_REFERENCE',     // "section 3", "page 5"
}

// ============================================================================
// FILE ACTION TYPES
// ============================================================================

export enum FileActionType {
  SHOW_FILE = 'SHOW_FILE',
  OPEN_FILE = 'OPEN_FILE',
  DELETE_FILE = 'DELETE_FILE',
  REMOVE_FILE = 'REMOVE_FILE',
  UPLOAD_FILE = 'UPLOAD_FILE',
  ADD_FILE = 'ADD_FILE',
  NAVIGATE_TO = 'NAVIGATE_TO',
  GO_TO = 'GO_TO',
  MOVE_FILE = 'MOVE_FILE',
}

// ============================================================================
// PATTERN INTERFACES
// ============================================================================

export interface SimpleIntentPattern {
  id: string;
  description: string;
  language: LanguageCode;
  intent: QueryIntent;
  triggers: {
    keywords?: string[];
    regex?: RegExp[];
  };
  negativeTriggers?: {
    keywords?: string[];
    regex?: RegExp[];
  };
  requiresDocuments: boolean;
  requiresRetrieval: boolean;
  speedProfile: SpeedProfile;
  outputFormat: OutputFormat;
  answerMode: AnswerMode;
  priority: number;
  examples: string[];
  testCases: TestCase[];
}

export interface EnhancedSkillPattern {
  id: string;
  description: string;
  language: LanguageCode;
  skillId: string;
  label: string;
  category: SkillCategory;
  patterns: {
    keywords?: string[];
    regex?: RegExp[];
  };
  negativePatterns?: {
    keywords?: string[];
  };
  retrievalStrategy: RetrievalStrategy;
  requiresMultiDoc: boolean;
  requiresCalculation: boolean;
  requiresMemory: boolean;
  outputFormat: OutputFormat;
  speedProfile: SpeedProfile;
  depthDefault: SkillMode;
  priority: number;
  examples: string[];
  testCases: TestCase[];
}

export interface EntityPattern {
  id: string;
  description: string;
  language: LanguageCode;
  type: EntityType;
  patterns: {
    keywords?: string[];
    regex?: RegExp[];
  };
  normalizationRules?: {
    stripQuotes?: boolean;
    lowercase?: boolean;
    unifySpaces?: boolean;
  };
  resolutionHints?: {
    useConversationMemory?: boolean;
    useLastRetrieval?: boolean;
  };
  postProcessing?: {
    mapToDocumentId?: boolean;
    keepRawValue?: boolean;
  };
  priority: number;
  examples: string[];
  testCases: TestCase[];
}

export interface FileActionPattern {
  id: string;
  description: string;
  language: LanguageCode;
  actionId: FileActionType;
  triggers: {
    keywords?: string[];
    regex?: RegExp[];
  };
  negativeTriggers?: {
    keywords?: string[];
  };
  requiresDocuments: boolean;
  documentReferencePatterns?: {
    regex?: RegExp[];
  };
  uiHint?: string;
  requiresConfirmation?: boolean;
  speedProfile: SpeedProfile;
  outputFormat: OutputFormat;
  priority: number;
  examples: string[];
  testCases: TestCase[];
}

export interface ModePattern {
  id: string;
  description: string;
  language: LanguageCode;
  triggers: {
    keywords?: string[];
    regex?: RegExp[];
  };
  complexityOverride?: QueryComplexity;
  speedProfileOverride?: SpeedProfile;
  depthOverride?: SkillMode;
  priority: number;
  examples: string[];
}

export interface OutputFormatPattern {
  id: string;
  description: string;
  language: LanguageCode;
  format: OutputFormat;
  triggers: {
    keywords?: string[];
    regex?: RegExp[];
  };
  priority: number;
  examples: string[];
}

// ============================================================================
// TEST CASE INTERFACE
// ============================================================================

export interface TestCase {
  query: string;
  expectedMatch: boolean;
  expectedConfidence?: number;
  expectedExtraction?: string;
  description?: string;
}

// ============================================================================
// RESULT INTERFACES
// ============================================================================

export interface IntentDetectionResult {
  intent: QueryIntent;
  confidence: number;
  language: LanguageCode;
  matchedPattern: string;
  detectionTimeMs: number;
  requiresDocuments: boolean;
  requiresRetrieval: boolean;
  speedProfile: SpeedProfile;
  outputFormat: OutputFormat;
  answerMode: AnswerMode;
}

export interface SkillDetectionResult {
  skillId: string;
  label: string;
  category: SkillCategory;
  confidence: number;
  language: LanguageCode;
  matchedPattern: string;
  detectionTimeMs: number;
  retrievalStrategy: RetrievalStrategy;
  requiresMultiDoc: boolean;
  requiresCalculation: boolean;
  requiresMemory: boolean;
  outputFormat: OutputFormat;
  speedProfile: SpeedProfile;
  depthDefault: SkillMode;
}

export interface EntityExtractionResult {
  type: EntityType;
  value: string;
  normalizedValue: string;
  resolvedValue?: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
}

export interface FileActionDetectionResult {
  actionId: FileActionType;
  confidence: number;
  language: LanguageCode;
  matchedPattern: string;
  documentReference?: string;
  uiHint?: string;
  requiresConfirmation: boolean;
}

export interface ModeDetectionResult {
  complexityOverride?: QueryComplexity;
  speedProfileOverride?: SpeedProfile;
  depthOverride?: SkillMode;
  confidence: number;
  matchedPattern: string;
}

// ============================================================================
// FORMATTING TYPES (from Notes 4 & 5)
// ============================================================================

export interface FormattingRules {
  // Paragraph rules
  maxParagraphLength: number;
  maxParagraphsBeforeBreak: number;
  
  // Heading rules
  useMarkdownHeadings: boolean;
  maxHeadingLevel: number;
  
  // Bold rules
  boldStrategy: 'minimal' | 'selective' | 'aggressive';
  boldTargets: ('labels' | 'numbers' | 'filenames' | 'keywords')[];
  
  // List rules
  preferBulletsOver: number; // If more than N items, use bullets
  bulletStyle: '-' | '*' | '•';
  
  // Spacing rules
  maxBlankLines: number;
  blankLinesAfterHeading: number;
  blankLinesBetweenSections: number;
  
  // Structure rules
  includeSections: boolean;
  includeTitle: boolean;
  includeClosing: boolean;
}

export interface AnswerModeTemplate {
  mode: AnswerMode;
  rules: FormattingRules;
  structure: {
    sections?: string[];
    maxSections?: number;
    requiresHeadings?: boolean;
  };
  constraints: {
    maxLength?: number;
    minLength?: number;
    maxBulletPoints?: number;
  };
}

export interface FormattingContext {
  query: string;
  intent: QueryIntent;
  answerMode: AnswerMode;
  complexity: QueryComplexity;
  language: LanguageCode;
  documentCount?: number;
  hasMultipleSources?: boolean;
  isFollowUp?: boolean;
  isError?: boolean;
}

export interface FormattedOutput {
  text: string;
  mode: AnswerMode;
  hasTitle: boolean;
  hasClosing: boolean;
  hasSections: boolean;
  sectionCount: number;
  bulletCount: number;
  stats: {
    originalLength: number;
    finalLength: number;
    paragraphCount: number;
    headingCount: number;
    boldCount: number;
    listCount: number;
  };
}

// ============================================================================
// PATTERN REGISTRY INTERFACES
// ============================================================================

export interface PatternRegistry {
  intents: SimpleIntentPattern[];
  skills: EnhancedSkillPattern[];
  entities: EntityPattern[];
  fileActions: FileActionPattern[];
  modes: ModePattern[];
  outputFormats: OutputFormatPattern[];
}

// ============================================================================
// MATCHER INTERFACE
// ============================================================================

export interface IPatternMatcher {
  detectIntent(query: string, language?: LanguageCode): IntentDetectionResult | null;
  detectSkill(query: string, language?: LanguageCode): SkillDetectionResult | null;
  extractEntities(query: string, language?: LanguageCode): EntityExtractionResult[];
  detectFileAction(query: string, language?: LanguageCode): FileActionDetectionResult | null;
  detectMode(query: string, language?: LanguageCode): ModeDetectionResult | null;
  detectOutputFormat(query: string, language?: LanguageCode): OutputFormat | null;
  detectLanguage(query: string): LanguageCode;
}

// ============================================================================
// FORMATTER INTERFACE
// ============================================================================

export interface IAnswerFormatter {
  formatAnswer(
    rawAnswer: string,
    context: FormattingContext
  ): FormattedOutput;
  
  applyAnswerMode(
    text: string,
    mode: AnswerMode,
    language: LanguageCode
  ): string;
  
  fixMarkdownIssues(text: string): string;
  cleanInternalPlaceholders(text: string): string;
  normalizeSpacing(text: string): string;
  applySelectiveBold(text: string, mode: AnswerMode): string;
  formatLists(text: string): string;
  formatDocumentNames(text: string): string;
}

// ============================================================================
// ALL TYPES AND INTERFACES ARE EXPORTED AT DECLARATION
// ============================================================================
