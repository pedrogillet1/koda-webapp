/**
 * ============================================================================
 * CENTRALIZED PATTERN MATCHER - Single Source of Truth
 * ============================================================================
 * 
 * This is the ONLY pattern matcher that should be used in Koda.
 * Replaces ALL existing pattern detection services.
 * 
 * Based on Notes 1, 2, 3:
 * - Intent patterns (document management, info retrieval, conversation, etc.)
 * - Skill patterns (general, comparison, legal, financial, etc.)
 * - Entity patterns (ordinals, pronouns, document references, etc.)
 * - File action patterns (show, open, delete, upload, navigate)
 * - Mode patterns (complexity, speed overrides)
 * - Output format patterns (fact, summary, list, table, etc.)
 * 
 * Features:
 * - Ultra-fast keyword matching (< 10ms)
 * - Precise regex matching
 * - Negative trigger prevention
 * - Confidence scoring
 * - Multilingual support (EN, PT, ES, FR)
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  LanguageCode,
  QueryIntent,
  AnswerMode,
  IntentDetectionResult,
  SkillDetectionResult,
  EntityExtractionResult,
  FileActionDetectionResult,
  ModeDetectionResult,
  OutputFormat,
  IPatternMatcher,
  SpeedProfile,
  RetrievalStrategy,
  SkillCategory,
  SkillMode,
  EntityType,
  FileActionType,
  QueryComplexity,
} from '../types';

// ============================================================================
// CENTRALIZED PATTERN MATCHER
// ============================================================================

export class CentralizedPatternMatcher implements IPatternMatcher {
  
  // ==========================================================================
  // LANGUAGE DETECTION
  // ==========================================================================
  
  detectLanguage(query: string): LanguageCode {
    const lowerQuery = query.toLowerCase();
    
    // Portuguese patterns
    const ptPatterns = [
      /[áéíóúàèìòùâêîôûãõç]/,
      /\b(você|não|sim|onde|como|quando|porque|qual|quem|está|fazer|meu|arquivo|documento)\b/,
    ];
    
    // Spanish patterns
    const esPatterns = [
      /[ñ¿¡]/,
      /\b(usted|sí|dónde|cómo|cuándo|está|hacer|archivo|documento)\b/,
    ];
    
    // French patterns
    const frPatterns = [
      /[àâäéèêëïîôùûüÿœæç]/,
      /\b(vous|où|comment|quand|pourquoi|quel|qui|est|faire|fichier|document)\b/,
    ];
    
    // English patterns
    const enPatterns = [
      /\b(you|the|is|are|was|were|what|where|when|why|how|file|document)\b/,
    ];
    
    // Count matches
    const scores = {
      pt: ptPatterns.filter(p => p.test(lowerQuery)).length,
      es: esPatterns.filter(p => p.test(lowerQuery)).length,
      fr: frPatterns.filter(p => p.test(lowerQuery)).length,
      en: enPatterns.filter(p => p.test(lowerQuery)).length,
    };
    
    // Return language with highest score
    const maxLang = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0] as LanguageCode;
    
    // Default to Portuguese if no clear winner
    return scores[maxLang] > 0 ? maxLang : 'pt';
  }
  
  // ==========================================================================
  // INTENT DETECTION
  // ==========================================================================
  
  detectIntent(query: string, language?: LanguageCode): IntentDetectionResult | null {
    const startTime = Date.now();
    const lang = language || this.detectLanguage(query);
    const lowerQuery = query.toLowerCase().trim();
    
    // Try each intent pattern in priority order
    const patterns = [
      // GREETING (highest priority)
      { intent: QueryIntent.GREETING, check: () => this.isGreeting(lowerQuery, lang), mode: AnswerMode.META_SYSTEM, speed: SpeedProfile.ULTRA_FAST, format: OutputFormat.FACT, needsDocs: false, needsRetrieval: false, confidence: 0.99 },
      
      // ONBOARDING/HELP
      { intent: QueryIntent.HELP, check: () => this.isHelpQuery(lowerQuery, lang), mode: AnswerMode.ONBOARDING_SUPPORT, speed: SpeedProfile.FAST, format: OutputFormat.STEPS, needsDocs: false, needsRetrieval: false, confidence: 0.98 },
      
      // DOCUMENT MANAGEMENT
      { intent: QueryIntent.COUNT_DOCUMENTS, check: () => this.isCountDocuments(lowerQuery, lang), mode: AnswerMode.META_SYSTEM, speed: SpeedProfile.ULTRA_FAST, format: OutputFormat.FACT, needsDocs: false, needsRetrieval: false, confidence: 0.95 },
      { intent: QueryIntent.LIST_DOCUMENTS, check: () => this.isListDocuments(lowerQuery, lang), mode: AnswerMode.META_SYSTEM, speed: SpeedProfile.ULTRA_FAST, format: OutputFormat.LIST, needsDocs: false, needsRetrieval: false, confidence: 0.95 },
      { intent: QueryIntent.OPEN_DOCUMENT, check: () => this.isOpenDocument(lowerQuery, lang), mode: AnswerMode.NAVIGATION_SECTION, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: false, confidence: 0.93 },
      { intent: QueryIntent.SEARCH_DOCUMENTS, check: () => this.isSearchDocuments(lowerQuery, lang), mode: AnswerMode.SINGLE_DOC_FACTUAL, speed: SpeedProfile.FAST, format: OutputFormat.LIST, needsDocs: true, needsRetrieval: true, confidence: 0.90 },
      { intent: QueryIntent.DELETE_DOCUMENT, check: () => this.isDeleteDocument(lowerQuery, lang), mode: AnswerMode.META_SYSTEM, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: false, confidence: 0.95 },
      { intent: QueryIntent.UPLOAD_DOCUMENT, check: () => this.isUploadDocument(lowerQuery, lang), mode: AnswerMode.ONBOARDING_SUPPORT, speed: SpeedProfile.FAST, format: OutputFormat.STEPS, needsDocs: false, needsRetrieval: false, confidence: 0.93 },
      
      // INFORMATION RETRIEVAL
      { intent: QueryIntent.COMPARISON_QUESTION, check: () => this.isComparisonQuery(lowerQuery, lang), mode: AnswerMode.MULTI_DOC_COMPLEX, speed: SpeedProfile.NORMAL, format: OutputFormat.COMPARISON, needsDocs: true, needsRetrieval: true, confidence: 0.92 },
      { intent: QueryIntent.SYNTHESIS_QUESTION, check: () => this.isSynthesisQuery(lowerQuery, lang), mode: AnswerMode.MULTI_DOC_COMPLEX, speed: SpeedProfile.DEEP, format: OutputFormat.SUMMARY, needsDocs: true, needsRetrieval: true, confidence: 0.88 },
      { intent: QueryIntent.ANALYTICAL_QUESTION, check: () => this.isAnalyticalQuery(lowerQuery, lang), mode: AnswerMode.MULTI_DOC_COMPLEX, speed: SpeedProfile.NORMAL, format: OutputFormat.DETAILED, needsDocs: true, needsRetrieval: true, confidence: 0.85 },
      
      // CALCULATION
      { intent: QueryIntent.CALCULATION, check: () => this.isCalculationQuery(lowerQuery, lang), mode: AnswerMode.CALCULATION_ROI, speed: SpeedProfile.NORMAL, format: OutputFormat.TABLE, needsDocs: true, needsRetrieval: true, confidence: 0.90 },
      { intent: QueryIntent.FINANCIAL_ANALYSIS, check: () => this.isFinancialQuery(lowerQuery, lang), mode: AnswerMode.CALCULATION_ROI, speed: SpeedProfile.NORMAL, format: OutputFormat.TABLE, needsDocs: true, needsRetrieval: true, confidence: 0.88 },
      
      // NAVIGATION
      { intent: QueryIntent.NAVIGATE_TO_SECTION, check: () => this.isNavigationQuery(lowerQuery, lang), mode: AnswerMode.NAVIGATION_SECTION, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: true, confidence: 0.87 },
      { intent: QueryIntent.FIND_IN_DOCUMENT, check: () => this.isFindInDocumentQuery(lowerQuery, lang), mode: AnswerMode.NAVIGATION_SECTION, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: true, confidence: 0.85 },
      
      // CONVERSATION
      { intent: QueryIntent.CLARIFICATION, check: () => this.isClarificationQuery(lowerQuery, lang), mode: AnswerMode.SINGLE_DOC_FACTUAL, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: false, needsRetrieval: false, confidence: 0.80 },
      { intent: QueryIntent.FOLLOW_UP, check: () => this.isFollowUpQuery(lowerQuery, lang), mode: AnswerMode.SINGLE_DOC_FACTUAL, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: true, confidence: 0.75 },
      { intent: QueryIntent.REFERENCE_RESOLUTION, check: () => this.isReferenceResolutionQuery(lowerQuery, lang), mode: AnswerMode.SINGLE_DOC_FACTUAL, speed: SpeedProfile.FAST, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: true, confidence: 0.78 },
      
      // FACTUAL (default for content queries)
      { intent: QueryIntent.FACTUAL_QUESTION, check: () => true, mode: AnswerMode.SINGLE_DOC_FACTUAL, speed: SpeedProfile.NORMAL, format: OutputFormat.FACT, needsDocs: true, needsRetrieval: true, confidence: 0.70 },
    ];
    
    for (const pattern of patterns) {
      if (pattern.check()) {
        return {
          intent: pattern.intent,
          confidence: pattern.confidence,
          language: lang,
          matchedPattern: `${pattern.intent}_${lang.toUpperCase()}`,
          detectionTimeMs: Date.now() - startTime,
          requiresDocuments: pattern.needsDocs,
          requiresRetrieval: pattern.needsRetrieval,
          speedProfile: pattern.speed,
          outputFormat: pattern.format,
          answerMode: pattern.mode,
        };
      }
    }
    
    return null;
  }
  
  // --------------------------------------------------------------------------
  // INTENT PATTERN CHECKERS
  // --------------------------------------------------------------------------
  
  private isGreeting(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|yo)[\s!.?]*$/i],
      pt: [/^(oi|olá|ola|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*aí)[\s!.?]*$/i],
      es: [/^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?)[\s!.?]*$/i],
      fr: [/^(bonjour|bonsoir|salut|coucou)[\s!.?]*$/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isHelpQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['help', 'how to use', 'tutorial', 'guide', 'what can you do'],
      pt: ['ajuda', 'como usar', 'tutorial', 'guia', 'o que você pode fazer'],
      es: ['ayuda', 'cómo usar', 'tutorial', 'guía', 'qué puedes hacer'],
      fr: ['aide', 'comment utiliser', 'tutoriel', 'guide', 'que peux-tu faire'],
    };
    return keywords[lang]?.some(kw => query.includes(kw)) || false;
  }
  
  private isCountDocuments(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\bhow\s+many\s+(documents?|files?)\b/i, /\b(document|file)\s+count\b/i],
      pt: [/\bquantos\s+(documentos?|arquivos?)\b/i, /\bnúmero\s+de\s+(documentos?|arquivos?)\b/i],
      es: [/\bcuántos\s+(documentos?|archivos?)\b/i, /\bnúmero\s+de\s+(documentos?|archivos?)\b/i],
      fr: [/\bcombien\s+de\s+(documents?|fichiers?)\b/i, /\bnombre\s+de\s+(documents?|fichiers?)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isListDocuments(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(list|show|display)\s+(all\s+)?(my\s+)?(documents?|files?)\b/i, /\bwhat\s+(documents?|files?)\s+do\s+i\s+have\b/i],
      pt: [/\b(listar?|mostrar|exibir)\s+(todos?\s+)?(meus?\s+)?(documentos?|arquivos?)\b/i, /\bquais\s+(documentos?|arquivos?)\s+(eu\s+)?tenho\b/i],
      es: [/\b(listar?|mostrar|mostrar)\s+(todos?\s+)?(mis\s+)?(documentos?|archivos?)\b/i, /\bqué\s+(documentos?|archivos?)\s+tengo\b/i],
      fr: [/\b(lister|afficher|montrer)\s+(tous?\s+)?(mes\s+)?(documents?|fichiers?)\b/i, /\bquels\s+(documents?|fichiers?)\s+ai-je\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isOpenDocument(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(open|show|display)\s+(the\s+)?(document|file)\b/i],
      pt: [/\b(abrir|mostrar|exibir)\s+(o\s+)?(documento|arquivo)\b/i],
      es: [/\b(abrir|mostrar|mostrar)\s+(el\s+)?(documento|archivo)\b/i],
      fr: [/\b(ouvrir|afficher|montrer)\s+(le\s+)?(document|fichier)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isSearchDocuments(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(search|find|look\s+for)\s+(in\s+)?(documents?|files?)\b/i],
      pt: [/\b(buscar|procurar|encontrar)\s+(nos?\s+)?(documentos?|arquivos?)\b/i],
      es: [/\b(buscar|encontrar|buscar)\s+(en\s+)?(documentos?|archivos?)\b/i],
      fr: [/\b(chercher|trouver|rechercher)\s+(dans\s+)?(documents?|fichiers?)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isDeleteDocument(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(delete|remove|erase)\s+(the\s+)?(document|file)\b/i],
      pt: [/\b(deletar|remover|apagar)\s+(o\s+)?(documento|arquivo)\b/i],
      es: [/\b(eliminar|borrar|quitar)\s+(el\s+)?(documento|archivo)\b/i],
      fr: [/\b(supprimer|effacer|enlever)\s+(le\s+)?(document|fichier)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isUploadDocument(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(upload|add|import)\s+(a\s+)?(document|file)\b/i, /\bhow\s+to\s+upload\b/i],
      pt: [/\b(fazer\s+upload|adicionar|importar)\s+(um\s+)?(documento|arquivo)\b/i, /\bcomo\s+fazer\s+upload\b/i],
      es: [/\b(subir|añadir|importar)\s+(un\s+)?(documento|archivo)\b/i, /\bcómo\s+subir\b/i],
      fr: [/\b(télécharger|ajouter|importer)\s+(un\s+)?(document|fichier)\b/i, /\bcomment\s+télécharger\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isComparisonQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['compare', 'comparison', 'difference', 'vs', 'versus', 'between', 'contrast'],
      pt: ['comparar', 'comparação', 'diferença', 'vs', 'versus', 'entre', 'contraste'],
      es: ['comparar', 'comparación', 'diferencia', 'vs', 'versus', 'entre', 'contraste'],
      fr: ['comparer', 'comparaison', 'différence', 'vs', 'versus', 'entre', 'contraste'],
    };
    return keywords[lang]?.some(kw => query.includes(kw)) || false;
  }
  
  private isSynthesisQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['synthesize', 'synthesis', 'combine', 'merge', 'integrate', 'consolidate'],
      pt: ['sintetizar', 'síntese', 'combinar', 'mesclar', 'integrar', 'consolidar'],
      es: ['sintetizar', 'síntesis', 'combinar', 'fusionar', 'integrar', 'consolidar'],
      fr: ['synthétiser', 'synthèse', 'combiner', 'fusionner', 'intégrer', 'consolider'],
    };
    return keywords[lang]?.some(kw => query.includes(kw)) || false;
  }
  
  private isAnalyticalQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['analyze', 'analysis', 'evaluate', 'assess', 'examine', 'investigate'],
      pt: ['analisar', 'análise', 'avaliar', 'examinar', 'investigar'],
      es: ['analizar', 'análisis', 'evaluar', 'examinar', 'investigar'],
      fr: ['analyser', 'analyse', 'évaluer', 'examiner', 'enquêter'],
    };
    return keywords[lang]?.some(kw => query.includes(kw)) || false;
  }
  
  private isCalculationQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['calculate', 'computation', 'sum', 'total', 'average', 'percentage'],
      pt: ['calcular', 'cálculo', 'soma', 'total', 'média', 'porcentagem'],
      es: ['calcular', 'cálculo', 'suma', 'total', 'promedio', 'porcentaje'],
      fr: ['calculer', 'calcul', 'somme', 'total', 'moyenne', 'pourcentage'],
    };
    return keywords[lang]?.some(kw => query.includes(kw)) || false;
  }
  
  private isFinancialQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['roi', 'npv', 'irr', 'payback', 'revenue', 'profit', 'cost', 'budget'],
      pt: ['roi', 'vpl', 'tir', 'payback', 'receita', 'lucro', 'custo', 'orçamento'],
      es: ['roi', 'vpn', 'tir', 'payback', 'ingreso', 'beneficio', 'costo', 'presupuesto'],
      fr: ['roi', 'van', 'tri', 'payback', 'revenu', 'bénéfice', 'coût', 'budget'],
    };
    return keywords[lang]?.some(kw => query.includes(kw)) || false;
  }
  
  private isNavigationQuery(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(where\s+is|find\s+section|go\s+to|navigate\s+to)\b/i],
      pt: [/\b(onde\s+está|encontrar\s+seção|ir\s+para|navegar\s+para)\b/i],
      es: [/\b(dónde\s+está|encontrar\s+sección|ir\s+a|navegar\s+a)\b/i],
      fr: [/\b(où\s+est|trouver\s+section|aller\s+à|naviguer\s+vers)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isFindInDocumentQuery(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\bfind\s+.*\s+in\s+(the\s+)?(document|file)\b/i],
      pt: [/\bencontrar\s+.*\s+no\s+(documento|arquivo)\b/i],
      es: [/\bencontrar\s+.*\s+en\s+el\s+(documento|archivo)\b/i],
      fr: [/\btrouver\s+.*\s+dans\s+le\s+(document|fichier)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isClarificationQuery(query: string, lang: LanguageCode): boolean {
    const patterns: Record<LanguageCode, RegExp[]> = {
      en: [/\bwhat\s+do\s+you\s+mean\b/i, /\bcan\s+you\s+(explain|clarify)\b/i],
      pt: [/\bo\s+que\s+você\s+quer\s+dizer\b/i, /\bpode\s+(explicar|esclarecer)\b/i],
      es: [/\bqué\s+quieres\s+decir\b/i, /\bpuedes\s+(explicar|aclarar)\b/i],
      fr: [/\bque\s+veux-tu\s+dire\b/i, /\bpeux-tu\s+(expliquer|clarifier)\b/i],
    };
    return patterns[lang]?.some(p => p.test(query)) || false;
  }
  
  private isFollowUpQuery(query: string, lang: LanguageCode): boolean {
    const keywords: Record<LanguageCode, string[]> = {
      en: ['and', 'also', 'what about', 'how about', 'tell me more'],
      pt: ['e', 'também', 'e sobre', 'que tal', 'me conte mais'],
      es: ['y', 'también', 'qué tal', 'cuéntame más'],
      fr: ['et', 'aussi', 'qu\'en est-il', 'dis-moi plus'],
    };
    // Follow-up queries are typically short and start with these words
    return query.length < 50 && keywords[lang]?.some(kw => query.startsWith(kw)) || false;
  }
  
  private isReferenceResolutionQuery(query: string, lang: LanguageCode): boolean {
    const pronouns: Record<LanguageCode, string[]> = {
      en: ['it', 'this', 'that', 'these', 'those', 'the first', 'the second', 'the last'],
      pt: ['isso', 'isto', 'aquilo', 'esse', 'este', 'aquele', 'o primeiro', 'o segundo', 'o último'],
      es: ['eso', 'esto', 'aquello', 'ese', 'este', 'aquel', 'el primero', 'el segundo', 'el último'],
      fr: ['ça', 'cela', 'ceci', 'ce', 'cette', 'le premier', 'le deuxième', 'le dernier'],
    };
    return pronouns[lang]?.some(pron => query.includes(pron)) || false;
  }
  
  // ==========================================================================
  // SKILL DETECTION - Full Implementation
  // ==========================================================================

  detectSkill(query: string, language?: LanguageCode): SkillDetectionResult | null {
    const startTime = Date.now();
    const lang = language || this.detectLanguage(query);
    const lowerQuery = query.toLowerCase().trim();

    // Define skill patterns with keywords and configurations
    const skillPatterns: Array<{
      skillId: string;
      label: string;
      category: SkillCategory;
      keywords: Record<LanguageCode, string[]>;
      retrievalStrategy: RetrievalStrategy;
      requiresMultiDoc: boolean;
      requiresCalculation: boolean;
      requiresMemory: boolean;
      outputFormat: OutputFormat;
      speedProfile: SpeedProfile;
      depthDefault: SkillMode;
      priority: number;
    }> = [
      // GENERAL SKILLS
      {
        skillId: 'GENERAL.SUMMARIZE_DOCUMENT',
        label: 'Summarize Document',
        category: SkillCategory.GENERAL,
        keywords: {
          en: ['summarize', 'summary', 'brief', 'overview', 'recap', 'highlights', 'key points'],
          pt: ['resumir', 'resumo', 'visão geral', 'sintetizar', 'síntese', 'destaques', 'pontos principais'],
          es: ['resumir', 'resumen', 'visión general', 'sintetizar', 'síntesis', 'destacados'],
          fr: ['résumer', 'résumé', 'vue d\'ensemble', 'synthétiser', 'synthèse', 'points clés'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.SUMMARY,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 90,
      },
      {
        skillId: 'GENERAL.EXPLAIN_TOPIC',
        label: 'Explain Topic',
        category: SkillCategory.GENERAL,
        keywords: {
          en: ['explain', 'what is', 'what are', 'define', 'describe', 'tell me about'],
          pt: ['explicar', 'o que é', 'o que são', 'definir', 'descrever', 'me fale sobre'],
          es: ['explicar', 'qué es', 'qué son', 'definir', 'describir', 'háblame de'],
          fr: ['expliquer', 'qu\'est-ce que', 'définir', 'décrire', 'parle-moi de'],
        },
        retrievalStrategy: RetrievalStrategy.SEMANTIC,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.DETAILED,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 85,
      },
      {
        skillId: 'GENERAL.EXTRACT_KEY_POINTS',
        label: 'Extract Key Points',
        category: SkillCategory.GENERAL,
        keywords: {
          en: ['key points', 'main points', 'important points', 'takeaways', 'highlights'],
          pt: ['pontos principais', 'pontos chave', 'pontos importantes', 'destaques'],
          es: ['puntos clave', 'puntos principales', 'puntos importantes', 'destacados'],
          fr: ['points clés', 'points principaux', 'points importants', 'faits saillants'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 88,
      },

      // COMPARISON SKILLS
      {
        skillId: 'COMPARISON.COMPARE_DOCUMENTS',
        label: 'Compare Documents',
        category: SkillCategory.COMPARISON,
        keywords: {
          en: ['compare', 'comparison', 'difference', 'differences', 'vs', 'versus', 'contrast', 'side by side'],
          pt: ['comparar', 'comparação', 'diferença', 'diferenças', 'versus', 'lado a lado', 'confrontar'],
          es: ['comparar', 'comparación', 'diferencia', 'diferencias', 'versus', 'lado a lado'],
          fr: ['comparer', 'comparaison', 'différence', 'différences', 'versus', 'côte à côte'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: true,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.COMPARISON,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 92,
      },
      {
        skillId: 'COMPARISON.DIFF_ANALYSIS',
        label: 'Diff Analysis',
        category: SkillCategory.COMPARISON,
        keywords: {
          en: ['what changed', 'what\'s different', 'modifications', 'changes between', 'diff'],
          pt: ['o que mudou', 'o que é diferente', 'modificações', 'mudanças entre', 'alterações'],
          es: ['qué cambió', 'qué es diferente', 'modificaciones', 'cambios entre'],
          fr: ['qu\'est-ce qui a changé', 'ce qui est différent', 'modifications', 'changements entre'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: true,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 89,
      },

      // ENTITY EXTRACTION SKILLS
      {
        skillId: 'ENTITY_EXTRACTION.EXTRACT_DATES',
        label: 'Extract Dates',
        category: SkillCategory.ENTITY_EXTRACTION,
        keywords: {
          en: ['dates', 'deadlines', 'when', 'timeline', 'schedule', 'due date'],
          pt: ['datas', 'prazos', 'quando', 'cronograma', 'agenda', 'data limite'],
          es: ['fechas', 'plazos', 'cuándo', 'cronograma', 'agenda', 'fecha límite'],
          fr: ['dates', 'échéances', 'quand', 'calendrier', 'agenda', 'date limite'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 86,
      },
      {
        skillId: 'ENTITY_EXTRACTION.EXTRACT_NAMES',
        label: 'Extract Names',
        category: SkillCategory.ENTITY_EXTRACTION,
        keywords: {
          en: ['names', 'people', 'who', 'parties', 'signatories', 'contacts'],
          pt: ['nomes', 'pessoas', 'quem', 'partes', 'signatários', 'contatos'],
          es: ['nombres', 'personas', 'quién', 'partes', 'firmantes', 'contactos'],
          fr: ['noms', 'personnes', 'qui', 'parties', 'signataires', 'contacts'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 84,
      },
      {
        skillId: 'ENTITY_EXTRACTION.EXTRACT_NUMBERS',
        label: 'Extract Numbers',
        category: SkillCategory.ENTITY_EXTRACTION,
        keywords: {
          en: ['numbers', 'values', 'amounts', 'figures', 'quantities', 'metrics'],
          pt: ['números', 'valores', 'quantias', 'cifras', 'quantidades', 'métricas'],
          es: ['números', 'valores', 'cantidades', 'cifras', 'métricas'],
          fr: ['nombres', 'valeurs', 'montants', 'chiffres', 'quantités', 'métriques'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.TABLE,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 85,
      },

      // LEGAL SKILLS
      {
        skillId: 'LEGAL.CONTRACT_ANALYSIS',
        label: 'Contract Analysis',
        category: SkillCategory.LEGAL,
        keywords: {
          en: ['contract', 'agreement', 'terms', 'conditions', 'clause', 'provisions'],
          pt: ['contrato', 'acordo', 'termos', 'condições', 'cláusula', 'disposições'],
          es: ['contrato', 'acuerdo', 'términos', 'condiciones', 'cláusula', 'disposiciones'],
          fr: ['contrat', 'accord', 'termes', 'conditions', 'clause', 'dispositions'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.DETAILED,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 91,
      },
      {
        skillId: 'LEGAL.CLAUSE_EXTRACTION',
        label: 'Clause Extraction',
        category: SkillCategory.LEGAL,
        keywords: {
          en: ['clause', 'clauses', 'provision', 'provisions', 'section', 'article'],
          pt: ['cláusula', 'cláusulas', 'disposição', 'disposições', 'seção', 'artigo'],
          es: ['cláusula', 'cláusulas', 'disposición', 'disposiciones', 'sección', 'artículo'],
          fr: ['clause', 'clauses', 'disposition', 'dispositions', 'section', 'article'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.DEFAULT,
        priority: 88,
      },
      {
        skillId: 'LEGAL.RISK_IDENTIFICATION',
        label: 'Risk Identification',
        category: SkillCategory.LEGAL,
        keywords: {
          en: ['risk', 'risks', 'liability', 'liabilities', 'exposure', 'penalty', 'penalties'],
          pt: ['risco', 'riscos', 'responsabilidade', 'responsabilidades', 'exposição', 'penalidade'],
          es: ['riesgo', 'riesgos', 'responsabilidad', 'responsabilidades', 'exposición', 'penalidad'],
          fr: ['risque', 'risques', 'responsabilité', 'responsabilités', 'exposition', 'pénalité'],
        },
        retrievalStrategy: RetrievalStrategy.SEMANTIC,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEEP,
        priority: 87,
      },
      {
        skillId: 'LEGAL.OBLIGATION_TRACKING',
        label: 'Obligation Tracking',
        category: SkillCategory.LEGAL,
        keywords: {
          en: ['obligation', 'obligations', 'duty', 'duties', 'must', 'shall', 'required'],
          pt: ['obrigação', 'obrigações', 'dever', 'deveres', 'deve', 'obrigatório'],
          es: ['obligación', 'obligaciones', 'deber', 'deberes', 'debe', 'obligatorio'],
          fr: ['obligation', 'obligations', 'devoir', 'devoirs', 'doit', 'obligatoire'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 86,
      },

      // FINANCIAL SKILLS
      {
        skillId: 'FINANCIAL.ROI_CALCULATION',
        label: 'ROI Calculation',
        category: SkillCategory.FINANCIAL,
        keywords: {
          en: ['roi', 'return on investment', 'return', 'investment return'],
          pt: ['roi', 'retorno sobre investimento', 'retorno', 'retorno do investimento'],
          es: ['roi', 'retorno de inversión', 'retorno', 'rendimiento de inversión'],
          fr: ['roi', 'retour sur investissement', 'retour', 'rendement de l\'investissement'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: false,
        requiresCalculation: true,
        requiresMemory: false,
        outputFormat: OutputFormat.TABLE,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 93,
      },
      {
        skillId: 'FINANCIAL.NPV_ANALYSIS',
        label: 'NPV Analysis',
        category: SkillCategory.FINANCIAL,
        keywords: {
          en: ['npv', 'net present value', 'present value', 'discounted cash flow'],
          pt: ['vpl', 'valor presente líquido', 'valor presente', 'fluxo de caixa descontado'],
          es: ['vpn', 'valor presente neto', 'valor actual', 'flujo de caja descontado'],
          fr: ['van', 'valeur actuelle nette', 'valeur actuelle', 'flux de trésorerie actualisé'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: false,
        requiresCalculation: true,
        requiresMemory: false,
        outputFormat: OutputFormat.TABLE,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 91,
      },
      {
        skillId: 'FINANCIAL.BUDGET_ANALYSIS',
        label: 'Budget Analysis',
        category: SkillCategory.FINANCIAL,
        keywords: {
          en: ['budget', 'budgets', 'cost', 'costs', 'expense', 'expenses', 'spending'],
          pt: ['orçamento', 'orçamentos', 'custo', 'custos', 'despesa', 'despesas', 'gastos'],
          es: ['presupuesto', 'presupuestos', 'costo', 'costos', 'gasto', 'gastos'],
          fr: ['budget', 'budgets', 'coût', 'coûts', 'dépense', 'dépenses'],
        },
        retrievalStrategy: RetrievalStrategy.HYBRID,
        requiresMultiDoc: false,
        requiresCalculation: true,
        requiresMemory: false,
        outputFormat: OutputFormat.TABLE,
        speedProfile: SpeedProfile.NORMAL,
        depthDefault: SkillMode.DEFAULT,
        priority: 89,
      },
      {
        skillId: 'FINANCIAL.REVENUE_EXTRACTION',
        label: 'Revenue Extraction',
        category: SkillCategory.FINANCIAL,
        keywords: {
          en: ['revenue', 'revenues', 'income', 'sales', 'earnings', 'turnover'],
          pt: ['receita', 'receitas', 'renda', 'vendas', 'faturamento', 'ganhos'],
          es: ['ingreso', 'ingresos', 'renta', 'ventas', 'facturación', 'ganancias'],
          fr: ['revenu', 'revenus', 'recette', 'ventes', 'chiffre d\'affaires', 'gains'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.FACT,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 88,
      },

      // PROJECT SKILLS
      {
        skillId: 'PROJECT.MILESTONE_TRACKING',
        label: 'Milestone Tracking',
        category: SkillCategory.PROJECT,
        keywords: {
          en: ['milestone', 'milestones', 'deliverable', 'deliverables', 'checkpoint'],
          pt: ['marco', 'marcos', 'entrega', 'entregas', 'etapa'],
          es: ['hito', 'hitos', 'entregable', 'entregables', 'punto de control'],
          fr: ['jalon', 'jalons', 'livrable', 'livrables', 'point de contrôle'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.TIMELINE,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.DEFAULT,
        priority: 85,
      },
      {
        skillId: 'PROJECT.DEADLINE_EXTRACTION',
        label: 'Deadline Extraction',
        category: SkillCategory.PROJECT,
        keywords: {
          en: ['deadline', 'deadlines', 'due', 'due date', 'target date', 'by when'],
          pt: ['prazo', 'prazos', 'vencimento', 'data limite', 'até quando'],
          es: ['fecha límite', 'plazo', 'plazos', 'vencimiento', 'hasta cuándo'],
          fr: ['échéance', 'échéances', 'date limite', 'date cible', 'jusqu\'à quand'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.LIST,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 86,
      },

      // CALCULATION SKILLS
      {
        skillId: 'CALCULATION.PERCENTAGE',
        label: 'Percentage Calculation',
        category: SkillCategory.CALCULATION,
        keywords: {
          en: ['percentage', 'percent', '%', 'what percent', 'percentage of'],
          pt: ['porcentagem', 'percentual', '%', 'qual porcentagem', 'percentual de'],
          es: ['porcentaje', 'por ciento', '%', 'qué porcentaje', 'porcentaje de'],
          fr: ['pourcentage', 'pour cent', '%', 'quel pourcentage', 'pourcentage de'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: true,
        requiresMemory: false,
        outputFormat: OutputFormat.FACT,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 90,
      },
      {
        skillId: 'CALCULATION.GROWTH',
        label: 'Growth Calculation',
        category: SkillCategory.CALCULATION,
        keywords: {
          en: ['growth', 'growth rate', 'increase', 'decrease', 'change'],
          pt: ['crescimento', 'taxa de crescimento', 'aumento', 'diminuição', 'variação'],
          es: ['crecimiento', 'tasa de crecimiento', 'aumento', 'disminución', 'cambio'],
          fr: ['croissance', 'taux de croissance', 'augmentation', 'diminution', 'changement'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: true,
        requiresMemory: false,
        outputFormat: OutputFormat.FACT,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 88,
      },

      // NAVIGATION SKILLS
      {
        skillId: 'NAVIGATION.FIND_SECTION',
        label: 'Find Section',
        category: SkillCategory.NAVIGATION,
        keywords: {
          en: ['section', 'chapter', 'part', 'article', 'where is', 'find section'],
          pt: ['seção', 'capítulo', 'parte', 'artigo', 'onde está', 'encontrar seção'],
          es: ['sección', 'capítulo', 'parte', 'artículo', 'dónde está', 'encontrar sección'],
          fr: ['section', 'chapitre', 'partie', 'article', 'où est', 'trouver section'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.FACT,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 87,
      },
      {
        skillId: 'NAVIGATION.FIND_PAGE',
        label: 'Find Page',
        category: SkillCategory.NAVIGATION,
        keywords: {
          en: ['page', 'pages', 'which page', 'on page', 'page number'],
          pt: ['página', 'páginas', 'qual página', 'na página', 'número da página'],
          es: ['página', 'páginas', 'qué página', 'en la página', 'número de página'],
          fr: ['page', 'pages', 'quelle page', 'à la page', 'numéro de page'],
        },
        retrievalStrategy: RetrievalStrategy.KEYWORD,
        requiresMultiDoc: false,
        requiresCalculation: false,
        requiresMemory: false,
        outputFormat: OutputFormat.FACT,
        speedProfile: SpeedProfile.FAST,
        depthDefault: SkillMode.LIGHT,
        priority: 86,
      },
    ];

    // Find best matching skill
    let bestMatch: typeof skillPatterns[0] | null = null;
    let bestScore = 0;

    for (const skill of skillPatterns) {
      const keywords = skill.keywords[lang] || skill.keywords.en;
      let matchCount = 0;

      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const score = (matchCount / keywords.length) * skill.priority;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = skill;
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    const confidence = Math.min(0.99, bestScore / 100);

    return {
      skillId: bestMatch.skillId,
      label: bestMatch.label,
      category: bestMatch.category,
      confidence,
      language: lang,
      matchedPattern: `${bestMatch.skillId}_${lang.toUpperCase()}`,
      detectionTimeMs: Date.now() - startTime,
      retrievalStrategy: bestMatch.retrievalStrategy,
      requiresMultiDoc: bestMatch.requiresMultiDoc,
      requiresCalculation: bestMatch.requiresCalculation,
      requiresMemory: bestMatch.requiresMemory,
      outputFormat: bestMatch.outputFormat,
      speedProfile: bestMatch.speedProfile,
      depthDefault: bestMatch.depthDefault,
    };
  }

  // ==========================================================================
  // ENTITY EXTRACTION - Full Implementation
  // ==========================================================================

  extractEntities(query: string, language?: LanguageCode): EntityExtractionResult[] {
    const lang = language || this.detectLanguage(query);
    const entities: EntityExtractionResult[] = [];

    // Extract document names (filename.ext)
    const docNamePattern = /\b([A-Za-z0-9_\-\s]+\.(pdf|docx?|xlsx?|pptx?|txt|csv))\b/gi;
    let match: RegExpExecArray | null;
    while ((match = docNamePattern.exec(query)) !== null) {
      entities.push({
        type: EntityType.DOCUMENT_NAME,
        value: match[1],
        normalizedValue: match[1].toLowerCase().trim(),
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract ordinal references
    const ordinalPatterns: Record<LanguageCode, Record<string, number>> = {
      en: { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, last: -1, previous: -2, next: 1 },
      pt: { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5, sexto: 6, sétimo: 7, oitavo: 8, nono: 9, décimo: 10, último: -1, anterior: -2, próximo: 1 },
      es: { primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, séptimo: 7, octavo: 8, noveno: 9, décimo: 10, último: -1, anterior: -2, próximo: 1 },
      fr: { premier: 1, deuxième: 2, troisième: 3, quatrième: 4, cinquième: 5, sixième: 6, septième: 7, huitième: 8, neuvième: 9, dixième: 10, dernier: -1, précédent: -2, suivant: 1 },
    };

    const ordinals = ordinalPatterns[lang] || ordinalPatterns.en;
    for (const [word, value] of Object.entries(ordinals)) {
      const pattern = new RegExp(`\\b${word}\\b`, 'gi');
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          type: EntityType.ORDINAL_REFERENCE,
          value: match[0],
          normalizedValue: String(value),
          confidence: 0.90,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Extract pronoun references
    const pronounPatterns: Record<LanguageCode, string[]> = {
      en: ['it', 'this', 'that', 'these', 'those', 'the document', 'the file', 'this one', 'that one'],
      pt: ['isso', 'isto', 'aquilo', 'esse', 'este', 'aquele', 'o documento', 'o arquivo', 'esse aí', 'este aqui'],
      es: ['eso', 'esto', 'aquello', 'ese', 'este', 'aquel', 'el documento', 'el archivo'],
      fr: ['ça', 'cela', 'ceci', 'ce', 'cette', 'celui-ci', 'celui-là', 'le document', 'le fichier'],
    };

    const pronouns = pronounPatterns[lang] || pronounPatterns.en;
    for (const pronoun of pronouns) {
      const pattern = new RegExp(`\\b${pronoun}\\b`, 'gi');
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          type: EntityType.PRONOUN_REFERENCE,
          value: match[0],
          normalizedValue: pronoun.toLowerCase(),
          confidence: 0.85,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Extract dates (various formats)
    const datePatterns = [
      /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g,  // DD/MM/YYYY, MM-DD-YYYY
      /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,    // YYYY-MM-DD
      /\b(\d{1,2}\s+(?:de\s+)?(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?\d{2,4})?)\b/gi, // Portuguese
      /\b(\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?\d{2,4})?)\b/gi, // Spanish
      /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+\d{2,4})?)\b/gi, // English
    ];

    for (const pattern of datePatterns) {
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          type: EntityType.DATE,
          value: match[1],
          normalizedValue: match[1],
          confidence: 0.88,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Extract currency values
    const currencyPattern = /\b(R\$|US\$|\$|€|£)\s*([\d.,]+(?:\s*(?:mil|thousand|milhão|milhões|million|millions|bilhão|bilhões|billion|billions))?)\b/gi;
    while ((match = currencyPattern.exec(query)) !== null) {
      entities.push({
        type: EntityType.CURRENCY,
        value: match[0],
        normalizedValue: match[0].replace(/\s+/g, ' ').trim(),
        confidence: 0.92,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract percentages
    const percentPattern = /\b(\d+(?:[.,]\d+)?)\s*%/g;
    while ((match = percentPattern.exec(query)) !== null) {
      entities.push({
        type: EntityType.PERCENTAGE,
        value: match[0],
        normalizedValue: match[1].replace(',', '.'),
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract section references
    const sectionPatterns: Record<LanguageCode, RegExp[]> = {
      en: [/\b(section|chapter|part|article)\s+(\d+|[A-Z](?:\.\d+)*)\b/gi],
      pt: [/\b(seção|capítulo|parte|artigo)\s+(\d+|[A-Z](?:\.\d+)*)\b/gi],
      es: [/\b(sección|capítulo|parte|artículo)\s+(\d+|[A-Z](?:\.\d+)*)\b/gi],
      fr: [/\b(section|chapitre|partie|article)\s+(\d+|[A-Z](?:\.\d+)*)\b/gi],
    };

    const sectionPats = sectionPatterns[lang] || sectionPatterns.en;
    for (const pattern of sectionPats) {
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          type: EntityType.SECTION_REFERENCE,
          value: match[0],
          normalizedValue: match[2],
          confidence: 0.90,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Extract plain numbers (large numbers with separators)
    const numberPattern = /\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?)\b/g;
    let numMatch: RegExpExecArray | null;
    while ((numMatch = numberPattern.exec(query)) !== null) {
      // Avoid duplicates with currency/percentage
      const matchIndex = numMatch.index;
      const alreadyExtracted = entities.some(e =>
        e.startIndex !== undefined &&
        matchIndex >= e.startIndex &&
        matchIndex < (e.endIndex || 0)
      );
      if (!alreadyExtracted) {
        entities.push({
          type: EntityType.NUMBER,
          value: numMatch[1],
          normalizedValue: numMatch[1].replace(/[.,]/g, ''),
          confidence: 0.80,
          startIndex: numMatch.index,
          endIndex: numMatch.index + numMatch[0].length,
        });
      }
    }

    return entities;
  }

  // ==========================================================================
  // FILE ACTION DETECTION - Full Implementation
  // ==========================================================================

  detectFileAction(query: string, language?: LanguageCode): FileActionDetectionResult | null {
    const startTime = Date.now();
    const lang = language || this.detectLanguage(query);
    const lowerQuery = query.toLowerCase().trim();

    // Define file action patterns
    const actionPatterns: Array<{
      actionId: FileActionType;
      patterns: Record<LanguageCode, RegExp[]>;
      uiHint?: string;
      requiresConfirmation: boolean;
      priority: number;
    }> = [
      {
        actionId: FileActionType.DELETE_FILE,
        patterns: {
          en: [/\b(delete|remove|erase|trash|get rid of)\s+(the\s+)?(document|file|this)\b/i],
          pt: [/\b(deletar|remover|apagar|excluir|eliminar)\s+(o\s+)?(documento|arquivo|isso)\b/i],
          es: [/\b(eliminar|borrar|quitar|suprimir)\s+(el\s+)?(documento|archivo|esto)\b/i],
          fr: [/\b(supprimer|effacer|enlever|retirer)\s+(le\s+)?(document|fichier|ceci)\b/i],
        },
        uiHint: 'confirm_delete',
        requiresConfirmation: true,
        priority: 95,
      },
      {
        actionId: FileActionType.OPEN_FILE,
        patterns: {
          en: [/\b(open|view|access|launch)\s+(the\s+)?(document|file)\b/i],
          pt: [/\b(abrir|visualizar|acessar)\s+(o\s+)?(documento|arquivo)\b/i],
          es: [/\b(abrir|ver|acceder)\s+(el\s+)?(documento|archivo)\b/i],
          fr: [/\b(ouvrir|voir|accéder)\s+(le\s+)?(document|fichier)\b/i],
        },
        uiHint: 'open_viewer',
        requiresConfirmation: false,
        priority: 90,
      },
      {
        actionId: FileActionType.SHOW_FILE,
        patterns: {
          en: [/\b(show|display|present)\s+(me\s+)?(the\s+)?(document|file)\b/i],
          pt: [/\b(mostrar|exibir|apresentar)\s+(me\s+)?(o\s+)?(documento|arquivo)\b/i],
          es: [/\b(mostrar|enseñar|presentar)\s+(me\s+)?(el\s+)?(documento|archivo)\b/i],
          fr: [/\b(montrer|afficher|présenter)\s+(moi\s+)?(le\s+)?(document|fichier)\b/i],
        },
        uiHint: 'display_preview',
        requiresConfirmation: false,
        priority: 88,
      },
      {
        actionId: FileActionType.UPLOAD_FILE,
        patterns: {
          en: [/\b(upload|add|import|submit)\s+(a\s+)?(new\s+)?(document|file)\b/i, /\bhow\s+(do\s+i\s+|to\s+)upload\b/i],
          pt: [/\b(fazer\s+upload|carregar|adicionar|importar|enviar)\s+(um\s+)?(novo\s+)?(documento|arquivo)\b/i, /\bcomo\s+(fazer\s+)?upload\b/i],
          es: [/\b(subir|añadir|agregar|importar)\s+(un\s+)?(nuevo\s+)?(documento|archivo)\b/i, /\bcómo\s+subir\b/i],
          fr: [/\b(télécharger|ajouter|importer|envoyer)\s+(un\s+)?(nouveau\s+)?(document|fichier)\b/i, /\bcomment\s+télécharger\b/i],
        },
        uiHint: 'show_upload_dialog',
        requiresConfirmation: false,
        priority: 92,
      },
      {
        actionId: FileActionType.NAVIGATE_TO,
        patterns: {
          en: [/\b(go\s+to|navigate\s+to|take\s+me\s+to|bring\s+up)\s+(the\s+)?(document|file|section|page)\b/i],
          pt: [/\b(ir\s+para|navegar\s+para|me\s+leve\s+(para|ao?)|abrir)\s+(o\s+)?(documento|arquivo|seção|página)\b/i],
          es: [/\b(ir\s+a|navegar\s+a|llévame\s+a)\s+(el\s+)?(documento|archivo|sección|página)\b/i],
          fr: [/\b(aller\s+à|naviguer\s+vers|emmène-moi\s+à)\s+(le\s+)?(document|fichier|section|page)\b/i],
        },
        uiHint: 'navigate_to_location',
        requiresConfirmation: false,
        priority: 85,
      },
      {
        actionId: FileActionType.MOVE_FILE,
        patterns: {
          en: [/\b(move|transfer|relocate)\s+(the\s+)?(document|file)\s+(to|into)\b/i],
          pt: [/\b(mover|transferir|mudar)\s+(o\s+)?(documento|arquivo)\s+(para)\b/i],
          es: [/\b(mover|transferir|trasladar)\s+(el\s+)?(documento|archivo)\s+(a|hacia)\b/i],
          fr: [/\b(déplacer|transférer|bouger)\s+(le\s+)?(document|fichier)\s+(vers|dans)\b/i],
        },
        uiHint: 'show_folder_picker',
        requiresConfirmation: true,
        priority: 86,
      },
    ];

    // Find best matching action
    for (const action of actionPatterns.sort((a, b) => b.priority - a.priority)) {
      const patterns = action.patterns[lang] || action.patterns.en;
      for (const pattern of patterns) {
        if (pattern.test(lowerQuery)) {
          // Try to extract document reference
          let documentReference: string | undefined;

          // Look for filename
          const filenameMatch = query.match(/\b([A-Za-z0-9_\-]+\.(pdf|docx?|xlsx?|pptx?))\b/i);
          if (filenameMatch) {
            documentReference = filenameMatch[1];
          }

          // Look for "the [document type]" pattern
          if (!documentReference) {
            const docTypeMatch = query.match(/\b(the|o|el|le)\s+([A-Za-z]+)\s+(document|file|arquivo|documento|archivo|fichier)\b/i);
            if (docTypeMatch) {
              documentReference = docTypeMatch[2];
            }
          }

          return {
            actionId: action.actionId,
            confidence: action.priority / 100,
            language: lang,
            matchedPattern: `${action.actionId}_${lang.toUpperCase()}`,
            documentReference,
            uiHint: action.uiHint,
            requiresConfirmation: action.requiresConfirmation,
          };
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // MODE DETECTION - Full Implementation
  // ==========================================================================

  detectMode(query: string, language?: LanguageCode): ModeDetectionResult | null {
    const lang = language || this.detectLanguage(query);
    const lowerQuery = query.toLowerCase().trim();

    // Define mode override patterns
    const modePatterns: Array<{
      id: string;
      patterns: Record<LanguageCode, string[]>;
      complexityOverride?: QueryComplexity;
      speedProfileOverride?: SpeedProfile;
      depthOverride?: SkillMode;
      priority: number;
    }> = [
      // QUICK/FAST mode
      {
        id: 'QUICK',
        patterns: {
          en: ['quick', 'quickly', 'brief', 'briefly', 'short', 'fast', 'rapid'],
          pt: ['rápido', 'rapidamente', 'breve', 'brevemente', 'curto', 'resumido'],
          es: ['rápido', 'rápidamente', 'breve', 'brevemente', 'corto', 'resumido'],
          fr: ['rapide', 'rapidement', 'bref', 'brièvement', 'court', 'résumé'],
        },
        speedProfileOverride: SpeedProfile.ULTRA_FAST,
        depthOverride: SkillMode.LIGHT,
        priority: 90,
      },
      // DETAILED/DEEP mode
      {
        id: 'DETAILED',
        patterns: {
          en: ['detailed', 'in detail', 'in-depth', 'comprehensive', 'thorough', 'complete', 'full'],
          pt: ['detalhado', 'em detalhes', 'aprofundado', 'completo', 'minucioso', 'total'],
          es: ['detallado', 'en detalle', 'profundo', 'completo', 'minucioso', 'total'],
          fr: ['détaillé', 'en détail', 'approfondi', 'complet', 'minutieux', 'total'],
        },
        speedProfileOverride: SpeedProfile.DEEP,
        depthOverride: SkillMode.DEEP,
        priority: 88,
      },
      // SIMPLE mode
      {
        id: 'SIMPLE',
        patterns: {
          en: ['simple', 'simply', 'basic', 'easy', 'straightforward'],
          pt: ['simples', 'simplesmente', 'básico', 'fácil', 'direto'],
          es: ['simple', 'simplemente', 'básico', 'fácil', 'directo'],
          fr: ['simple', 'simplement', 'basique', 'facile', 'direct'],
        },
        complexityOverride: QueryComplexity.SIMPLE,
        depthOverride: SkillMode.LIGHT,
        priority: 85,
      },
      // LIST format request
      {
        id: 'LIST_FORMAT',
        patterns: {
          en: ['as a list', 'in list form', 'bullet points', 'bulleted', 'numbered list'],
          pt: ['em lista', 'em forma de lista', 'em tópicos', 'numerado', 'com marcadores'],
          es: ['en lista', 'en forma de lista', 'puntos', 'numerado', 'con viñetas'],
          fr: ['en liste', 'sous forme de liste', 'points', 'numéroté', 'avec puces'],
        },
        priority: 82,
      },
      // TABLE format request
      {
        id: 'TABLE_FORMAT',
        patterns: {
          en: ['as a table', 'in table form', 'tabular', 'in columns'],
          pt: ['em tabela', 'em forma de tabela', 'tabular', 'em colunas'],
          es: ['en tabla', 'en forma de tabla', 'tabular', 'en columnas'],
          fr: ['en tableau', 'sous forme de tableau', 'tabulaire', 'en colonnes'],
        },
        priority: 82,
      },
      // SUMMARY format request
      {
        id: 'SUMMARY_FORMAT',
        patterns: {
          en: ['summarize', 'summarized', 'summary', 'in summary', 'sum up'],
          pt: ['resumir', 'resumido', 'resumo', 'em resumo', 'sintetizar'],
          es: ['resumir', 'resumido', 'resumen', 'en resumen', 'sintetizar'],
          fr: ['résumer', 'résumé', 'en résumé', 'synthétiser'],
        },
        depthOverride: SkillMode.LIGHT,
        priority: 84,
      },
    ];

    // Find best matching mode
    let bestMatch: typeof modePatterns[0] | null = null;
    let bestScore = 0;

    for (const mode of modePatterns) {
      const keywords = mode.patterns[lang] || mode.patterns.en;
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          if (mode.priority > bestScore) {
            bestScore = mode.priority;
            bestMatch = mode;
          }
          break;
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    return {
      complexityOverride: bestMatch.complexityOverride,
      speedProfileOverride: bestMatch.speedProfileOverride,
      depthOverride: bestMatch.depthOverride,
      confidence: bestScore / 100,
      matchedPattern: `${bestMatch.id}_${lang.toUpperCase()}`,
    };
  }
  
  // ==========================================================================
  // OUTPUT FORMAT DETECTION
  // ==========================================================================
  
  detectOutputFormat(query: string, language?: LanguageCode): OutputFormat | null {
    const lang = language || this.detectLanguage(query);
    const lowerQuery = query.toLowerCase();
    
    // Table format
    if (/\b(table|tabela|tabla|tableau)\b/i.test(lowerQuery)) {
      return OutputFormat.TABLE;
    }
    
    // List format
    if (/\b(list|lista|liste)\b/i.test(lowerQuery)) {
      return OutputFormat.LIST;
    }
    
    // Summary format
    if (/\b(summary|resumo|resumen|résumé)\b/i.test(lowerQuery)) {
      return OutputFormat.SUMMARY;
    }
    
    // Steps format
    if (/\b(steps|passos|pasos|étapes)\b/i.test(lowerQuery)) {
      return OutputFormat.STEPS;
    }
    
    // Comparison format
    if (/\b(compare|comparar|comparer)\b/i.test(lowerQuery)) {
      return OutputFormat.COMPARISON;
    }
    
    return null;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const centralizedPatternMatcher = new CentralizedPatternMatcher();
