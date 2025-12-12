/**
 * Pattern Classifier Service
 *
 * Provides deterministic pattern-based intent classification using regex patterns.
 * This runs BEFORE the LLM-based classifier to catch obvious patterns quickly.
 */

import { SupportedLanguage } from './languageDetector.service';

export type PatternIntent =
  | 'ANALYTICS'
  | 'SEARCH'
  | 'DOCUMENT_QNA'
  | 'PRODUCT_HELP'
  | 'CHITCHAT'
  | 'META_AI'
  | null;

export interface PatternClassificationResult {
  intent: PatternIntent;
  confidence: number;
  matchedPattern?: string;
  documentTargets?: string[];
}

interface PatternRule {
  patterns: RegExp[];
  intent: PatternIntent;
  confidence: number;
  extractDocuments?: boolean;
}

class PatternClassifierService {
  private readonly rules: PatternRule[] = [
    // ANALYTICS patterns - document counts, statistics
    {
      patterns: [
        /^(how many|quantos?|cuántos?)\s+(files?|documents?|arquivos?|documentos?)/i,
        /^(count|contar|contagem)\s+(my\s+)?(files?|documents?|arquivos?|documentos?)/i,
        /^(total|number|número|quantidade)\s+(of\s+)?(files?|documents?|arquivos?|documentos?)/i,
        /^(list|listar|mostrar)\s+(all\s+)?(my\s+)?(files?|documents?|arquivos?|documentos?)$/i,
      ],
      intent: 'ANALYTICS',
      confidence: 0.95,
    },

    // SEARCH patterns - finding documents
    {
      patterns: [
        /^(find|search|procurar|buscar|encontrar|localizar)\s+/i,
        /^(where\s+is|onde\s+(está|fica)|dónde\s+está)\s+/i,
        /^(which\s+folder|em\s+qual\s+pasta|en\s+qué\s+carpeta)/i,
      ],
      intent: 'SEARCH',
      confidence: 0.85,
      extractDocuments: true,
    },

    // CHITCHAT patterns - greetings and small talk
    {
      patterns: [
        /^(hi|hello|hey|olá|oi|hola|bom\s+dia|boa\s+tarde|boa\s+noite|buenos\s+días?)(\s|!|,|$)/i,
        /^(how\s+are\s+you|como\s+vai|como\s+está|tudo\s+bem|qué\s+tal)/i,
        /^(thanks?|thank\s+you|obrigado|obrigada|gracias)/i,
        /^(bye|goodbye|tchau|adeus|adiós|até\s+logo)/i,
      ],
      intent: 'CHITCHAT',
      confidence: 0.95,
    },

    // PRODUCT_HELP patterns - how to use the app
    {
      patterns: [
        /^(how\s+do\s+I|como\s+(eu\s+)?faço|cómo\s+puedo)\s+(use|usar|upload|enviar|carregar)/i,
        /^(what\s+can\s+you\s+do|o\s+que\s+você\s+pode|qué\s+puedes\s+hacer)/i,
        /^(help|ajuda|ayuda)(\s+me)?$/i,
        /^(what\s+are\s+your|quais\s+(são\s+)?suas?|cuáles\s+son\s+tus)\s+(features?|capabilities?|funcionalidades?|capacidades?)/i,
      ],
      intent: 'PRODUCT_HELP',
      confidence: 0.90,
    },

    // META_AI patterns - questions about AI/Koda itself
    {
      patterns: [
        /^(are\s+you|você\s+é|eres)\s+(an?\s+)?(ai|bot|robot|machine|artificial)/i,
        /^(who\s+made|quem\s+(fez|criou)|quién\s+(hizo|creó))\s+(you|você|te)/i,
        /^(what\s+are\s+you|o\s+que\s+(é\s+)?você|qué\s+eres)/i,
      ],
      intent: 'META_AI',
      confidence: 0.90,
    },
  ];

  // Document name extraction pattern
  private readonly documentNamePattern = /["'「」『』]([^"'「」『』]+)["'「」『』]|(?:file|document|arquivo|documento)\s+(?:called|named|chamado|de\s+nome)\s+["']?([^"'\s,]+)["']?/gi;

  /**
   * Classify intent using deterministic patterns.
   * Returns null intent if no pattern matches.
   */
  public classify(query: string, language: SupportedLanguage): PatternClassificationResult {
    const normalizedQuery = query.trim();

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(normalizedQuery)) {
          const result: PatternClassificationResult = {
            intent: rule.intent,
            confidence: rule.confidence,
            matchedPattern: pattern.source,
          };

          // Extract document names if applicable
          if (rule.extractDocuments) {
            result.documentTargets = this.extractDocumentNames(normalizedQuery);
          }

          return result;
        }
      }
    }

    // No pattern matched
    return {
      intent: null,
      confidence: 0,
    };
  }

  /**
   * Extract quoted document names from query.
   */
  private extractDocumentNames(query: string): string[] {
    const names: string[] = [];
    let match;

    // Reset regex state
    this.documentNamePattern.lastIndex = 0;

    while ((match = this.documentNamePattern.exec(query)) !== null) {
      const name = match[1] || match[2];
      if (name && name.trim()) {
        names.push(name.trim());
      }
    }

    return names;
  }

  /**
   * Check if query is a simple greeting.
   */
  public isGreeting(query: string): boolean {
    const result = this.classify(query, 'en');
    return result.intent === 'CHITCHAT' && result.confidence >= 0.9;
  }

  /**
   * Check if query is asking about analytics/counts.
   */
  public isAnalyticsQuery(query: string): boolean {
    const result = this.classify(query, 'en');
    return result.intent === 'ANALYTICS';
  }
}

export const patternClassifierService = new PatternClassifierService();
export default patternClassifierService;
