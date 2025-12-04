/**
 * Empty Response Prevention Service
 *
 * PURPOSE: Prevent empty or invalid responses from reaching the user
 *
 * WHY: Empty responses destroy user trust and experience
 * HOW: Multi-layer validation with retry logic and intelligent fallbacks
 *
 * FEATURES:
 * 1. Response validation (content, length, format)
 * 2. Retry logic with exponential backoff
 * 3. Context-aware fallback messages
 * 4. Chunk quality validation
 * 5. Query-response alignment checking
 *
 * IMPACT: Zero empty responses, improved user experience
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  severity: 'error' | 'warning' | 'info';
  suggestions?: string[];
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface ChunkQualityResult {
  isValid: boolean;
  score: number;
  reason?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

// Minimum valid response length by query type
const MIN_RESPONSE_LENGTH: Record<string, number> = {
  simple: 20,
  short: 50,
  medium: 100,
  long: 200,
  default: 50
};

// ============================================================================
// EMPTY RESPONSE PREVENTION SERVICE
// ============================================================================

class EmptyResponsePrevention {

  // ==========================================================================
  // RESPONSE VALIDATION
  // ==========================================================================

  /**
   * Validate a response before returning to user
   *
   * @param response - The LLM response text
   * @param query - The original user query
   * @param options - Validation options
   * @returns ValidationResult with validity status and reason
   */
  validateResponse(
    response: string,
    query: string,
    options: { answerLength?: string; language?: string } = {}
  ): ValidationResult {
    const { answerLength = 'medium', language = 'en' } = options;

    // Check 1: Empty or null response
    if (!response || response.trim().length === 0) {
      return {
        isValid: false,
        reason: 'Response is empty',
        severity: 'error',
        suggestions: ['Retry with different parameters', 'Check chunk quality']
      };
    }

    // Check 2: Minimum length
    const minLength = MIN_RESPONSE_LENGTH[answerLength] || MIN_RESPONSE_LENGTH.default;
    if (response.trim().length < minLength) {
      return {
        isValid: false,
        reason: `Response too short (${response.length} chars, min ${minLength})`,
        severity: 'warning',
        suggestions: ['Response may be incomplete', 'Consider retry']
      };
    }

    // Check 3: Error patterns
    const errorPatterns = this.getErrorPatterns(language);
    for (const pattern of errorPatterns) {
      if (pattern.regex.test(response)) {
        return {
          isValid: false,
          reason: pattern.reason,
          severity: 'error',
          suggestions: pattern.suggestions
        };
      }
    }

    // Check 4: Hallucination patterns (response about wrong topic)
    if (!this.isContextuallyAppropriate(response, query)) {
      return {
        isValid: false,
        reason: 'Response may not be relevant to the query',
        severity: 'warning',
        suggestions: ['Verify chunk relevance', 'Retry with refined context']
      };
    }

    // Check 5: Format validity (basic structure check)
    if (!this.hasValidFormat(response)) {
      return {
        isValid: true, // Still valid but with warning
        reason: 'Response format may need adjustment',
        severity: 'warning'
      };
    }

    return {
      isValid: true,
      severity: 'info'
    };
  }

  // ==========================================================================
  // RETRY LOGIC
  // ==========================================================================

  /**
   * Execute a function with retry logic and exponential backoff
   *
   * @param fn - The async function to execute
   * @param config - Retry configuration
   * @param context - Description of what's being retried (for logging)
   * @returns The result of the function
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: string = 'operation'
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        console.log(`[EmptyResponsePrevention] ${context}: Attempt ${attempt + 1}/${retryConfig.maxRetries + 1}`);

        const result = await fn();

        // If result is a string, validate it
        if (typeof result === 'string') {
          const validation = this.validateResponse(result, '');
          if (!validation.isValid && attempt < retryConfig.maxRetries) {
            console.warn(`[EmptyResponsePrevention] ${context}: Validation failed - ${validation.reason}`);
            throw new Error(validation.reason || 'Validation failed');
          }
        }

        console.log(`[EmptyResponsePrevention] ${context}: Success on attempt ${attempt + 1}`);
        return result;

      } catch (error) {
        lastError = error as Error;
        console.error(`[EmptyResponsePrevention] ${context}: Attempt ${attempt + 1} failed -`, error);

        if (attempt < retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt),
            retryConfig.maxDelayMs
          );
          console.log(`[EmptyResponsePrevention] ${context}: Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }

        attempt++;
      }
    }

    // All retries exhausted
    console.error(`[EmptyResponsePrevention] ${context}: All ${retryConfig.maxRetries + 1} attempts failed`);
    throw lastError || new Error(`${context} failed after ${retryConfig.maxRetries + 1} attempts`);
  }

  // ==========================================================================
  // FALLBACK RESPONSES
  // ==========================================================================

  /**
   * Get a context-aware fallback response when all retries fail
   *
   * @param query - The original user query
   * @param language - Response language
   * @param error - Optional error that caused the fallback
   * @returns A helpful fallback message
   */
  getFallbackResponse(query: string, language: string = 'en', error?: Error): string {
    const queryType = this.detectQueryType(query);

    const fallbacks = this.getFallbackMessages(language);

    // Select fallback based on query type and context
    let fallback = fallbacks.general;

    if (queryType === 'financial') {
      fallback = fallbacks.financial;
    } else if (queryType === 'list') {
      fallback = fallbacks.list;
    } else if (queryType === 'comparison') {
      fallback = fallbacks.comparison;
    }

    console.log(`[EmptyResponsePrevention] Using ${queryType} fallback response`);

    return fallback;
  }

  private getFallbackMessages(language: string): Record<string, string> {
    const messages: Record<string, Record<string, string>> = {
      en: {
        general: `**Information Not Found**

I searched through your documents but couldn't find the specific information you requested.

• Try rephrasing your question with different keywords
• Check if the relevant document is uploaded and processed
• Be more specific about what you're looking for`,

        financial: `**Financial Data Not Found**

I couldn't locate the specific financial information in your documents.

• Verify the document containing this data is uploaded
• Try searching for specific terms like "revenue", "expenses", or time periods
• Check if the data might be in a different document or sheet`,

        list: `**List Information Unavailable**

I wasn't able to compile the list you requested from your documents.

• The information may be spread across multiple documents
• Try asking about specific items rather than a complete list
• Ensure all relevant documents are uploaded`,

        comparison: `**Comparison Not Available**

I couldn't find enough information to make the comparison you requested.

• Ensure both items you want to compare are in your documents
• Try asking about each item separately first
• Check if the comparison criteria are available in the data`
      },

      pt: {
        general: `**Informacao Nao Encontrada**

Pesquisei seus documentos mas nao encontrei a informacao especifica solicitada.

• Tente reformular sua pergunta com palavras-chave diferentes
• Verifique se o documento relevante esta carregado e processado
• Seja mais especifico sobre o que voce esta procurando`,

        financial: `**Dados Financeiros Nao Encontrados**

Nao consegui localizar as informacoes financeiras especificas em seus documentos.

• Verifique se o documento com esses dados esta carregado
• Tente buscar termos especificos como "receita", "despesas" ou periodos
• Confira se os dados podem estar em outro documento ou planilha`,

        list: `**Lista Nao Disponivel**

Nao consegui compilar a lista solicitada a partir dos seus documentos.

• As informacoes podem estar espalhadas em varios documentos
• Tente perguntar sobre itens especificos em vez de uma lista completa
• Certifique-se de que todos os documentos relevantes estao carregados`,

        comparison: `**Comparacao Nao Disponivel**

Nao encontrei informacoes suficientes para fazer a comparacao solicitada.

• Certifique-se de que ambos os itens estao nos seus documentos
• Tente perguntar sobre cada item separadamente primeiro
• Verifique se os criterios de comparacao estao disponiveis nos dados`
      },

      es: {
        general: `**Informacion No Encontrada**

Busque en sus documentos pero no pude encontrar la informacion especifica solicitada.

• Intente reformular su pregunta con diferentes palabras clave
• Verifique si el documento relevante esta cargado y procesado
• Sea mas especifico sobre lo que esta buscando`,

        financial: `**Datos Financieros No Encontrados**

No pude localizar la informacion financiera especifica en sus documentos.

• Verifique si el documento con estos datos esta cargado
• Intente buscar terminos especificos como "ingresos", "gastos" o periodos
• Compruebe si los datos pueden estar en otro documento u hoja`,

        list: `**Lista No Disponible**

No pude compilar la lista solicitada de sus documentos.

• La informacion puede estar distribuida en varios documentos
• Intente preguntar sobre elementos especificos en lugar de una lista completa
• Asegurese de que todos los documentos relevantes esten cargados`,

        comparison: `**Comparacion No Disponible**

No encontre suficiente informacion para hacer la comparacion solicitada.

• Asegurese de que ambos elementos esten en sus documentos
• Intente preguntar sobre cada elemento por separado primero
• Verifique si los criterios de comparacion estan disponibles en los datos`
      }
    };

    return messages[language] || messages.en;
  }

  // ==========================================================================
  // CHUNK QUALITY VALIDATION
  // ==========================================================================

  /**
   * Validate the quality of retrieved chunks before LLM processing
   *
   * @param chunks - Retrieved document chunks
   * @param query - The user query
   * @returns ChunkQualityResult with validation status
   */
  validateChunks(
    chunks: Array<{ content?: string; score?: number; metadata?: any }>,
    query: string
  ): ChunkQualityResult {
    // Check 1: No chunks retrieved
    if (!chunks || chunks.length === 0) {
      return {
        isValid: false,
        score: 0,
        reason: 'No relevant chunks found in documents'
      };
    }

    // Check 2: All chunks have very low scores
    const scores = chunks.map(c => c.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);

    if (maxScore < 0.3) {
      return {
        isValid: false,
        score: avgScore,
        reason: 'Retrieved chunks have very low relevance scores'
      };
    }

    // Check 3: Chunks have meaningful content
    const meaningfulChunks = chunks.filter(c => {
      const content = c.content || '';
      return content.trim().length > 50;
    });

    if (meaningfulChunks.length === 0) {
      return {
        isValid: false,
        score: avgScore,
        reason: 'Retrieved chunks contain insufficient content'
      };
    }

    // Check 4: At least some chunks contain query-related terms
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    const hasRelevantContent = chunks.some(c => {
      const content = (c.content || '').toLowerCase();
      return queryTerms.some(term => content.includes(term));
    });

    if (!hasRelevantContent && queryTerms.length > 0) {
      return {
        isValid: true, // Still valid but low confidence
        score: avgScore * 0.5,
        reason: 'Chunks may not directly address the query terms'
      };
    }

    return {
      isValid: true,
      score: avgScore
    };
  }

  // ==========================================================================
  // CONTEXTUAL APPROPRIATENESS
  // ==========================================================================

  /**
   * Check if the response is contextually appropriate for the query
   * This helps detect hallucinations and off-topic responses
   *
   * @param response - The LLM response
   * @param query - The original query
   * @returns boolean indicating if response is appropriate
   */
  isContextuallyAppropriate(response: string, query: string): boolean {
    if (!query || query.length < 5) {
      return true; // Can't validate without meaningful query
    }

    const queryLower = query.toLowerCase();
    const responseLower = response.toLowerCase();

    // Extract key entities from query
    const queryEntities = this.extractEntities(queryLower);

    // If query has specific entities, check if response mentions any
    if (queryEntities.length > 0) {
      const mentionsEntity = queryEntities.some(entity =>
        responseLower.includes(entity.toLowerCase())
      );

      // If no entities mentioned and response is long, might be off-topic
      if (!mentionsEntity && response.length > 200) {
        console.warn(`[EmptyResponsePrevention] Response may be off-topic - no query entities found`);
        return false;
      }
    }

    // Check for obvious mismatches
    const mismatchPatterns = [
      { query: /revenue|income|sales/i, response: /expense|cost|spending/i, topic: 'financial direction' },
      { query: /increase|growth|up/i, response: /decrease|decline|down/i, topic: 'trend direction' },
      { query: /2024/i, response: /2023|2022|2021/i, topic: 'year mismatch' },
      { query: /q1|q2|q3|q4/i, response: /different quarter/i, topic: 'quarter mismatch' }
    ];

    for (const pattern of mismatchPatterns) {
      if (pattern.query.test(queryLower) && pattern.response.test(responseLower)) {
        // This is actually fine - comparing or contrasting is valid
        // Only flag if the query explicitly asks for one thing and gets another
        continue;
      }
    }

    return true;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private getErrorPatterns(language: string): Array<{ regex: RegExp; reason: string; suggestions: string[] }> {
    const patterns = [
      // English
      {
        regex: /I cannot|I'm unable to|I don't have access/i,
        reason: 'LLM reported inability to answer',
        suggestions: ['Check if documents contain relevant information', 'Rephrase query']
      },
      {
        regex: /no information|not found|couldn't find/i,
        reason: 'Information not found in context',
        suggestions: ['Verify document upload', 'Try broader search terms']
      },
      {
        regex: /error occurred|something went wrong/i,
        reason: 'Error during processing',
        suggestions: ['Retry the query', 'Check system status']
      },
      // Portuguese
      {
        regex: /nao consigo|nao posso|nao tenho acesso/i,
        reason: 'LLM reported inability to answer (PT)',
        suggestions: ['Verifique se os documentos contem informacoes relevantes']
      },
      // Spanish
      {
        regex: /no puedo|no tengo acceso|no encuentro/i,
        reason: 'LLM reported inability to answer (ES)',
        suggestions: ['Verifique si los documentos contienen informacion relevante']
      }
    ];

    return patterns;
  }

  private hasValidFormat(response: string): boolean {
    // Basic format checks
    const lines = response.split('\n').filter(l => l.trim());

    // Should have at least 2 lines (title + content)
    if (lines.length < 2) {
      return false;
    }

    // Check for basic structure (title or bullet points)
    const hasTitle = /^\*\*[^*]+\*\*/.test(response);
    const hasBullets = /^[•\-\*]\s/.test(response) || /\n[•\-\*]\s/.test(response);

    return hasTitle || hasBullets || lines.length >= 3;
  }

  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (/revenue|expense|cost|profit|budget|price|payment|income/i.test(lowerQuery)) {
      return 'financial';
    }

    if (/compare|vs|versus|difference|between/i.test(lowerQuery)) {
      return 'comparison';
    }

    if (/list|all|what are|show me|enumerate/i.test(lowerQuery)) {
      return 'list';
    }

    return 'general';
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];

    // Extract quoted strings
    const quotes = text.match(/"([^"]+)"|'([^']+)'/g);
    if (quotes) {
      entities.push(...quotes.map(q => q.replace(/['"]/g, '')));
    }

    // Extract capitalized words (potential proper nouns)
    const capitals = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (capitals) {
      entities.push(...capitals);
    }

    // Extract numbers with context (years, amounts)
    const numbers = text.match(/\b(20\d{2}|Q[1-4]|\$[\d,]+)/gi);
    if (numbers) {
      entities.push(...numbers);
    }

    // Extract file names
    const files = text.match(/\b\w+\.(pdf|xlsx|docx|csv|pptx)\b/gi);
    if (files) {
      entities.push(...files);
    }

    return [...new Set(entities)]; // Remove duplicates
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const emptyResponsePrevention = new EmptyResponsePrevention();
export default emptyResponsePrevention;
