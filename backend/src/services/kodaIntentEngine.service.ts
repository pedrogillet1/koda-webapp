/**
 * ============================================================================
 * KODA INTENT ENGINE - UNIFIED INTENT DETECTION & QUERY CLASSIFICATION
 * ============================================================================
 *
 * This service consolidates ALL intent detection logic into a single engine.
 *
 * NOW POWERED BY: ../centralized/services/centralizedPatternMatcher.ts
 *
 * CONSOLIDATES:
 * - llmIntentDetector.service.ts
 * - simpleIntentDetection.service.ts (✅ currently in use)
 * - contextAwareIntentDetection.service.ts
 * - hierarchicalIntentClassifier.service.ts
 * - hierarchicalIntentHandler.service.ts
 * - kodaSkillMapper.service.ts
 * - skillAndIntentRouter.service.ts (✅ currently in use)
 * - documentGenerationDetection.service.ts
 * - synthesisQueryDetection.service.ts
 * - clarificationLogic.service.ts
 *
 * INTEGRATION STRATEGY:
 * This engine integrates with the existing skill system and fast-path detection
 * that was recently added to rag.service.ts. It provides a clean API for all
 * intent detection needs.
 *
 * @version 3.0.0
 * @date 2025-12-10
 */

// Removed NestJS dependency for compatibility
// ✅ CENTRALIZED LANGUAGE SERVICE - Single source of truth for language detection
import { detectLanguageSimple, type SupportedLanguage } from './kodaLanguage.service';

// ✅ CENTRALIZED PATTERN MATCHING SYSTEM - Single source of truth for patterns
import { centralizedPatternMatcher, QueryIntent as CentralizedIntent, LanguageCode } from '../centralized';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum QueryIntent {
  // Document Management
  LIST_DOCUMENTS = 'list_documents',
  OPEN_DOCUMENT = 'open_document',
  SEARCH_DOCUMENTS = 'search_documents',
  DELETE_DOCUMENT = 'delete_document',
  UPLOAD_DOCUMENT = 'upload_document',
  COUNT_DOCUMENTS = 'count_documents',
  
  // Information Retrieval
  FACTUAL_QUESTION = 'factual_question',
  ANALYTICAL_QUESTION = 'analytical_question',
  COMPARISON_QUESTION = 'comparison_question',
  SYNTHESIS_QUESTION = 'synthesis_question',
  
  // Conversation
  GREETING = 'greeting',
  CLARIFICATION = 'clarification',
  FOLLOW_UP = 'follow_up',
  REFERENCE_RESOLUTION = 'reference_resolution',
  
  // Document Generation
  GENERATE_DOCUMENT = 'generate_document',
  GENERATE_SUMMARY = 'generate_summary',
  GENERATE_REPORT = 'generate_report',
  
  // Calculation & Analysis
  CALCULATION = 'calculation',
  DATA_ANALYSIS = 'data_analysis',
  FINANCIAL_ANALYSIS = 'financial_analysis',
  
  // Fallback
  UNKNOWN = 'unknown',
  AMBIGUOUS = 'ambiguous',
}

export enum QueryComplexity {
  TRIVIAL = 'trivial',      // < 500ms expected
  SIMPLE = 'simple',        // 500ms-2s expected
  MODERATE = 'moderate',    // 2-4s expected
  COMPLEX = 'complex',      // 4-8s expected
  VERY_COMPLEX = 'very_complex', // 8s+ expected
}

export enum SkillType {
  FILE_MANAGEMENT = 'file_management',
  DOCUMENT_QA = 'document_qa',
  FINANCIAL_ANALYSIS = 'financial_analysis',
  DATA_EXTRACTION = 'data_extraction',
  SYNTHESIS = 'synthesis',
  COMPARISON = 'comparison',
  GENERAL_CHAT = 'general_chat',
}

export interface IntentAnalysis {
  intent: QueryIntent;
  skill: SkillType;
  confidence: number;
  complexity: QueryComplexity;
  requiresRetrieval: boolean;
  requiresMemory: boolean;
  requiresCalculation: boolean;
  requiresClarification: boolean;
  extractedEntities: {
    documentReferences?: string[];
    ordinalReferences?: string[]; // "first", "second", "last"
    pronounReferences?: string[]; // "it", "that", "this"
    keywords?: string[];
    numbers?: number[];
    dates?: string[];
  };
  fastPathEligible: boolean;
  suggestedAction: string;
  language: string;
}

// ============================================================================
// KODA INTENT ENGINE
// ============================================================================

// @Injectable()
export class KodaIntentEngine {
  
  /**
   * Main entry point: Analyze a query and return comprehensive intent analysis
   */
  async analyzeQuery(
    query: string,
    conversationContext?: any,
    userId?: string
  ): Promise<IntentAnalysis> {
    
    // Step 1: Detect language
    const language = this.detectLanguage(query);
    
    // Step 2: Quick pattern matching for ultra-fast intents (greetings, doc count)
    const quickIntent = this.quickPatternMatch(query, language);
    if (quickIntent) {
      return { ...quickIntent, language } as IntentAnalysis;
    }
    
    // Step 3: Entity extraction
    const entities = this.extractEntities(query);
    
    // Step 4: Classify intent and skill using hierarchical rules
    const { intent, skill } = this.classifyIntentAndSkill(query, entities, conversationContext);
    
    // Step 5: Determine complexity
    const complexity = this.determineComplexity(query, intent, skill, entities);
    
    // Step 6: Determine requirements
    const requirements = this.determineRequirements(intent, skill, entities);
    
    // Step 7: Check fast-path eligibility
    const fastPathEligible = this.checkFastPathEligibility(intent, complexity);
    
    // Step 8: Generate suggested action
    const suggestedAction = this.generateSuggestedAction(intent, skill, entities);
    
    // Step 9: Calculate confidence
    const confidence = this.calculateConfidence(intent, skill, entities);
    
    return {
      intent,
      skill,
      confidence,
      complexity,
      ...requirements,
      extractedEntities: entities,
      fastPathEligible,
      suggestedAction,
      language,
    };
  }
  
  // ==========================================================================
  // LANGUAGE DETECTION
  // ==========================================================================
  
  private detectLanguage(query: string): SupportedLanguage {
    // ✅ Use centralized language detection service (kodaLanguage.service.ts)
    return detectLanguageSimple(query);
  }
  
  // ==========================================================================
  // QUICK PATTERN MATCHING (for ultra-fast queries)
  // ==========================================================================
  
  private quickPatternMatch(query: string, language: string): Partial<IntentAnalysis> | null {
    const lowerQuery = query.toLowerCase().trim();
    
    // Greetings (multilingual)
    const greetingPatterns: Record<string, RegExp[]> = {
      en: [/^(hi|hello|hey|good morning|good afternoon|good evening)$/i],
      pt: [/^(oi|olá|bom dia|boa tarde|boa noite)$/i],
      es: [/^(hola|buenos días|buenas tardes|buenas noches)$/i],
      fr: [/^(bonjour|salut|bonsoir)$/i],
    };
    
    if (greetingPatterns[language]?.some(p => p.test(lowerQuery))) {
      return {
        intent: QueryIntent.GREETING,
        skill: SkillType.GENERAL_CHAT,
        confidence: 1.0,
        complexity: QueryComplexity.TRIVIAL,
        requiresRetrieval: false,
        requiresMemory: false,
        requiresCalculation: false,
        requiresClarification: false,
        extractedEntities: {},
        fastPathEligible: true,
        suggestedAction: 'respond_with_greeting',
      };
    }
    
    // Document count (multilingual)
    const countPatterns: Record<string, RegExp[]> = {
      en: [/how many (documents|files) do i have/i, /count (my )?(documents|files)/i],
      pt: [/quantos documentos (eu )?tenho/i, /contar (meus )?documentos/i],
      es: [/cuántos documentos tengo/i, /contar (mis )?documentos/i],
      fr: [/combien de documents (j')?ai/i, /compter (mes )?documents/i],
    };
    
    if (countPatterns[language]?.some(p => p.test(lowerQuery))) {
      return {
        intent: QueryIntent.COUNT_DOCUMENTS,
        skill: SkillType.FILE_MANAGEMENT,
        confidence: 1.0,
        complexity: QueryComplexity.SIMPLE,
        requiresRetrieval: true,
        requiresMemory: false,
        requiresCalculation: false,
        requiresClarification: false,
        extractedEntities: {},
        fastPathEligible: true,
        suggestedAction: 'count_user_documents',
      };
    }
    
    // List documents (multilingual)
    const listPatterns: Record<string, RegExp[]> = {
      en: [/^(list|show|display) (my )?(documents|files)$/i],
      pt: [/^(liste|mostre|exiba) (meus )?(documentos|arquivos)$/i],
      es: [/^(lista|muestra|exhibe) (mis )?(documentos|archivos)$/i],
      fr: [/^(liste|montre|affiche) (mes )?(documents|fichiers)$/i],
    };
    
    if (listPatterns[language]?.some(p => p.test(lowerQuery))) {
      return {
        intent: QueryIntent.LIST_DOCUMENTS,
        skill: SkillType.FILE_MANAGEMENT,
        confidence: 1.0,
        complexity: QueryComplexity.SIMPLE,
        requiresRetrieval: true,
        requiresMemory: false,
        requiresCalculation: false,
        requiresClarification: false,
        extractedEntities: {},
        fastPathEligible: true,
        suggestedAction: 'list_user_documents',
      };
    }
    
    return null;
  }
  
  // ==========================================================================
  // ENTITY EXTRACTION
  // ==========================================================================
  
  private extractEntities(query: string): IntentAnalysis['extractedEntities'] {
    const entities: IntentAnalysis['extractedEntities'] = {};
    
    // Extract ordinal references
    const ordinalPattern = /\b(first|second|third|fourth|fifth|last|previous|next|1st|2nd|3rd|4th|5th|primeiro|segundo|terceiro|último|primero|segundo|tercero|último|premier|deuxième|troisième|dernier)\b/gi;
    const ordinalMatches = query.match(ordinalPattern);
    if (ordinalMatches) {
      entities.ordinalReferences = ordinalMatches.map(m => m.toLowerCase());
    }
    
    // Extract pronoun references
    const pronounPattern = /\b(it|this|that|these|those|ele|isso|isto|estes|esses|aqueles|él|esto|eso|estos|esos|aquellos|il|ce|cela|ces|ceux)\b/gi;
    const pronounMatches = query.match(pronounPattern);
    if (pronounMatches) {
      entities.pronounReferences = pronounMatches.map(m => m.toLowerCase());
    }
    
    // Extract document references (quoted strings or filenames)
    const docPattern = /"([^"]+)"|'([^']+)'|(\w+\.(pdf|docx|xlsx|pptx|txt))/gi;
    const docMatches = [...query.matchAll(docPattern)];
    if (docMatches.length > 0) {
      entities.documentReferences = docMatches.map(m => m[1] || m[2] || m[3]);
    }
    
    // Extract numbers
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const numberMatches = query.match(numberPattern);
    if (numberMatches) {
      entities.numbers = numberMatches.map(n => parseFloat(n));
    }
    
    // Extract dates (simple pattern)
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
    const dateMatches = query.match(datePattern);
    if (dateMatches) {
      entities.dates = dateMatches;
    }
    
    // Extract keywords (simple tokenization, filter stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'o', 'a', 'os', 'as', 'um', 'uma', 'e', 'ou', 'mas', 'em', 'de', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'en', 'de', 'para', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'mais', 'dans', 'de', 'pour']);
    const words = query.toLowerCase().match(/\b\w+\b/g) || [];
    entities.keywords = words.filter(w => w.length > 2 && !stopWords.has(w));
    
    return entities;
  }
  
  // ==========================================================================
  // INTENT & SKILL CLASSIFICATION
  // ==========================================================================
  
  private classifyIntentAndSkill(
    query: string,
    entities: IntentAnalysis['extractedEntities'],
    conversationContext?: any
  ): { intent: QueryIntent; skill: SkillType } {
    const lowerQuery = query.toLowerCase();
    
    // Check for reference resolution needs
    if (entities.ordinalReferences || entities.pronounReferences) {
      return {
        intent: QueryIntent.REFERENCE_RESOLUTION,
        skill: SkillType.FILE_MANAGEMENT,
      };
    }
    
    // Check for document management intents
    if (lowerQuery.includes('open') || lowerQuery.includes('show me') || lowerQuery.includes('abra') || lowerQuery.includes('mostre') || lowerQuery.includes('abre') || lowerQuery.includes('muestra') || lowerQuery.includes('ouvre') || lowerQuery.includes('montre')) {
      return {
        intent: QueryIntent.OPEN_DOCUMENT,
        skill: SkillType.FILE_MANAGEMENT,
      };
    }
    if (lowerQuery.includes('delete') || lowerQuery.includes('remove') || lowerQuery.includes('excluir') || lowerQuery.includes('eliminar') || lowerQuery.includes('supprimer')) {
      return {
        intent: QueryIntent.DELETE_DOCUMENT,
        skill: SkillType.FILE_MANAGEMENT,
      };
    }
    if (lowerQuery.includes('upload') || lowerQuery.includes('add document') || lowerQuery.includes('carregar') || lowerQuery.includes('subir') || lowerQuery.includes('télécharger')) {
      return {
        intent: QueryIntent.UPLOAD_DOCUMENT,
        skill: SkillType.FILE_MANAGEMENT,
      };
    }
    if (lowerQuery.includes('search for') || lowerQuery.includes('find document') || lowerQuery.includes('procurar') || lowerQuery.includes('buscar') || lowerQuery.includes('chercher')) {
      return {
        intent: QueryIntent.SEARCH_DOCUMENTS,
        skill: SkillType.FILE_MANAGEMENT,
      };
    }
    
    // Check for financial analysis
    if (lowerQuery.includes('revenue') || lowerQuery.includes('profit') || lowerQuery.includes('loss') || lowerQuery.includes('balance sheet') || lowerQuery.includes('income statement') || lowerQuery.includes('cash flow') || lowerQuery.includes('financial') || lowerQuery.includes('receita') || lowerQuery.includes('lucro') || lowerQuery.includes('prejuízo') || lowerQuery.includes('balanço') || lowerQuery.includes('demonstração') || lowerQuery.includes('fluxo de caixa') || lowerQuery.includes('financeiro') || lowerQuery.includes('ingresos') || lowerQuery.includes('ganancias') || lowerQuery.includes('pérdidas') || lowerQuery.includes('balance') || lowerQuery.includes('estado de resultados') || lowerQuery.includes('flujo de efectivo') || lowerQuery.includes('financier') || lowerQuery.includes('revenus') || lowerQuery.includes('bénéfices') || lowerQuery.includes('pertes') || lowerQuery.includes('bilan') || lowerQuery.includes('compte de résultat') || lowerQuery.includes('flux de trésorerie')) {
      return {
        intent: QueryIntent.FINANCIAL_ANALYSIS,
        skill: SkillType.FINANCIAL_ANALYSIS,
      };
    }
    
    // Check for document generation
    if (lowerQuery.includes('generate') || lowerQuery.includes('create') || lowerQuery.includes('gerar') || lowerQuery.includes('criar') || lowerQuery.includes('generar') || lowerQuery.includes('crear') || lowerQuery.includes('générer') || lowerQuery.includes('créer')) {
      if (lowerQuery.includes('summary') || lowerQuery.includes('resumo') || lowerQuery.includes('resumen') || lowerQuery.includes('résumé')) {
        return {
          intent: QueryIntent.GENERATE_SUMMARY,
          skill: SkillType.SYNTHESIS,
        };
      }
      if (lowerQuery.includes('report') || lowerQuery.includes('relatório') || lowerQuery.includes('informe') || lowerQuery.includes('rapport')) {
        return {
          intent: QueryIntent.GENERATE_REPORT,
          skill: SkillType.SYNTHESIS,
        };
      }
      return {
        intent: QueryIntent.GENERATE_DOCUMENT,
        skill: SkillType.SYNTHESIS,
      };
    }
    
    // Check for calculation - comprehensive patterns
    const calcPatterns = [
      // Direct math expressions: "5+3", "100/4", "2*3"
      /\d+\s*[\+\-\*\/\^]\s*\d+/,
      // Percentages: "15% of 100", "20% de 500"
      /\d+\s*%\s*(of|de|von)\s*\d+/i,
      // Explicit calculation requests
      /calculate|compute|calcular|computar|calculer|rechnen/i,
      // "What is X + Y" patterns
      /what\s+is\s+\d+/i,
      /quanto\s+[ée]\s+\d+/i,
      /cu[áa]nto\s+es?\s+\d+/i,
      // Financial calculations
      /\b(roi|irr|npv|payback|moic|margin|growth rate)\b/i,
      /\b(retorno|margem|taxa de crescimento)\b/i,
      // Sum/total patterns
      /\b(sum|total|average|mean|median)\b.*\d+/i,
      /\b(soma|total|média|mediana)\b.*\d+/i,
    ];

    if (calcPatterns.some(p => p.test(lowerQuery))) {
      return {
        intent: QueryIntent.CALCULATION,
        skill: SkillType.DATA_EXTRACTION,
      };
    }
    
    // Check for comparison
    if (lowerQuery.includes('compare') || lowerQuery.includes('difference between') || lowerQuery.includes('versus') || lowerQuery.includes('comparar') || lowerQuery.includes('diferença entre') || lowerQuery.includes('comparer') || lowerQuery.includes('différence entre')) {
      return {
        intent: QueryIntent.COMPARISON_QUESTION,
        skill: SkillType.COMPARISON,
      };
    }
    
    // Check for synthesis
    if (lowerQuery.includes('synthesize') || lowerQuery.includes('combine') || lowerQuery.includes('across all') || lowerQuery.includes('sintetizar') || lowerQuery.includes('combinar') || lowerQuery.includes('em todos') || lowerQuery.includes('sintetizar') || lowerQuery.includes('combinar') || lowerQuery.includes('en todos') || lowerQuery.includes('synthétiser') || lowerQuery.includes('combiner') || lowerQuery.includes('dans tous')) {
      return {
        intent: QueryIntent.SYNTHESIS_QUESTION,
        skill: SkillType.SYNTHESIS,
      };
    }
    
    // Check for analytical questions
    if (lowerQuery.includes('why') || lowerQuery.includes('how') || lowerQuery.includes('explain') || lowerQuery.includes('por que') || lowerQuery.includes('como') || lowerQuery.includes('explique') || lowerQuery.includes('por qué') || lowerQuery.includes('cómo') || lowerQuery.includes('pourquoi') || lowerQuery.includes('comment') || lowerQuery.includes('expliquer')) {
      return {
        intent: QueryIntent.ANALYTICAL_QUESTION,
        skill: SkillType.DOCUMENT_QA,
      };
    }
    
    // Check for follow-up
    if (conversationContext && (lowerQuery.includes('tell me more') || lowerQuery.includes('continue') || lowerQuery.includes('go on') || lowerQuery.includes('me diga mais') || lowerQuery.includes('continue') || lowerQuery.includes('siga') || lowerQuery.includes('dime más') || lowerQuery.includes('continúa') || lowerQuery.includes('sigue') || lowerQuery.includes('dis-moi plus') || lowerQuery.includes('continue') || lowerQuery.includes('vas-y'))) {
      return {
        intent: QueryIntent.FOLLOW_UP,
        skill: SkillType.DOCUMENT_QA,
      };
    }
    
    // Default to factual question
    if (lowerQuery.includes('what') || lowerQuery.includes('when') || lowerQuery.includes('where') || lowerQuery.includes('who') || lowerQuery.includes('o que') || lowerQuery.includes('quando') || lowerQuery.includes('onde') || lowerQuery.includes('quem') || lowerQuery.includes('qué') || lowerQuery.includes('cuándo') || lowerQuery.includes('dónde') || lowerQuery.includes('quién') || lowerQuery.includes('quoi') || lowerQuery.includes('quand') || lowerQuery.includes('où') || lowerQuery.includes('qui')) {
      return {
        intent: QueryIntent.FACTUAL_QUESTION,
        skill: SkillType.DOCUMENT_QA,
      };
    }
    
    // If nothing matches, it's unknown
    return {
      intent: QueryIntent.UNKNOWN,
      skill: SkillType.GENERAL_CHAT,
    };
  }
  
  // ==========================================================================
  // COMPLEXITY DETERMINATION
  // ==========================================================================
  
  private determineComplexity(
    query: string,
    intent: QueryIntent,
    skill: SkillType,
    entities: IntentAnalysis['extractedEntities']
  ): QueryComplexity {
    
    // Trivial: greetings, simple commands
    if (intent === QueryIntent.GREETING || intent === QueryIntent.COUNT_DOCUMENTS) {
      return QueryComplexity.TRIVIAL;
    }
    
    // Simple: single-document operations, factual lookups
    if (intent === QueryIntent.LIST_DOCUMENTS || intent === QueryIntent.OPEN_DOCUMENT) {
      return QueryComplexity.SIMPLE;
    }
    
    // Very Complex: financial analysis, deep synthesis
    if (skill === SkillType.FINANCIAL_ANALYSIS || intent === QueryIntent.SYNTHESIS_QUESTION) {
      return QueryComplexity.VERY_COMPLEX;
    }
    
    // Complex: comparison, multi-document analysis
    if (intent === QueryIntent.COMPARISON_QUESTION || skill === SkillType.COMPARISON) {
      return QueryComplexity.COMPLEX;
    }
    
    // Moderate: everything else
    return QueryComplexity.MODERATE;
  }
  
  // ==========================================================================
  // REQUIREMENTS DETERMINATION
  // ==========================================================================
  
  private determineRequirements(
    intent: QueryIntent,
    skill: SkillType,
    entities: IntentAnalysis['extractedEntities']
  ): Pick<IntentAnalysis, 'requiresRetrieval' | 'requiresMemory' | 'requiresCalculation' | 'requiresClarification'> {
    
    const requiresRetrieval = ![
      QueryIntent.GREETING,
      QueryIntent.CALCULATION,
    ].includes(intent);
    
    const requiresMemory = [
      QueryIntent.FOLLOW_UP,
      QueryIntent.REFERENCE_RESOLUTION,
      QueryIntent.CLARIFICATION,
    ].includes(intent);
    
    const requiresCalculation = [
      QueryIntent.CALCULATION,
      QueryIntent.DATA_ANALYSIS,
      QueryIntent.FINANCIAL_ANALYSIS,
    ].includes(intent);
    
    const requiresClarification = intent === QueryIntent.AMBIGUOUS;
    
    return {
      requiresRetrieval,
      requiresMemory,
      requiresCalculation,
      requiresClarification,
    };
  }
  
  // ==========================================================================
  // FAST-PATH ELIGIBILITY
  // ==========================================================================
  
  private checkFastPathEligibility(
    intent: QueryIntent,
    complexity: QueryComplexity
  ): boolean {
    // Fast-path eligible if trivial or simple AND no complex retrieval needed
    return complexity === QueryComplexity.TRIVIAL || 
           (complexity === QueryComplexity.SIMPLE && [
             QueryIntent.GREETING,
             QueryIntent.LIST_DOCUMENTS,
             QueryIntent.COUNT_DOCUMENTS,
             QueryIntent.OPEN_DOCUMENT,
           ].includes(intent));
  }
  
  // ==========================================================================
  // SUGGESTED ACTION
  // ==========================================================================
  
  private generateSuggestedAction(
    intent: QueryIntent,
    skill: SkillType,
    entities: IntentAnalysis['extractedEntities']
  ): string {
    const actionMap: Record<QueryIntent, string> = {
      [QueryIntent.LIST_DOCUMENTS]: 'list_user_documents',
      [QueryIntent.COUNT_DOCUMENTS]: 'count_user_documents',
      [QueryIntent.OPEN_DOCUMENT]: 'open_document',
      [QueryIntent.SEARCH_DOCUMENTS]: 'search_documents',
      [QueryIntent.DELETE_DOCUMENT]: 'delete_document',
      [QueryIntent.UPLOAD_DOCUMENT]: 'upload_document',
      [QueryIntent.FACTUAL_QUESTION]: 'retrieve_and_answer',
      [QueryIntent.ANALYTICAL_QUESTION]: 'deep_analysis',
      [QueryIntent.COMPARISON_QUESTION]: 'compare_documents',
      [QueryIntent.SYNTHESIS_QUESTION]: 'synthesize_across_documents',
      [QueryIntent.GREETING]: 'respond_with_greeting',
      [QueryIntent.CLARIFICATION]: 'request_clarification',
      [QueryIntent.FOLLOW_UP]: 'continue_conversation',
      [QueryIntent.REFERENCE_RESOLUTION]: 'resolve_reference',
      [QueryIntent.GENERATE_DOCUMENT]: 'generate_document',
      [QueryIntent.GENERATE_SUMMARY]: 'generate_summary',
      [QueryIntent.GENERATE_REPORT]: 'generate_report',
      [QueryIntent.CALCULATION]: 'perform_calculation',
      [QueryIntent.DATA_ANALYSIS]: 'analyze_data',
      [QueryIntent.FINANCIAL_ANALYSIS]: 'financial_deep_analysis',
      [QueryIntent.UNKNOWN]: 'fallback_response',
      [QueryIntent.AMBIGUOUS]: 'request_clarification',
    };
    
    return actionMap[intent] || 'fallback_response';
  }
  
  // ==========================================================================
  // CONFIDENCE CALCULATION
  // ==========================================================================
  
  private calculateConfidence(
    intent: QueryIntent,
    skill: SkillType,
    entities: IntentAnalysis['extractedEntities']
  ): number {
    // Simple heuristic: more extracted entities = higher confidence
    let confidence = 0.5;
    
    if (entities.documentReferences && entities.documentReferences.length > 0) {
      confidence += 0.2;
    }
    if (entities.keywords && entities.keywords.length > 2) {
      confidence += 0.2;
    }
    if (intent !== QueryIntent.UNKNOWN) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
}

// ============================================================================
// ANSWER TYPE DETECTION (for ragOrchestrator)
// Maps complex intents to simple answer types for routing
// ============================================================================

export type AnswerType =
  | 'ULTRA_FAST_GREETING'
  | 'DOC_COUNT'
  | 'FILE_NAVIGATION'
  | 'FOLDER_NAVIGATION'
  | 'APP_HELP'
  | 'CALCULATION'
  | 'SINGLE_DOC_RAG'
  | 'CROSS_DOC_RAG'
  | 'COMPLEX_ANALYSIS'
  | 'MEMORY'
  | 'STANDARD_QUERY';

export interface IntentDetectionResult {
  answerType: AnswerType;
  confidence: number;
  entities: {
    fileNames?: string[];
    folderNames?: string[];
    numbers?: number[];
    dates?: string[];
    topics?: string[];
  };
  requiresRetrieval: boolean;
  requiresMemory: boolean;
  requiresCalculation: boolean;
}

// ============================================================================
// CENTRALIZED PATTERN INTEGRATION
// ============================================================================

/**
 * Map centralized intent to answer type
 * Maps from centralized QueryIntent to our limited AnswerType set
 */
function mapCentralizedIntentToAnswerType(intent: CentralizedIntent): AnswerType {
  switch (intent) {
    case CentralizedIntent.GREETING:
      return 'ULTRA_FAST_GREETING';
    case CentralizedIntent.COUNT_DOCUMENTS:
      return 'DOC_COUNT';
    case CentralizedIntent.LIST_DOCUMENTS:
      return 'SINGLE_DOC_RAG'; // List queries go to RAG
    case CentralizedIntent.CALCULATION:
    case CentralizedIntent.FINANCIAL_ANALYSIS:
    case CentralizedIntent.DATA_ANALYSIS:
      return 'CALCULATION';
    case CentralizedIntent.OPEN_DOCUMENT:
    case CentralizedIntent.SEARCH_DOCUMENTS:
    case CentralizedIntent.FIND_IN_DOCUMENT:
    case CentralizedIntent.DELETE_DOCUMENT:
      return 'FILE_NAVIGATION';
    case CentralizedIntent.NAVIGATE_TO_SECTION:
      return 'FOLDER_NAVIGATION';
    case CentralizedIntent.HELP:
    case CentralizedIntent.ONBOARDING:
      return 'APP_HELP';
    case CentralizedIntent.FOLLOW_UP:
    case CentralizedIntent.REFERENCE_RESOLUTION:
    case CentralizedIntent.CLARIFICATION:
    case CentralizedIntent.AMBIGUOUS:
      return 'MEMORY'; // Follow-up/clarification uses memory
    case CentralizedIntent.GENERATE_DOCUMENT:
    case CentralizedIntent.GENERATE_SUMMARY:
    case CentralizedIntent.GENERATE_REPORT:
      return 'COMPLEX_ANALYSIS'; // Document generation is complex
    case CentralizedIntent.COMPARISON_QUESTION:
    case CentralizedIntent.SYNTHESIS_QUESTION:
    case CentralizedIntent.ANALYTICAL_QUESTION:
      return 'CROSS_DOC_RAG'; // Complex analysis across docs
    case CentralizedIntent.FACTUAL_QUESTION:
      return 'SINGLE_DOC_RAG';
    case CentralizedIntent.UPLOAD_DOCUMENT:
    case CentralizedIntent.UNKNOWN:
    default:
      return 'STANDARD_QUERY';
  }
}

/**
 * Enhanced intent detection using centralized pattern matcher
 * This provides more comprehensive pattern detection with multilingual support
 */
export function detectIntentCentralized(query: string): {
  intent: CentralizedIntent;
  confidence: number;
  language: LanguageCode;
  entities: any[];
  skill: any;
  fileAction: any;
  mode: any;
} {
  const language = centralizedPatternMatcher.detectLanguage(query);
  const intentResult = centralizedPatternMatcher.detectIntent(query, language);
  const entities = centralizedPatternMatcher.extractEntities(query, language);
  const skill = centralizedPatternMatcher.detectSkill(query, language);
  const fileAction = centralizedPatternMatcher.detectFileAction(query, language);
  const mode = centralizedPatternMatcher.detectMode(query, language);

  // Handle null intentResult with default values
  const detectedIntent = intentResult?.intent ?? CentralizedIntent.FACTUAL_QUESTION;
  const detectedConfidence = intentResult?.confidence ?? 0.5;

  return {
    intent: detectedIntent,
    confidence: detectedConfidence,
    language,
    entities,
    skill,
    fileAction,
    mode,
  };
}

/**
 * Detect answer type from query - simplified routing for ragOrchestrator
 */
export async function detectAnswerType(params: {
  query: string;
  conversationHistory?: any[];
  userId?: string;
}): Promise<IntentDetectionResult> {
  const { query, conversationHistory = [] } = params;
  const lowerQuery = query.toLowerCase().trim();

  // 1. ULTRA_FAST_GREETING - Greetings (no LLM, no DB)
  const greetings = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    'what can you do', 'what do you do', 'who are you',
    'olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite',
    'o que você faz', 'o que voce faz', 'quem é você', 'quem e voce',
    'hola', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas noches',
    'qué puedes hacer', 'que puedes hacer', 'quién eres', 'quien eres',
  ];
  if (greetings.some(g => lowerQuery === g || lowerQuery === g + '!' || lowerQuery === g + '?')) {
    return {
      answerType: 'ULTRA_FAST_GREETING',
      confidence: 1.0,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 2. DOC_COUNT - Document count queries
  const docCountPatterns = [
    /how many (documents?|files?|pdfs?)/i,
    /number of (documents?|files?)/i,
    /count (of )?(my )?(documents?|files?)/i,
    /quantos? (documentos?|arquivos?|pdfs?)/i,
    /número de (documentos?|arquivos?)/i,
    /cuántos? (documentos?|archivos?)/i,
  ];
  if (docCountPatterns.some(p => p.test(query))) {
    return {
      answerType: 'DOC_COUNT',
      confidence: 0.95,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 3. CALCULATION - Math/calculation queries (BEFORE file navigation to catch math expressions)
  const calcPatterns = [
    // Direct math expressions: "5+3", "100/4", "2*3", "2+2"
    /^\s*[\d\s\+\-\*\/\(\)\.\,\^]+\s*$/,
    /\d+\s*[\+\-\*\/\^]\s*\d+/,
    // Percentages: "15% of 100", "20% de 500"
    /\d+\s*%\s*(of|de|von)\s*\d+/i,
    // Explicit calculation requests
    /^(calculate|compute|what is|quanto [eé]|cuánto es?|calcular)\s+/i,
    // Financial calculations
    /\b(roi|irr|npv|payback|moic)\b/i,
    /\b(growth rate|taxa de crescimento|margin|margem)\s+(from|de)?\s*\d+/i,
  ];
  if (calcPatterns.some(p => p.test(query))) {
    // Extract numbers
    const numbers = (query.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    return {
      answerType: 'CALCULATION',
      confidence: 0.9,
      entities: { numbers },
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: true,
    };
  }

  // 4. FILE_NAVIGATION - File location queries
  const fileNavPatterns = [
    /where is (the )?(file|document|pdf)/i,
    /find (the )?(file|document)/i,
    /locate (the )?(file|document)/i,
    /show me (the )?(file|document)/i,
    /onde (está|esta) o? (arquivo|documento)/i,
    /encontr(a|e|ar) o? (arquivo|documento)/i,
    /cad(ê|e) o? (arquivo|documento)/i,
  ];
  if (fileNavPatterns.some(p => p.test(query))) {
    const fileNames: string[] = [];
    const quotedMatch = query.match(/"([^"]+)"|'([^']+)'/);
    if (quotedMatch) fileNames.push(quotedMatch[1] || quotedMatch[2]);
    return {
      answerType: 'FILE_NAVIGATION',
      confidence: 0.95,
      entities: { fileNames },
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 5. FOLDER_NAVIGATION - Folder queries
  const folderNavPatterns = [
    /what('s| is) in (the )?(folder|directory)/i,
    /show (me )?(files in|contents of) (the )?(folder|directory)/i,
    /o que (tem|está|esta) na pasta/i,
    /mostr(a|e|ar) (arquivos da|conteúdo da) pasta/i,
  ];
  if (folderNavPatterns.some(p => p.test(query))) {
    const folderNames: string[] = [];
    const quotedMatch = query.match(/"([^"]+)"|'([^']+)'/);
    if (quotedMatch) folderNames.push(quotedMatch[1] || quotedMatch[2]);
    return {
      answerType: 'FOLDER_NAVIGATION',
      confidence: 0.9,
      entities: { folderNames },
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 6. APP_HELP - UI/app usage questions
  const appHelpPatterns = [
    /how (do i|to) (upload|create|delete|move|rename)/i,
    /how does (this|koda) work/i,
    /what can (you|koda) do/i,
    /como (faço|fazer) (para )?(upload|criar|deletar)/i,
    /como (funciona|usar) (o koda|isso)/i,
  ];
  if (appHelpPatterns.some(p => p.test(query))) {
    return {
      answerType: 'APP_HELP',
      confidence: 0.9,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: false,
      requiresCalculation: false,
    };
  }

  // 7. MEMORY - "Do you remember..." queries
  const memoryPatterns = [
    /do you remember|did (i|we) (say|mention|talk about)/i,
    /what (did|was) (i|we) (say|talking about)/i,
    /earlier (you|we) (said|mentioned)/i,
    /você lembra|eu (disse|mencionei)/i,
    /o que (eu|nós) (disse|dissemos)/i,
  ];
  if (conversationHistory.length > 0 && memoryPatterns.some(p => p.test(query))) {
    return {
      answerType: 'MEMORY',
      confidence: 0.85,
      entities: {},
      requiresRetrieval: false,
      requiresMemory: true,
      requiresCalculation: false,
    };
  }

  // 8. COMPLEX_ANALYSIS - Multi-step, comparison, deep analysis
  const complexPatterns = [
    /compare|contrast|difference between/i,
    /analyze|analysis|evaluate|assessment/i,
    /step by step|detailed explanation/i,
    /compar(a|e|ar)|diferença entre/i,
    /analis(a|e|ar)|avali(a|e|ar)/i,
  ];
  if (complexPatterns.some(p => p.test(query))) {
    return {
      answerType: 'COMPLEX_ANALYSIS',
      confidence: 0.85,
      entities: {},
      requiresRetrieval: true,
      requiresMemory: conversationHistory.length > 0,
      requiresCalculation: false,
    };
  }

  // 9. CROSS_DOC_RAG - Mentions multiple documents
  const crossDocPatterns = [
    /in (both|all) (documents?|files?)/i,
    /across (the )?(documents?|files?)/i,
    /em (ambos|todos) os? (documentos?|arquivos?)/i,
  ];
  if (crossDocPatterns.some(p => p.test(query))) {
    return {
      answerType: 'CROSS_DOC_RAG',
      confidence: 0.8,
      entities: {},
      requiresRetrieval: true,
      requiresMemory: conversationHistory.length > 0,
      requiresCalculation: false,
    };
  }

  // 10. SINGLE_DOC_RAG - Mentions specific document
  const singleDocPatterns = [
    /in (the|this) (document|file|pdf)/i,
    /from (the|this) (document|file)/i,
    /n(o|a|este|esse) (documento|arquivo)/i,
    /d(o|a|este|esse) (documento|arquivo)/i,
  ];
  if (singleDocPatterns.some(p => p.test(query))) {
    return {
      answerType: 'SINGLE_DOC_RAG',
      confidence: 0.75,
      entities: {},
      requiresRetrieval: true,
      requiresMemory: conversationHistory.length > 0,
      requiresCalculation: false,
    };
  }

  // Default: STANDARD_QUERY
  return {
    answerType: 'STANDARD_QUERY',
    confidence: 0.7,
    entities: {},
    requiresRetrieval: true,
    requiresMemory: conversationHistory.length > 0,
    requiresCalculation: false,
  };
}

/**
 * FAST-PATH OPTIMIZATION
 * Bypass heavy processing for trivial queries
 */
export function isFastPathEligible(query: string): boolean {
  const queryLower = query.toLowerCase().trim();

  // Greetings
  const greetings = ['olá', 'oi', 'hello', 'hi', 'hey', 'bom dia', 'boa tarde', 'boa noite'];
  if (greetings.some(g => queryLower === g || queryLower.startsWith(g + ' ') || queryLower.startsWith(g + '!'))) {
    return true;
  }

  // Document count
  if (queryLower.match(/quantos documentos|how many documents/)) return true;

  // Document list
  if (queryLower.match(/liste (meus )?documentos|list (my )?documents/)) return true;

  return false;
}

/**
 * Helper function to analyze intent with a simple function call
 */
export async function analyzeIntent(options: {
  query: string;
  userId?: string;
  conversationId?: string;
}): Promise<IntentAnalysis> {
  const engine = new KodaIntentEngine();
  return engine.analyzeQuery(options.query, null, options.userId);
}

export default KodaIntentEngine;
