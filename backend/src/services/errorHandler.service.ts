/**
 * Error Handler Service - Phase 1 Week 2
 * Categorizes errors and provides helpful, actionable error messages
 * Ensures users are never stuck - always shows next steps
 *
 * UPDATED: Now uses ErrorMessagesService for varied, natural responses
 * to avoid robotic repetition
 */

import ErrorMessagesService from './errorMessages.service';

export type ErrorCategory =
  | 'no_documents'
  | 'no_relevant_documents'
  | 'retrieval_failed'
  | 'llm_failed'
  | 'rate_limited'
  | 'auth_failed'
  | 'unknown';

export interface ErrorResponse {
  category: ErrorCategory;
  userMessage: string;
  technicalDetails?: string;
  suggestions: string[];
  canRetry: boolean;
}

class ErrorHandlerService {
  /**
   * Categorize and handle errors gracefully
   */
  handleError(error: Error | any, context?: string): ErrorResponse {
    console.error(`❌ Error in ${context || 'unknown context'}:`, error);

    // Categorize the error
    const category = this.categorizeError(error);

    // Generate user-friendly response
    return this.generateErrorResponse(category, error);
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: Error | any): ErrorCategory {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || '';

    // No documents uploaded
    if (errorMessage.includes('no documents found') || errorMessage.includes('no files uploaded')) {
      return 'no_documents';
    }

    // No relevant documents for query
    if (errorMessage.includes('no relevant') || errorMessage.includes('no results')) {
      return 'no_relevant_documents';
    }

    // Vector DB / Pinecone errors
    if (errorMessage.includes('pinecone') || errorMessage.includes('vector') || errorMessage.includes('embedding')) {
      return 'retrieval_failed';
    }

    // LLM / Gemini errors
    if (errorMessage.includes('gemini') || errorMessage.includes('generate') || errorMessage.includes('llm')) {
      return 'llm_failed';
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorCode === 'RATE_LIMIT') {
      return 'rate_limited';
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorCode === 'UNAUTHORIZED') {
      return 'auth_failed';
    }

    return 'unknown';
  }

  /**
   * Generate user-friendly error response with actionable suggestions
   * Now uses ErrorMessagesService for varied, natural responses
   */
  private generateErrorResponse(category: ErrorCategory, error: Error | any): ErrorResponse {
    switch (category) {
      case 'no_documents':
        return {
          category,
          userMessage: ErrorMessagesService.getNotFoundMessage({
            query: '',
            documentCount: 0,
          }),
          suggestions: [
            'Upload your first document using the upload button',
            'Supported formats: PDF, Word, Excel, PowerPoint, images, and more',
            'Once uploaded, I can answer questions about your documents',
          ],
          canRetry: false,
        };

      case 'no_relevant_documents':
        return {
          category,
          userMessage: ErrorMessagesService.getNotFoundMessage({
            query: error?.query || '',
            documentCount: error?.documentCount || 1,
            hasSpecificDocument: error?.documentName ? true : false,
            documentName: error?.documentName,
          }),
          suggestions: [
            'Try rephrasing your question with more specific terms',
            'Specify which document or section you\'re interested in',
            'Check if the document containing this information is uploaded',
            'Break down complex questions into smaller parts',
          ],
          canRetry: true,
        };

      case 'retrieval_failed':
        return {
          category,
          userMessage: ErrorMessagesService.getGeneralErrorMessage(),
          technicalDetails: error.message,
          suggestions: [
            'Please try your question again',
            'If the issue persists, refresh the page',
            'Your documents are safe and will remain available',
          ],
          canRetry: true,
        };

      case 'llm_failed':
        return {
          category,
          userMessage: ErrorMessagesService.getGeneralErrorMessage(),
          technicalDetails: error.message,
          suggestions: [
            'Try asking your question again',
            'If the question is complex, break it into smaller parts',
            'Check your internet connection',
          ],
          canRetry: true,
        };

      case 'rate_limited':
        return {
          category,
          userMessage: ErrorMessagesService.getRateLimitedMessage(),
          suggestions: [
            'Wait 30-60 seconds before submitting another query',
            'Consider upgrading your plan for higher limits',
            'Batch multiple questions into one query when possible',
          ],
          canRetry: true,
        };

      case 'auth_failed':
        return {
          category,
          userMessage: 'There was an authentication issue. Please log in again.',
          suggestions: [
            'Refresh the page and log in again',
            'Clear your browser cache if the issue persists',
            'Contact support if you continue having trouble',
          ],
          canRetry: false,
        };

      case 'unknown':
      default:
        return {
          category,
          userMessage: ErrorMessagesService.getGeneralErrorMessage(),
          technicalDetails: error.message,
          suggestions: [
            'Refresh the page and try again',
            'Check your internet connection',
            'If the issue persists, contact support',
          ],
          canRetry: true,
        };
    }
  }

  /**
   * Format error response for display to user
   */
  formatErrorForUser(errorResponse: ErrorResponse): string {
    let message = `**${errorResponse.userMessage}**\n\n`;

    if (errorResponse.suggestions.length > 0) {
      message += '**What you can do:**\n';
      message += errorResponse.suggestions.map(s => `• ${s}`).join('\n');
    }

    return message;
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error: Error | any): boolean {
    const category = this.categorizeError(error);
    const response = this.generateErrorResponse(category, error);
    return response.canRetry;
  }

  /**
   * Get retry delay in milliseconds based on error type
   */
  getRetryDelay(error: Error | any): number {
    const category = this.categorizeError(error);

    switch (category) {
      case 'rate_limited':
        return 60000; // 60 seconds
      case 'retrieval_failed':
      case 'llm_failed':
        return 2000; // 2 seconds
      default:
        return 1000; // 1 second
    }
  }
}

export const errorHandlerService = new ErrorHandlerService();
export default errorHandlerService;
