/**
 * Koda Fallback Engine V1
 *
 * Generates short, consistent fallback messages for:
 * - NO_DOCUMENTS: User has no documents
 * - NO_MATCH: No relevant content found
 * - PROCESSING: Documents still indexing
 * - ERROR_GENERIC: Technical error
 *
 * Theme 4 from notes: Short templates, no long explanations
 */

import type {
  FallbackType,
  FallbackResult,
  RagStatus,
  IntentClassification,
} from '../../types/ragV1.types';

// ============================================================================
// Fallback Templates (Short & Direct)
// ============================================================================

const FALLBACK_TEMPLATES: Record<FallbackType, string> = {
  NO_DOCUMENTS: `Ainda não encontrei nenhum documento na sua conta. Clique em **Upload** para adicionar arquivos (PDF, DOCX, PPTX, etc.) e então faça uma pergunta sobre eles.`,

  NO_MATCH: `Não encontrei essa informação nos seus documentos. Tente ser mais específico ou mencionar o nome do arquivo (por exemplo: 'no arquivo *Trabalho projeto .pdf*...').`,

  PROCESSING: `Seus documentos ainda estão sendo processados. Assim que a indexação terminar, você poderá fazer perguntas sobre eles.`,

  ERROR_GENERIC: `Tive um problema técnico para responder agora. Tente novamente em alguns segundos ou faça uma pergunta diferente.`,
};

// Single-document specific fallback
const NO_MATCH_SINGLE_DOC_TEMPLATE = (docTitle: string) =>
  `Não encontrei essa informação em **${docTitle}**. Tente reformular a pergunta ou verificar se o conteúdo está realmente nesse documento.`;

// ============================================================================
// Fallback Engine Class
// ============================================================================

class KodaFallbackEngineV1 {
  /**
   * Get fallback message based on RAG status
   */
  getFallbackMessage(
    ragStatus: RagStatus,
    intent?: IntentClassification,
    targetDocTitle?: string
  ): string {
    const fallbackType = this.detectFallbackType(ragStatus, intent);

    // Special case: single-document no match
    if (ragStatus === 'NO_MATCH_SINGLE_DOC' && targetDocTitle) {
      return NO_MATCH_SINGLE_DOC_TEMPLATE(targetDocTitle);
    }

    return FALLBACK_TEMPLATES[fallbackType];
  }

  /**
   * Build complete fallback response
   */
  buildFallbackResponse(
    ragStatus: RagStatus,
    intent?: IntentClassification,
    targetDocTitle?: string
  ): FallbackResult {
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
    intent?: IntentClassification
  ): FallbackType {
    switch (ragStatus) {
      case 'NO_DOCUMENTS':
        return 'NO_DOCUMENTS';

      case 'NO_MATCH':
      case 'NO_MATCH_SINGLE_DOC':
        return 'NO_MATCH';

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
        return 'suggest_document_search';

      case 'PROCESSING':
        return 'show_processing_status';

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
      '[FALLBACK_PROCESSING]',
      '[FALLBACK_ERROR]',
    ];

    let result = text;

    // Remove all markers
    markers.forEach(marker => {
      result = result.replace(marker, '');
    });

    // Get template
    const template = fallbackType === 'NO_MATCH' && targetDocTitle
      ? NO_MATCH_SINGLE_DOC_TEMPLATE(targetDocTitle)
      : FALLBACK_TEMPLATES[fallbackType];

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

export const kodaFallbackEngineV1 = new KodaFallbackEngineV1();
export default kodaFallbackEngineV1;
