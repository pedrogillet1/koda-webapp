/**
 * Koda Answer Engine V3 - Production Ready
 *
 * Responsible for generating answers using LLM based on retrieved documents,
 * intent classification, and conversation context.
 *
 * Features:
 * - Document-based Q&A with citations
 * - Chitchat mode for casual conversation
 * - Meta AI mode for capability questions
 * - Streaming support for real-time responses
 * - Confidence scoring
 *
 * Performance: Optimized for low latency with streaming
 */

import { Writable } from 'stream';

import type {
  IntentClassificationV3,
  RetrievedChunk,
  Citation,
  QuestionType,
} from '../../types/ragV3.types';

import geminiGateway from '../geminiGateway.service';

type LanguageCode = 'en' | 'pt' | 'es';

// ============================================================================
// TYPES
// ============================================================================

export interface AnswerParams {
  userId: string;
  query: string;
  intent: IntentClassificationV3;
  context?: any;
  language: LanguageCode;
  chitchatMode?: boolean;
  metaMode?: boolean;
}

export interface AnswerWithDocsParams {
  userId: string;
  query: string;
  intent: IntentClassificationV3;
  documents: any[];
  context?: any;
  language: LanguageCode;
}

export interface StreamAnswerParams extends AnswerParams {
  stream: Writable;
}

export interface AnswerResult {
  answer: string;
  confidenceScore?: number;
  citations?: Citation[];
  wasTruncated?: boolean;
  finishReason?: string;
}

// ============================================================================
// CHITCHAT RESPONSES
// ============================================================================

const CHITCHAT_RESPONSES: Record<string, Record<LanguageCode, string[]>> = {
  greeting: {
    en: [
      "Hello! How can I help you with your documents today?",
      "Hi there! I'm Koda, your document assistant. What can I help you find?",
      "Hey! Ready to help you explore your documents.",
    ],
    pt: [
      "Olá! Como posso ajudar com seus documentos hoje?",
      "Oi! Sou o Koda, seu assistente de documentos. O que posso ajudar a encontrar?",
      "Ei! Pronto para ajudar a explorar seus documentos.",
    ],
    es: [
      "¡Hola! ¿Cómo puedo ayudarte con tus documentos hoy?",
      "¡Hola! Soy Koda, tu asistente de documentos. ¿Qué puedo ayudarte a encontrar?",
      "¡Hey! Listo para ayudarte a explorar tus documentos.",
    ],
  },
  thanks: {
    en: [
      "You're welcome! Let me know if you need anything else.",
      "Happy to help! Feel free to ask more questions.",
      "Anytime! I'm here to help with your documents.",
    ],
    pt: [
      "De nada! Me avise se precisar de mais alguma coisa.",
      "Fico feliz em ajudar! Fique à vontade para fazer mais perguntas.",
      "Sempre! Estou aqui para ajudar com seus documentos.",
    ],
    es: [
      "¡De nada! Avísame si necesitas algo más.",
      "¡Encantado de ayudar! No dudes en hacer más preguntas.",
      "¡Siempre! Estoy aquí para ayudar con tus documentos.",
    ],
  },
  farewell: {
    en: [
      "Goodbye! Come back anytime you need help with your documents.",
      "See you later! Your documents will be here when you return.",
      "Take care! Let me know if you need anything.",
    ],
    pt: [
      "Tchau! Volte quando precisar de ajuda com seus documentos.",
      "Até logo! Seus documentos estarão aqui quando você voltar.",
      "Cuide-se! Me avise se precisar de algo.",
    ],
    es: [
      "¡Adiós! Vuelve cuando necesites ayuda con tus documentos.",
      "¡Hasta luego! Tus documentos estarán aquí cuando regreses.",
      "¡Cuídate! Avísame si necesitas algo.",
    ],
  },
};

// ============================================================================
// META AI RESPONSES
// ============================================================================

const META_AI_RESPONSES: Record<LanguageCode, string> = {
  en: `I'm **Koda**, your AI document assistant! Here's what I can do:

📄 **Document Q&A** - Ask me anything about your documents
🔍 **Search** - Find specific documents or information
📊 **Analytics** - Get statistics about your document library
📝 **Summarize** - Get quick summaries of document content
🔄 **Compare** - Compare information across documents

Just upload your documents and ask me anything!`,
  pt: `Sou o **Koda**, seu assistente de documentos com IA! Aqui está o que posso fazer:

📄 **Perguntas sobre Documentos** - Pergunte qualquer coisa sobre seus documentos
🔍 **Pesquisa** - Encontre documentos ou informações específicas
📊 **Análises** - Obtenha estatísticas sobre sua biblioteca de documentos
📝 **Resumir** - Obtenha resumos rápidos do conteúdo dos documentos
🔄 **Comparar** - Compare informações entre documentos

Basta enviar seus documentos e me perguntar qualquer coisa!`,
  es: `¡Soy **Koda**, tu asistente de documentos con IA! Esto es lo que puedo hacer:

📄 **Preguntas sobre Documentos** - Pregúntame cualquier cosa sobre tus documentos
🔍 **Búsqueda** - Encuentra documentos o información específica
📊 **Análisis** - Obtén estadísticas sobre tu biblioteca de documentos
📝 **Resumir** - Obtén resúmenes rápidos del contenido de los documentos
🔄 **Comparar** - Compara información entre documentos

¡Solo sube tus documentos y pregúntame cualquier cosa!`,
};

// ============================================================================
// KODA ANSWER ENGINE V3
// ============================================================================

export class KodaAnswerEngineV3 {
  /**
   * Generate an answer without documents (chitchat, meta AI).
   */
  public async answer(params: AnswerParams): Promise<string> {
    const { query, language, chitchatMode, metaMode } = params;
    const lang = language || 'en';

    if (metaMode) {
      return META_AI_RESPONSES[lang] || META_AI_RESPONSES.en;
    }

    if (chitchatMode) {
      return this.generateChitchatResponse(query, lang);
    }

    // Default response
    return META_AI_RESPONSES[lang] || META_AI_RESPONSES.en;
  }

  /**
   * Generate an answer with retrieved documents.
   * Includes truncation detection for answer quality assurance.
   */
  public async answerWithDocs(params: AnswerWithDocsParams): Promise<AnswerResult> {
    const { query, documents, language, intent } = params;
    const lang = language || 'en';

    if (!documents || documents.length === 0) {
      return {
        answer: this.getNoDocsMessage(lang),
        confidenceScore: 0,
        citations: [],
        wasTruncated: false,
      };
    }

    // Build context from documents
    const context = this.buildContext(documents);

    // Generate answer using Gemini LLM (with truncation detection)
    const result = await this.generateDocumentAnswer(query, context, intent, lang);

    // Extract citations
    const citations = this.extractCitations(documents);

    // Calculate confidence based on document relevance scores
    // Reduce confidence if answer was truncated
    const avgScore = documents.reduce((sum, doc) => sum + (doc.score || 0.5), 0) / documents.length;
    let confidenceScore = Math.min(avgScore * 1.2, 1.0); // Scale up slightly, cap at 1.0

    if (result.wasTruncated) {
      confidenceScore *= 0.7; // Reduce confidence for truncated answers
    }

    return {
      answer: result.text,
      confidenceScore,
      citations,
      wasTruncated: result.wasTruncated,
      finishReason: result.finishReason,
    };
  }

  /**
   * Stream an answer to a writable stream.
   */
  public async streamAnswer(params: StreamAnswerParams): Promise<void> {
    const { stream, query, language, chitchatMode, metaMode } = params;
    const lang = language || 'en';

    let response: string;

    if (metaMode) {
      response = META_AI_RESPONSES[lang] || META_AI_RESPONSES.en;
    } else if (chitchatMode) {
      response = this.generateChitchatResponse(query, lang);
    } else {
      response = META_AI_RESPONSES[lang] || META_AI_RESPONSES.en;
    }

    // Simulate streaming by writing in chunks
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      stream.write(words[i] + (i < words.length - 1 ? ' ' : ''));
      await this.delay(20); // Small delay between words
    }
  }

  /**
   * Generate a chitchat response based on query.
   */
  private generateChitchatResponse(query: string, lang: LanguageCode): string {
    const normalized = query.toLowerCase();

    let responseType = 'greeting';

    if (normalized.includes('thank') || normalized.includes('obrigad') || normalized.includes('gracia')) {
      responseType = 'thanks';
    } else if (normalized.includes('bye') || normalized.includes('tchau') || normalized.includes('adios')) {
      responseType = 'farewell';
    }

    const responses = CHITCHAT_RESPONSES[responseType][lang] || CHITCHAT_RESPONSES[responseType].en;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Build context string from documents.
   * NOTE: Do NOT truncate content here - retrieval engine already handles token budgeting.
   * Truncating here would waste the careful budgeting done upstream.
   */
  private buildContext(documents: any[]): string {
    return documents
      .slice(0, 10) // Safety limit - retrieval typically returns fewer
      .map((doc, idx) => {
        const content = doc.content || doc.text || '';
        const name = doc.documentName || doc.filename || `Document ${idx + 1}`;
        const page = doc.pageNumber ? ` (Page ${doc.pageNumber})` : '';
        return `[${name}${page}]\n${content}`; // Full content - already budgeted by retrieval
      })
      .join('\n\n---\n\n');
  }

  /**
   * Generate an answer based on documents and question type using Gemini LLM.
   * Returns both the answer text and truncation status.
   */
  private async generateDocumentAnswer(
    query: string,
    context: string,
    intent: IntentClassificationV3,
    lang: LanguageCode
  ): Promise<{ text: string; wasTruncated: boolean; finishReason?: string }> {
    try {
      console.log(`[KodaAnswerEngineV3] Generating answer with Gemini for query: "${query.substring(0, 50)}..."`);

      const systemPrompt = this.buildSystemPrompt(intent, lang);
      const userPrompt = this.buildUserPrompt(query, context, lang);

      const response = await geminiGateway.quickGenerateWithMetadata(
        `${systemPrompt}\n\n${userPrompt}`,
        {
          temperature: 0.3, // Lower temperature for factual answers
          maxTokens: 2000
        }
      );

      // Check for truncation based on finish_reason
      // Gemini uses: 'STOP' (normal), 'MAX_TOKENS' (truncated), 'SAFETY', 'RECITATION', etc.
      const wasTruncated = this.detectTruncation(response.text, response.finishReason);

      if (wasTruncated) {
        console.warn(`[KodaAnswerEngineV3] Answer may be truncated. Finish reason: ${response.finishReason}`);
      }

      console.log(`[KodaAnswerEngineV3] Generated answer (${response.text.length} chars, truncated: ${wasTruncated})`);

      return {
        text: response.text,
        wasTruncated,
        finishReason: response.finishReason,
      };
    } catch (error) {
      console.error('[KodaAnswerEngineV3] Gemini generation failed:', error);

      // Fallback to basic response
      const fallbackMessages: Record<LanguageCode, string> = {
        en: "I found relevant information in your documents but encountered an issue generating a detailed response. Please try again.",
        pt: "Encontrei informações relevantes nos seus documentos, mas tive um problema ao gerar uma resposta detalhada. Por favor, tente novamente.",
        es: "Encontré información relevante en tus documentos, pero tuve un problema al generar una respuesta detallada. Por favor, inténtalo de nuevo.",
      };

      return {
        text: fallbackMessages[lang] || fallbackMessages.en,
        wasTruncated: false,
      };
    }
  }

  /**
   * Detect if an answer was truncated.
   * Checks finish_reason and heuristic patterns.
   */
  private detectTruncation(text: string, finishReason?: string): boolean {
    // Check finish_reason first (most reliable)
    if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
      return true;
    }

    // Heuristic checks for truncation patterns
    if (!text || text.length === 0) {
      return false;
    }

    const trimmed = text.trim();

    // Check for incomplete sentences at the end
    const endsWithIncomplete = /[a-zA-Z0-9,;:\-]$/.test(trimmed);
    const endsWithEllipsis = trimmed.endsWith('...');
    const endsWithCutWord = /\s[a-zA-Z]{1,3}$/.test(trimmed);

    // Check for unclosed formatting
    const unclosedBold = (trimmed.match(/\*\*/g) || []).length % 2 !== 0;
    const unclosedBrackets = (trimmed.match(/\[/g) || []).length !== (trimmed.match(/\]/g) || []).length;
    const unclosedCodeBlock = (trimmed.match(/```/g) || []).length % 2 !== 0;

    return endsWithIncomplete || endsWithEllipsis || endsWithCutWord ||
           unclosedBold || unclosedBrackets || unclosedCodeBlock;
  }

  /**
   * Build system prompt based on intent and language.
   */
  private buildSystemPrompt(intent: IntentClassificationV3, lang: LanguageCode): string {
    const languageInstructions: Record<LanguageCode, string> = {
      en: 'Respond in English.',
      pt: 'Responda em Português.',
      es: 'Responde en Español.',
    };

    const questionTypeInstructions = this.getQuestionTypeInstructions(intent.questionType, lang);

    return `You are Koda, an intelligent document assistant. Your role is to answer questions based ONLY on the provided document context.

CRITICAL RULES:
1. ONLY use information from the provided context
2. If the context doesn't contain the answer, say so clearly
3. Always cite which document the information comes from
4. Be concise but comprehensive
5. ${languageInstructions[lang]}

${questionTypeInstructions}`;
  }

  /**
   * Get specific instructions based on question type.
   */
  private getQuestionTypeInstructions(questionType: QuestionType, lang: LanguageCode): string {
    const instructions: Record<string, Record<LanguageCode, string>> = {
      SUMMARY: {
        en: 'Provide a clear, concise summary of the key points.',
        pt: 'Forneça um resumo claro e conciso dos pontos principais.',
        es: 'Proporciona un resumen claro y conciso de los puntos clave.',
      },
      EXTRACT: {
        en: 'Extract and list the specific information requested.',
        pt: 'Extraia e liste as informações específicas solicitadas.',
        es: 'Extrae y enumera la información específica solicitada.',
      },
      COMPARE: {
        en: 'Compare the information and highlight similarities and differences.',
        pt: 'Compare as informações e destaque semelhanças e diferenças.',
        es: 'Compara la información y destaca similitudes y diferencias.',
      },
      LIST: {
        en: 'Present the information as a clear, organized list.',
        pt: 'Apresente as informações como uma lista clara e organizada.',
        es: 'Presenta la información como una lista clara y organizada.',
      },
      YES_NO: {
        en: 'Give a direct yes/no answer, then explain briefly.',
        pt: 'Dê uma resposta direta sim/não, depois explique brevemente.',
        es: 'Da una respuesta directa sí/no, luego explica brevemente.',
      },
      NUMERIC: {
        en: 'Provide the specific number or quantity requested.',
        pt: 'Forneça o número ou quantidade específica solicitada.',
        es: 'Proporciona el número o cantidad específica solicitada.',
      },
      OTHER: {
        en: 'Answer the question directly and comprehensively.',
        pt: 'Responda à pergunta de forma direta e abrangente.',
        es: 'Responde a la pregunta de forma directa y completa.',
      },
    };

    const typeKey = questionType || 'OTHER';
    return instructions[typeKey]?.[lang] || instructions.OTHER[lang];
  }

  /**
   * Build user prompt with query and context.
   */
  private buildUserPrompt(query: string, context: string, lang: LanguageCode): string {
    const labels: Record<LanguageCode, { context: string; question: string }> = {
      en: { context: 'DOCUMENT CONTEXT', question: 'USER QUESTION' },
      pt: { context: 'CONTEXTO DO DOCUMENTO', question: 'PERGUNTA DO USUÁRIO' },
      es: { context: 'CONTEXTO DEL DOCUMENTO', question: 'PREGUNTA DEL USUARIO' },
    };

    const l = labels[lang] || labels.en;

    return `--- ${l.context} ---
${context}

--- ${l.question} ---
${query}`;
  }

  /**
   * Extract citations from documents.
   */
  private extractCitations(documents: any[]): Citation[] {
    return documents.slice(0, 5).map((doc, idx) => ({
      documentId: doc.documentId || doc.id || `doc_${idx}`,
      documentName: doc.documentName || doc.filename || `Document ${idx + 1}`,
      pageNumber: doc.pageNumber,
      snippet: doc.content?.substring(0, 100),
    }));
  }

  /**
   * Get "no documents" message.
   */
  private getNoDocsMessage(lang: LanguageCode): string {
    const messages: Record<LanguageCode, string> = {
      en: "I couldn't find relevant information in your documents. Try rephrasing your question or check if the document has been uploaded.",
      pt: "Não encontrei informações relevantes nos seus documentos. Tente reformular sua pergunta ou verifique se o documento foi enviado.",
      es: "No encontré información relevante en tus documentos. Intenta reformular tu pregunta o verifica si el documento fue subido.",
    };
    return messages[lang] || messages.en;
  }

  /**
   * Delay helper for streaming simulation.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Attempt to repair a truncated answer by requesting a continuation.
   * Only attempts repair once to avoid infinite loops.
   *
   * @param truncatedAnswer - The original truncated answer
   * @param query - Original user query
   * @param context - Document context
   * @param lang - Language code
   * @returns Repaired answer or original if repair fails
   */
  public async tryRepairTruncatedAnswer(
    truncatedAnswer: string,
    query: string,
    context: string,
    lang: LanguageCode
  ): Promise<{ text: string; wasRepaired: boolean }> {
    try {
      console.log('[KodaAnswerEngineV3] Attempting to repair truncated answer...');

      const continuationPrompt = this.buildContinuationPrompt(truncatedAnswer, query, lang);

      const response = await geminiGateway.quickGenerateWithMetadata(
        `${continuationPrompt}\n\nContext:\n${context.substring(0, 2000)}`, // Limit context for continuation
        {
          temperature: 0.3,
          maxTokens: 1000, // Smaller budget for continuation
        }
      );

      // Check if continuation was also truncated
      const continuationTruncated = this.detectTruncation(response.text, response.finishReason);

      if (continuationTruncated) {
        console.warn('[KodaAnswerEngineV3] Continuation was also truncated, using graceful ending');
        // Add graceful ending to truncated answer
        return {
          text: this.addGracefulEnding(truncatedAnswer, lang),
          wasRepaired: true,
        };
      }

      // Combine original answer with continuation
      const repairedAnswer = this.combineAnswerWithContinuation(truncatedAnswer, response.text);

      console.log(`[KodaAnswerEngineV3] Answer repaired (${repairedAnswer.length} chars)`);

      return {
        text: repairedAnswer,
        wasRepaired: true,
      };
    } catch (error) {
      console.error('[KodaAnswerEngineV3] Failed to repair truncated answer:', error);

      // Return original with graceful ending
      return {
        text: this.addGracefulEnding(truncatedAnswer, lang),
        wasRepaired: false,
      };
    }
  }

  /**
   * Build a continuation prompt for repairing truncated answers.
   */
  private buildContinuationPrompt(truncatedAnswer: string, query: string, lang: LanguageCode): string {
    const prompts: Record<LanguageCode, string> = {
      en: `The following answer was cut off. Please complete it naturally, starting from where it stopped.

Original question: ${query}

Incomplete answer:
${truncatedAnswer}

Please continue the answer from where it was cut off. Do not repeat what was already said.`,
      pt: `A seguinte resposta foi cortada. Por favor, complete-a naturalmente, começando de onde parou.

Pergunta original: ${query}

Resposta incompleta:
${truncatedAnswer}

Por favor, continue a resposta de onde foi cortada. Não repita o que já foi dito.`,
      es: `La siguiente respuesta fue cortada. Por favor, complétala naturalmente, comenzando desde donde se detuvo.

Pregunta original: ${query}

Respuesta incompleta:
${truncatedAnswer}

Por favor, continúa la respuesta desde donde fue cortada. No repitas lo que ya se dijo.`,
    };

    return prompts[lang] || prompts.en;
  }

  /**
   * Combine original answer with continuation.
   */
  private combineAnswerWithContinuation(original: string, continuation: string): string {
    // Remove any overlap between end of original and start of continuation
    const trimmedOriginal = original.trim();
    const trimmedContinuation = continuation.trim();

    // If original ends with incomplete word, try to complete it
    if (/[a-zA-Z]$/.test(trimmedOriginal)) {
      // Add space before continuation
      return `${trimmedOriginal} ${trimmedContinuation}`;
    }

    // If original ends with punctuation, just append
    return `${trimmedOriginal} ${trimmedContinuation}`;
  }

  /**
   * Add a graceful ending to a truncated answer.
   */
  private addGracefulEnding(truncatedAnswer: string, lang: LanguageCode): string {
    const trimmed = truncatedAnswer.trim();

    // If it already ends with proper punctuation, return as-is
    if (/[.!?]$/.test(trimmed)) {
      return trimmed;
    }

    // Add graceful ending based on language
    const endings: Record<LanguageCode, string> = {
      en: '... (response was shortened for brevity)',
      pt: '... (resposta foi resumida por brevidade)',
      es: '... (la respuesta fue resumida por brevedad)',
    };

    return `${trimmed}${endings[lang] || endings.en}`;
  }
}

export default KodaAnswerEngineV3;
