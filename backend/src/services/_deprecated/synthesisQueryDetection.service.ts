/**
 * Synthesis Query Detection Service
 *
 * Detects queries that require cross-document analysis, theme extraction,
 * or synthesis across multiple documents.
 *
 * Examples:
 * - "Analyze the key themes across all my documents"
 * - "List all the main topics from my documents"
 * - "What are the common themes?"
 * - "Summarize all my documents"
 * - "What topics do my documents cover?"
 */

export interface SynthesisQueryResult {
  isSynthesis: boolean;
  isSynthesisQuery: boolean;
  type: 'theme_analysis' | 'topic_extraction' | 'cross_document_summary' | 'trend_analysis' | '';
  topic: string;
  confidence: number;
}

/**
 * Patterns that indicate synthesis queries
 */
const SYNTHESIS_PATTERNS = {
  // Theme analysis
  theme_analysis: [
    /(?:analyze|identify|find|extract|list|show|what are).*(?:key|main|common|recurring|major).*(?:themes?|patterns?|trends?)/i,
    /(?:themes?|patterns?).*(?:across|in|from).*(?:all|my|the).*documents?/i,
    /what.*themes?.*(?:do|can).*(?:you|i).*(?:see|find|identify)/i,
    /(?:common|recurring|major).*themes?/i,
    // Portuguese patterns
    /(?:analisar|identificar|encontrar|extrair|listar|mostrar|quais são).*(?:principais|comuns|recorrentes).*(?:temas?|padrões?|tendências?)/i,
    /(?:temas?|padrões?).*(?:através|em|de).*(?:todos?|meus?|os?).*documentos?/i,
    // Spanish patterns
    /(?:analizar|identificar|encontrar|extraer|listar|mostrar|cuáles son).*(?:principales|comunes|recurrentes).*(?:temas?|patrones?|tendencias?)/i,
  ],

  // Topic extraction
  topic_extraction: [
    /(?:list|show|what are|identify|extract).*(?:all|main|key|major).*(?:topics?|subjects?|areas?)/i,
    /(?:topics?|subjects?).*(?:covered|discussed|mentioned).*(?:in|across).*documents?/i,
    /what.*(?:topics?|subjects?).*(?:do|are).*(?:my|the).*documents?.*(?:cover|discuss|about)/i,
    /(?:main|key|major).*(?:topics?|subjects?|areas?)/i,
    // Portuguese patterns
    /(?:listar|mostrar|quais são|identificar|extrair).*(?:todos?|principais).*(?:tópicos?|assuntos?|áreas?)/i,
    /(?:tópicos?|assuntos?).*(?:cobertos?|discutidos?|mencionados?).*(?:em|através).*documentos?/i,
    // Spanish patterns
    /(?:listar|mostrar|cuáles son|identificar|extraer).*(?:todos?|principales).*(?:temas?|asuntos?|áreas?)/i,
  ],

  // Cross-document summary
  cross_document_summary: [
    /(?:summarize|summary of).*(?:all|my|the).*documents?/i,
    /(?:overview|summary).*(?:across|of).*(?:all|my|the).*documents?/i,
    /what.*(?:do|are).*(?:all|my|the).*documents?.*(?:about|cover|discuss)/i,
    /(?:general|overall|high.level).*(?:summary|overview)/i,
    // Portuguese patterns
    /(?:resumir|resumo de).*(?:todos?|meus?).*documentos?/i,
    /(?:visão geral|resumo).*(?:através|de).*(?:todos?|meus?).*documentos?/i,
    /(?:sobre o que|do que).*(?:tratam|falam).*(?:meus?|os?).*documentos?/i,
    // Spanish patterns
    /(?:resumir|resumen de).*(?:todos?|mis).*documentos?/i,
    /(?:visión general|resumen).*(?:de|a través de).*(?:todos?|mis).*documentos?/i,
  ],

  // Trend analysis
  trend_analysis: [
    /(?:trends?|patterns?|changes?).*(?:across|over|in).*(?:time|years?|documents?)/i,
    /(?:how|what).*(?:changed|evolved|developed).*(?:over time|across documents?)/i,
    /(?:temporal|chronological|historical).*(?:analysis|trends?|patterns?)/i,
    // Portuguese patterns
    /(?:tendências?|padrões?|mudanças?).*(?:através|ao longo|em).*(?:tempo|anos?|documentos?)/i,
    /(?:como|o que).*(?:mudou|evoluiu|desenvolveu).*(?:ao longo do tempo|através dos documentos?)/i,
    // Spanish patterns
    /(?:tendencias?|patrones?|cambios?).*(?:a través|a lo largo|en).*(?:tiempo|años?|documentos?)/i,
  ],
};

/**
 * Detect if a query is asking for synthesis across documents
 */
export function detect(query: string): SynthesisQueryResult {
  const lowerQuery = query.toLowerCase().trim();

  // Check each synthesis type
  for (const [type, patterns] of Object.entries(SYNTHESIS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        console.log(`✅ [SYNTHESIS DETECTION] Matched ${type} pattern: ${pattern}`);
        return {
          isSynthesis: true,
          isSynthesisQuery: true,
          type: type as any,
          topic: extractTopic(lowerQuery),
          confidence: 0.9,
        };
      }
    }
  }

  // Check for generic "all documents" queries
  if (/(?:all|my|the|todos?|meus?|mis).*(?:documents?|documentos?)/i.test(lowerQuery) &&
      /(?:analyze|summarize|list|show|what|themes?|topics?|analisar|resumir|listar|mostrar|temas?|tópicos?)/i.test(lowerQuery)) {
    console.log(`✅ [SYNTHESIS DETECTION] Matched generic "all documents" query`);
    return {
      isSynthesis: true,
      isSynthesisQuery: true,
      type: 'cross_document_summary',
      topic: extractTopic(lowerQuery),
      confidence: 0.7,
    };
  }

  return {
    isSynthesis: false,
    isSynthesisQuery: false,
    type: '',
    topic: '',
    confidence: 0,
  };
}

/**
 * Extract the topic/subject from the query
 */
function extractTopic(query: string): string {
  // Remove common question words (English, Portuguese, Spanish)
  let topic = query
    .replace(/^(?:what|how|why|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|analyze|identify|find|extract|list|show|summarize|tell me|give me|o que|como|por que|quando|onde|quem|qual|pode|poderia|analisar|identificar|encontrar|extrair|listar|mostrar|resumir|qué|cómo|por qué|cuándo|dónde|quién|cuál|puede|podría|analizar|extraer)\s+/gi, '')
    .replace(/\b(?:about|from|in|across|of|the|my|all|documents?|files?|pdfs?|sobre|de|em|através|do|da|dos|das|meu|minha|meus|minhas|todos?|todas?|documentos?|arquivos?|acerca|del|la|los|las|mi|mis)\b/gi, '')
    .trim();

  return topic || 'general';
}

/**
 * Export default object for compatibility
 */
export default {
  detect,
};

/**
 * Named export for service object (matches stub interface)
 */
export const synthesisQueryDetectionService = {
  detect,
};
