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
   */
  public async answerWithDocs(params: AnswerWithDocsParams): Promise<AnswerResult> {
    const { query, documents, language, intent } = params;
    const lang = language || 'en';

    if (!documents || documents.length === 0) {
      return {
        answer: this.getNoDocsMessage(lang),
        confidenceScore: 0,
        citations: [],
      };
    }

    // Build context from documents
    const context = this.buildContext(documents);

    // Generate answer using Gemini LLM
    const answer = await this.generateDocumentAnswer(query, context, intent, lang);

    // Extract citations
    const citations = this.extractCitations(documents);

    // Calculate confidence based on document relevance scores
    const avgScore = documents.reduce((sum, doc) => sum + (doc.score || 0.5), 0) / documents.length;
    const confidenceScore = Math.min(avgScore * 1.2, 1.0); // Scale up slightly, cap at 1.0

    return {
      answer,
      confidenceScore,
      citations,
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
   */
  private buildContext(documents: any[]): string {
    return documents
      .slice(0, 5) // Limit to top 5 documents
      .map((doc, idx) => {
        const content = doc.content || doc.text || '';
        const name = doc.documentName || doc.filename || `Document ${idx + 1}`;
        return `[${name}]\n${content.substring(0, 1000)}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Generate an answer based on documents and question type using Gemini LLM.
   */
  private async generateDocumentAnswer(
    query: string,
    context: string,
    intent: IntentClassificationV3,
    lang: LanguageCode
  ): Promise<string> {
    try {
      console.log(`[KodaAnswerEngineV3] Generating answer with Gemini for query: "${query.substring(0, 50)}..."`);

      const systemPrompt = this.buildSystemPrompt(intent, lang);
      const userPrompt = this.buildUserPrompt(query, context, lang);

      const answer = await geminiGateway.quickGenerate(
        `${systemPrompt}\n\n${userPrompt}`,
        {
          temperature: 0.3, // Lower temperature for factual answers
          maxTokens: 2000
          
        }
      );

      console.log(`[KodaAnswerEngineV3] Generated answer (${answer.length} chars)`);

      return answer;
    } catch (error) {
      console.error('[KodaAnswerEngineV3] Gemini generation failed:', error);

      // Fallback to basic response
      const fallbackMessages: Record<LanguageCode, string> = {
        en: "I found relevant information in your documents but encountered an issue generating a detailed response. Please try again.",
        pt: "Encontrei informações relevantes nos seus documentos, mas tive um problema ao gerar uma resposta detalhada. Por favor, tente novamente.",
        es: "Encontré información relevante en tus documentos, pero tuve un problema al generar una respuesta detallada. Por favor, inténtalo de nuevo.",
      };

      return fallbackMessages[lang] || fallbackMessages.en;
    }
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
}

export default KodaAnswerEngineV3;
