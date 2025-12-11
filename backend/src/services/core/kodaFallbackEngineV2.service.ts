/**
 * Koda Fallback Engine V2
 *
 * Enhanced fallback messages with context-awareness.
 * Handles V2-specific fallback types like DOC_NOT_FOUND_BY_NAME.
 */

import type {
  FallbackType as FallbackTypeV1,
  FallbackResult,
} from '../../types/ragV1.types';

import type {
  IntentClassificationV2,
  RagStatus,
  FallbackType,
  FallbackResponse,
} from '../../types/ragV2.types';

// ============================================================================
// Fallback Templates (Short & Direct)
// ============================================================================

const FALLBACK_TEMPLATES: Record<FallbackType, string> = {
  NO_DOCUMENTS: `Ainda não encontrei nenhum documento na sua conta. Clique em **Upload** para adicionar arquivos (PDF, DOCX, PPTX, etc.) e então faça uma pergunta sobre eles.`,

  NO_MATCH: `Não encontrei essa informação nos seus documentos. Tente ser mais específico ou mencionar o nome do arquivo (por exemplo: 'no arquivo *Trabalho projeto .pdf*...').`,

  NO_MATCH_SINGLE_DOC: `Não encontrei essa informação no documento especificado. Tente reformular a pergunta ou verificar se o conteúdo está realmente nesse documento.`,

  DOC_NOT_FOUND_BY_NAME: `Não encontrei um documento com esse nome. Verifique se o nome está correto ou use "Liste meus documentos" para ver os arquivos disponíveis.`,

  PROCESSING: `Seus documentos ainda estão sendo processados. Assim que a indexação terminar, você poderá fazer perguntas sobre eles.`,

  AMBIGUOUS_QUERY: `Sua pergunta está um pouco vaga. Poderia ser mais específico sobre o que você quer saber? Por exemplo, mencione o nome do documento ou seja mais detalhado.`,

  ERROR_GENERIC: `Tive um problema técnico para responder agora. Tente novamente em alguns segundos ou faça uma pergunta diferente.`,
};

// Single-document specific fallback
const NO_MATCH_SINGLE_DOC_TEMPLATE = (docTitle: string) =>
  `Não encontrei essa informação em **${docTitle}**. Tente reformular a pergunta ou verificar se o conteúdo está realmente nesse documento.`;

// Document not found by name
const DOC_NOT_FOUND_TEMPLATE = (docName: string) =>
  `Não encontrei um documento chamado **${docName}**. Verifique se o nome está correto ou use "Liste meus documentos" para ver os arquivos disponíveis.`;

// ============================================================================
// Fallback Engine Class V2
// ============================================================================

class KodaFallbackEngineV2 {
  /**
   * Get fallback message based on RAG status and V2 intent
   */
  getFallbackMessage(
    ragStatus: RagStatus,
    intent?: IntentClassificationV2,
    targetDocTitle?: string
  ): string {
    const fallbackType = this.detectFallbackType(ragStatus, intent);

    // Special case: single-document no match
    if (ragStatus === 'NO_MATCH_SINGLE_DOC' && targetDocTitle) {
      return NO_MATCH_SINGLE_DOC_TEMPLATE(targetDocTitle);
    }

    // Special case: document not found by name
    if (ragStatus === 'DOC_NOT_FOUND_BY_NAME' && targetDocTitle) {
      return DOC_NOT_FOUND_TEMPLATE(targetDocTitle);
    }

    return FALLBACK_TEMPLATES[fallbackType];
  }

  /**
   * Build complete fallback response with V2 types
   */
  buildFallbackResponse(
    ragStatus: RagStatus,
    intent?: IntentClassificationV2,
    targetDocTitle?: string
  ): FallbackResponse {
    const fallbackType = this.detectFallbackType(ragStatus, intent);
    const message = this.getFallbackMessage(ragStatus, intent, targetDocTitle);
    const suggestedAction = this.getSuggestedAction(fallbackType);

    return {
      type: fallbackType,
      message,
      suggestedAction,
    };
  }

  /**
   * Detect fallback type from RAG status
   */
  detectFallbackType(
    ragStatus: RagStatus,
    intent?: IntentClassificationV2
  ): FallbackType {
    switch (ragStatus) {
      case 'NO_DOCUMENTS':
        return 'NO_DOCUMENTS';

      case 'NO_MATCH':
        return 'NO_MATCH';

      case 'NO_MATCH_SINGLE_DOC':
        return 'NO_MATCH_SINGLE_DOC';

      case 'DOC_NOT_FOUND_BY_NAME':
        return 'DOC_NOT_FOUND_BY_NAME';

      case 'PROCESSING':
        return 'PROCESSING';

      case 'ERROR':
        return 'ERROR_GENERIC';

      default:
        return 'ERROR_GENERIC';
    }
  }

  /**
   * Get suggested action for frontend
   */
  private getSuggestedAction(fallbackType: FallbackType): string | undefined {
    switch (fallbackType) {
      case 'NO_DOCUMENTS':
        return 'highlight_upload_button';

      case 'NO_MATCH':
      case 'NO_MATCH_SINGLE_DOC':
        return 'suggest_document_search';

      case 'DOC_NOT_FOUND_BY_NAME':
        return 'show_document_list';

      case 'PROCESSING':
        return 'show_processing_status';

      case 'AMBIGUOUS_QUERY':
        return 'suggest_clarification';

      case 'ERROR_GENERIC':
        return 'show_retry_button';

      default:
        return undefined;
    }
  }

  /**
   * Check if Gemini response contains fallback marker
   */
  hasFallbackMarker(text: string): boolean {
    const markers = [
      '[FALLBACK_NO_DOCUMENTS]',
      '[FALLBACK_NO_MATCH]',
      '[FALLBACK_DOC_NOT_FOUND]',
      '[FALLBACK_PROCESSING]',
      '[FALLBACK_ERROR]',
    ];

    return markers.some(marker => text.includes(marker));
  }

  /**
   * Extract fallback type from Gemini marker
   */
  extractFallbackTypeFromMarker(text: string): FallbackType | null {
    if (text.includes('[FALLBACK_NO_DOCUMENTS]')) {
      return 'NO_DOCUMENTS';
    }
    if (text.includes('[FALLBACK_NO_MATCH]')) {
      return 'NO_MATCH';
    }
    if (text.includes('[FALLBACK_DOC_NOT_FOUND]')) {
      return 'DOC_NOT_FOUND_BY_NAME';
    }
    if (text.includes('[FALLBACK_PROCESSING]')) {
      return 'PROCESSING';
    }
    if (text.includes('[FALLBACK_ERROR]')) {
      return 'ERROR_GENERIC';
    }
    return null;
  }

  /**
   * Replace fallback marker with actual template
   */
  replaceFallbackMarker(
    text: string,
    fallbackType: FallbackType,
    targetDocTitle?: string
  ): string {
    const markers = [
      '[FALLBACK_NO_DOCUMENTS]',
      '[FALLBACK_NO_MATCH]',
      '[FALLBACK_DOC_NOT_FOUND]',
      '[FALLBACK_PROCESSING]',
      '[FALLBACK_ERROR]',
    ];

    let result = text;

    // Remove all markers
    markers.forEach(marker => {
      result = result.replace(marker, '');
    });

    // Get template
    let template: string;
    if (fallbackType === 'NO_MATCH_SINGLE_DOC' && targetDocTitle) {
      template = NO_MATCH_SINGLE_DOC_TEMPLATE(targetDocTitle);
    } else if (fallbackType === 'DOC_NOT_FOUND_BY_NAME' && targetDocTitle) {
      template = DOC_NOT_FOUND_TEMPLATE(targetDocTitle);
    } else {
      template = FALLBACK_TEMPLATES[fallbackType];
    }

    // If text is now empty or just whitespace, return template
    if (!result.trim()) {
      return template;
    }

    // Otherwise append template
    return `${result.trim()}\n\n${template}`;
  }

  /**
   * Check if we should skip Gemini and go straight to fallback
   */
  shouldSkipGemini(ragStatus: RagStatus): boolean {
    return [
      'NO_DOCUMENTS',
      'NO_MATCH',
      'NO_MATCH_SINGLE_DOC',
      'DOC_NOT_FOUND_BY_NAME',
      'PROCESSING',
    ].includes(ragStatus);
  }

  /**
   * Build fallback instruction for Gemini prompt
   */
  buildFallbackInstruction(ragStatus: RagStatus): string {
    switch (ragStatus) {
      case 'NO_DOCUMENTS':
        return 'There are no documents in the user\'s account. Return only: [FALLBACK_NO_DOCUMENTS]';

      case 'NO_MATCH':
      case 'NO_MATCH_SINGLE_DOC':
        return 'No relevant information was found in the documents. Return only: [FALLBACK_NO_MATCH]';

      case 'DOC_NOT_FOUND_BY_NAME':
        return 'The document specified by name was not found. Return only: [FALLBACK_DOC_NOT_FOUND]';

      case 'PROCESSING':
        return 'Documents are still being processed. Return only: [FALLBACK_PROCESSING]';

      default:
        return '';
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const kodaFallbackEngineV2 = new KodaFallbackEngineV2();
export default kodaFallbackEngineV2;
