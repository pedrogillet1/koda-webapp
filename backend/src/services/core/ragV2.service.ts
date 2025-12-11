/**
 * RAG V2 Service
 *
 * Main entry point for RAG queries. Orchestrates:
 * - Intent classification
 * - Document retrieval (Pinecone)
 * - Answer generation (Gemini)
 * - Citation formatting
 */

import type {
  AnswerRequest,
  AnswerResponse,
  Citation,
  RetrievedChunk,
  RagStatus,
} from '../../types/ragV2.types';

import { kodaRetrievalEngineV1 } from '../retrieval/kodaRetrievalEngineV1.service';
import geminiGateway from '../geminiGateway.service';
import prisma from '../../config/database';

// ============================================================================
// RAG Service Class
// ============================================================================

class RagServiceV2 {
  /**
   * Main entry point for all RAG queries
   */
  async handleQuery(request: AnswerRequest): Promise<AnswerResponse> {
    const startTime = Date.now();

    try {
      // Check if user has documents
      const docsCount = await this.getUserDocumentCount(request.userId);

      if (docsCount === 0) {
        return this.buildGenericResponse(request.query, startTime, 'NO_DOCUMENTS');
      }

      // Perform retrieval
      const chunks = await this.retrieveChunks(request);

      if (chunks.length === 0) {
        return this.buildGenericResponse(request.query, startTime, 'NO_MATCH');
      }

      // Generate answer with citations
      const response = await this.generateAnswer(request, chunks, startTime);

      return response;

    } catch (error) {
      console.error('[RagServiceV2] Error handling query:', error);
      return this.buildGenericResponse(request.query, startTime, 'ERROR');
    }
  }

  /**
   * Retrieve relevant chunks from Pinecone
   */
  private async retrieveChunks(request: AnswerRequest): Promise<RetrievedChunk[]> {
    try {
      // Build simple intent for retrieval
      const intent = {
        domain: 'doc_content' as const,
        questionType: 'simple_factual' as const,
        scope: request.attachedDocumentIds?.length === 1
          ? 'single_document' as const
          : 'all_documents' as const,
        targetDocId: request.attachedDocumentIds?.[0],
        requiresRAG: true,
      };

      // Use retrieval engine
      const result = await kodaRetrievalEngineV1.retrieve(
        request.query,
        request.userId,
        intent
      );

      if (result.status !== 'SUCCESS') {
        return [];
      }

      // Convert to our format
      return result.context.chunks.map((chunk: any) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        content: chunk.content,
        score: chunk.score,
        metadata: chunk.metadata || {},
      }));

    } catch (error) {
      console.error('[RagServiceV2] Retrieval error:', error);
      return [];
    }
  }

  /**
   * Generate answer using Gemini with context
   */
  private async generateAnswer(
    request: AnswerRequest,
    chunks: RetrievedChunk[],
    startTime: number
  ): Promise<AnswerResponse> {
    try {
      // Get document metadata for citations
      const docIds = [...new Set(chunks.map(c => c.documentId))];
      const documents = await this.getDocuments(docIds);

      // Build context string
      const context = this.buildContextString(chunks, documents);

      // Build prompt
      const prompt = this.buildPrompt(request.query, context, request.answerLength);

      // Generate answer using Gemini
      const response = await geminiGateway.generateContent({
        prompt,
        systemInstruction: this.getSystemInstruction(),
        model: 'gemini-2.5-flash',
        config: {
          temperature: 0.3,
          maxOutputTokens: this.getMaxTokens(request.answerLength),
        },
      });

      // Build citations
      const citations = this.buildCitations(chunks, documents);

      return {
        text: response.text,
        answerType: 'rag',
        citations,
        metadata: {
          ragStatus: 'SUCCESS',
          totalTimeMs: Date.now() - startTime,
          tokensUsed: response.totalTokens,
          model: response.model,
          retrievedChunks: chunks.length,
        },
      };

    } catch (error) {
      console.error('[RagServiceV2] Generation error:', error);
      return this.buildGenericResponse(request.query, startTime, 'ERROR');
    }
  }

  /**
   * Build generic response for non-RAG queries
   */
  private async buildGenericResponse(
    query: string,
    startTime: number,
    status: RagStatus
  ): Promise<AnswerResponse> {
    let text: string;

    switch (status) {
      case 'NO_DOCUMENTS':
        text = 'Nenhum documento encontrado. Faça o upload de documentos para que eu possa ajudá-lo com perguntas sobre eles.';
        break;
      case 'NO_MATCH':
        text = 'Não encontrei informações relevantes nos seus documentos para responder essa pergunta. Tente reformular ou fazer uma pergunta diferente.';
        break;
      case 'ERROR':
      default:
        text = 'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.';
        break;
    }

    return {
      text,
      answerType: 'no_documents',
      citations: [],
      metadata: {
        ragStatus: status,
        totalTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Build context string from chunks
   */
  private buildContextString(
    chunks: RetrievedChunk[],
    documents: Map<string, any>
  ): string {
    const contextParts: string[] = [];

    for (const chunk of chunks) {
      const doc = documents.get(chunk.documentId);
      const docName = doc?.displayTitle || doc?.filename || 'Documento';
      const location = chunk.metadata?.page ? `Página ${chunk.metadata.page}` : '';

      contextParts.push(
        `[${docName}${location ? ` - ${location}` : ''}]\n${chunk.content}`
      );
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Build the prompt for Gemini
   */
  private buildPrompt(query: string, context: string, answerLength?: string): string {
    const lengthInstruction = answerLength === 'short'
      ? 'Responda de forma concisa em 2-3 frases.'
      : answerLength === 'long'
        ? 'Forneça uma resposta detalhada e completa.'
        : 'Forneça uma resposta clara e direta.';

    return `Baseado nos seguintes documentos, responda a pergunta do usuário.

CONTEXTO DOS DOCUMENTOS:
${context}

PERGUNTA DO USUÁRIO:
${query}

INSTRUÇÕES:
- ${lengthInstruction}
- Cite os documentos relevantes quando apropriado.
- Se a informação não estiver nos documentos, diga isso claramente.
- Responda no mesmo idioma da pergunta.`;
  }

  /**
   * Get system instruction for Gemini
   */
  private getSystemInstruction(): string {
    return `Você é Koda, um assistente de IA especializado em analisar documentos.
Suas respostas são baseadas nos documentos fornecidos pelo usuário.
Seja preciso, cite fontes quando relevante, e admita quando não sabe algo.
Responda sempre no idioma do usuário.`;
  }

  /**
   * Get max tokens based on answer length
   */
  private getMaxTokens(answerLength?: string): number {
    switch (answerLength) {
      case 'short': return 500;
      case 'long': return 2000;
      default: return 1000;
    }
  }

  /**
   * Build citations from chunks
   */
  private buildCitations(
    chunks: RetrievedChunk[],
    documents: Map<string, any>
  ): Citation[] {
    const citationMap = new Map<string, Citation>();

    for (const chunk of chunks) {
      const docId = chunk.documentId;
      const doc = documents.get(docId);

      if (!doc) continue;

      if (citationMap.has(docId)) {
        const existing = citationMap.get(docId)!;
        existing.occurrences++;
      } else {
        citationMap.set(docId, {
          id: String(citationMap.size + 1),
          documentId: docId,
          title: doc.displayTitle || doc.filename,
          filename: doc.filename,
          location: chunk.metadata?.page ? `Página ${chunk.metadata.page}` : undefined,
          type: 'list',
          occurrences: 1,
        });
      }
    }

    return Array.from(citationMap.values());
  }

  /**
   * Get user's document count
   */
  private async getUserDocumentCount(userId: string): Promise<number> {
    try {
      return await prisma.document.count({
        where: {
          userId,
          status: 'completed',
          embeddingsGenerated: true,
        },
      });
    } catch (error) {
      console.error('[RagServiceV2] Error counting documents:', error);
      return 0;
    }
  }

  /**
   * Get documents by IDs
   */
  private async getDocuments(docIds: string[]): Promise<Map<string, any>> {
    try {
      const docs = await prisma.document.findMany({
        where: { id: { in: docIds } },
        select: {
          id: true,
          filename: true,
          displayTitle: true,
          mimeType: true,
        },
      });

      return new Map(docs.map(d => [d.id, d]));
    } catch (error) {
      console.error('[RagServiceV2] Error fetching documents:', error);
      return new Map();
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const ragServiceV2 = new RagServiceV2();
export default ragServiceV2;
