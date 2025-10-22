/**
 * Response Formatting Service
 * Enforces consistent 4-step response structure for all AI responses
 * Post-processes LLM output to ensure compliance with universal format
 */

import { SemanticAnalysis } from './semanticContext.service';

interface FormatValidation {
  hasDocumentHeader: boolean;
  hasOpeningSentence: boolean;
  hasBoldHeaders: boolean;
  hasBulletPoints: boolean;
  hasClosingQuestion: boolean;
  overallCompliance: number;
}

interface FormattingOptions {
  documentName?: string;
  queryType?: string;
  language?: string;
  requireDocumentHeader?: boolean;
}

class ResponseFormattingService {
  /**
   * Main formatting function - enforces 4-step structure
   */
  formatResponse(
    rawResponse: string,
    semanticAnalysis?: SemanticAnalysis,
    options: FormattingOptions = {}
  ): string {
    // First, validate the response
    const validation = this.validateFormat(rawResponse, options);

    console.log(`📝 Format validation score: ${(validation.overallCompliance * 100).toFixed(1)}%`);

    // If compliance is high enough, return as-is
    if (validation.overallCompliance >= 0.9) {
      console.log('✅ Response already compliant with format');
      return rawResponse;
    }

    // Otherwise, correct the format
    console.log('⚠️ Response needs formatting corrections');
    return this.correctFormat(rawResponse, validation, options);
  }

  /**
   * Validates response against 4-step format
   */
  validateFormat(response: string, options: FormattingOptions = {}): FormatValidation {
    const validation: FormatValidation = {
      hasDocumentHeader: false,
      hasOpeningSentence: false,
      hasBoldHeaders: false,
      hasBulletPoints: false,
      hasClosingQuestion: false,
      overallCompliance: 0
    };

    // Check 1: Document header (📄 **[Document Name]**)
    if (options.requireDocumentHeader !== false && options.documentName) {
      validation.hasDocumentHeader = /^📄\s+\*\*/.test(response.trim());
    } else {
      validation.hasDocumentHeader = true; // Not required
    }

    // Check 2: Opening sentence (first non-header line should be substantive)
    const lines = response.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 1) {
      const firstContentLine = lines.find(l => !l.startsWith('📄') && !l.startsWith('#'));
      validation.hasOpeningSentence = firstContentLine ? firstContentLine.length > 30 : false;
    }

    // Check 3: Bold headers (**Header**)
    validation.hasBoldHeaders = /\*\*[A-Z][^*]+\*\*/.test(response);

    // Check 4: Bullet points (– or •)
    validation.hasBulletPoints = /[–•]\s+/.test(response);

    // Check 5: Closing question
    const lastLines = lines.slice(-3).join(' ');
    validation.hasClosingQuestion = /\?/.test(lastLines);

    // Calculate overall compliance
    const checks = [
      validation.hasDocumentHeader,
      validation.hasOpeningSentence,
      validation.hasBoldHeaders,
      validation.hasBulletPoints,
      validation.hasClosingQuestion
    ];

    validation.overallCompliance = checks.filter(Boolean).length / checks.length;

    return validation;
  }

  /**
   * Corrects format to match 4-step structure
   */
  private correctFormat(
    response: string,
    validation: FormatValidation,
    options: FormattingOptions
  ): string {
    let corrected = response;

    // Step 1: Add document header if missing
    if (!validation.hasDocumentHeader && options.documentName) {
      corrected = this.ensureDocumentHeader(corrected, options.documentName);
    }

    // Step 2: Ensure opening sentence
    if (!validation.hasOpeningSentence) {
      corrected = this.ensureOpeningSentence(corrected);
    }

    // Step 3: Convert paragraphs to structured format with headers and bullets
    if (!validation.hasBoldHeaders || !validation.hasBulletPoints) {
      corrected = this.ensureBulletPoints(corrected);
    }

    // Step 4: Add closing question if missing
    if (!validation.hasClosingQuestion) {
      corrected = this.ensureClosingQuestion(corrected, options.queryType);
    }

    return corrected;
  }

  /**
   * Adds document header if missing
   */
  private ensureDocumentHeader(response: string, documentName: string): string {
    // Check if header already exists
    if (/^📄\s+\*\*/.test(response.trim())) {
      return response;
    }

    // Add header at the beginning
    const cleanDocName = documentName.replace(/\.(pdf|docx?|xlsx?|txt|md)$/i, '');
    const header = `📄 **${cleanDocName}**\n\n`;

    return header + response;
  }

  /**
   * Ensures response starts with a clear opening sentence
   */
  private ensureOpeningSentence(response: string): string {
    // If response already starts well, return as-is
    const lines = response.split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) return response;

    // Find first content line (skip document header)
    let firstContentIdx = 0;
    if (lines[0].startsWith('📄')) {
      firstContentIdx = 1;
    }

    const firstContent = lines[firstContentIdx];

    // If first sentence is already substantive (>30 chars, ends with period), it's good
    if (firstContent && firstContent.length > 30 && /[.!]$/.test(firstContent.trim())) {
      return response;
    }

    // Otherwise, we can't automatically fix this without understanding content
    // Return as-is and let LLM handle it
    return response;
  }

  /**
   * Converts long paragraphs to structured format with headers and bullets
   */
  private ensureBulletPoints(response: string): string {
    const lines = response.split('\n');
    const converted: string[] = [];

    let inParagraph = false;
    let paragraphBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        if (inParagraph && paragraphBuffer.length > 0) {
          // Convert accumulated paragraph
          converted.push(...this.convertParagraphToBullets(paragraphBuffer));
          paragraphBuffer = [];
          inParagraph = false;
        }
        converted.push(line);
        continue;
      }

      // Keep document headers, bold headers, and existing bullets as-is
      if (
        trimmed.startsWith('📄') ||
        /^\*\*[^*]+\*\*/.test(trimmed) ||
        /^[–•]\s+/.test(trimmed) ||
        trimmed.endsWith('?') // Keep questions
      ) {
        if (inParagraph && paragraphBuffer.length > 0) {
          converted.push(...this.convertParagraphToBullets(paragraphBuffer));
          paragraphBuffer = [];
          inParagraph = false;
        }
        converted.push(line);
        continue;
      }

      // Accumulate paragraph lines
      inParagraph = true;
      paragraphBuffer.push(trimmed);
    }

    // Convert any remaining paragraph
    if (paragraphBuffer.length > 0) {
      converted.push(...this.convertParagraphToBullets(paragraphBuffer));
    }

    return converted.join('\n');
  }

  /**
   * Converts a paragraph into bullet points
   */
  private convertParagraphToBullets(paragraphLines: string[]): string[] {
    const fullParagraph = paragraphLines.join(' ');

    // If paragraph is short (< 100 chars), keep as-is
    if (fullParagraph.length < 100) {
      return [fullParagraph, ''];
    }

    // Split into sentences
    const sentences = fullParagraph.split(/(?<=[.!])\s+/);

    // If only 1-2 sentences, keep as paragraph
    if (sentences.length <= 2) {
      return [fullParagraph, ''];
    }

    // Convert to bullets
    const bullets = sentences
      .filter(s => s.trim().length > 0)
      .map(s => `– ${s.trim()}`);

    return [...bullets, ''];
  }

  /**
   * Adds closing question if missing
   */
  private ensureClosingQuestion(response: string, queryType?: string): string {
    // Check if response already has a question in last 3 lines
    const lines = response.split('\n').filter(l => l.trim().length > 0);
    const lastLines = lines.slice(-3).join(' ');

    if (/\?/.test(lastLines)) {
      return response; // Already has question
    }

    // Generate appropriate follow-up based on query type
    let followUp = '';

    switch (queryType) {
      case 'summary':
        followUp = 'Would you like me to elaborate on any specific section?';
        break;
      case 'comparison':
        followUp = 'Would you like me to compare additional aspects?';
        break;
      case 'explanation':
        followUp = 'Would you like me to explain any of these points in more detail?';
        break;
      case 'factual':
        followUp = 'Do you have any follow-up questions about this?';
        break;
      default:
        followUp = 'How else can I help you?';
    }

    return response.trimEnd() + '\n\n' + followUp;
  }

  /**
   * Validates language consistency (no mixing)
   */
  validateLanguageConsistency(response: string, expectedLanguage: string): boolean {
    const detectedLanguages = new Set<string>();

    // Simple language detection by common words
    const hasEnglish = /\b(the|and|or|is|are|was|were|have|has|can|will|would)\b/i.test(response);
    const hasPortuguese = /\b(o|a|os|as|de|do|da|dos|das|para|com|em|por|um|uma)\b/i.test(response);
    const hasSpanish = /\b(el|la|los|las|de|del|para|con|en|por|un|una)\b/i.test(response);

    if (hasEnglish) detectedLanguages.add('en');
    if (hasPortuguese) detectedLanguages.add('pt');
    if (hasSpanish) detectedLanguages.add('es');

    // If multiple languages detected, that's language mixing
    if (detectedLanguages.size > 1) {
      console.warn(`⚠️ Language mixing detected: ${Array.from(detectedLanguages).join(', ')}`);
      return false;
    }

    // Check if detected language matches expected
    const detected = Array.from(detectedLanguages)[0];
    if (detected && detected !== expectedLanguage) {
      console.warn(`⚠️ Language mismatch: expected ${expectedLanguage}, got ${detected}`);
      return false;
    }

    return true;
  }

  /**
   * Cleans up common formatting issues
   */
  cleanFormatting(response: string): string {
    let cleaned = response;

    // Fix multiple consecutive empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Fix spaces before punctuation
    cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');

    // Fix bullet point formatting
    cleaned = cleaned.replace(/^[-*]\s+/gm, '– '); // Normalize bullet characters

    // Fix bold formatting (ensure spaces around **)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '**$1**');

    // Trim trailing whitespace
    cleaned = cleaned.split('\n').map(l => l.trimEnd()).join('\n');

    return cleaned.trim();
  }
}

export default new ResponseFormattingService();
export { ResponseFormattingService, FormatValidation, FormattingOptions };
