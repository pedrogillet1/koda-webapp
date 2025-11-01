/**
 * Response Formatter Service - Gemini-Style Implementation
 * Formats KODA responses with numbered sections, bold headers, and structured content
 *
 * Format Types:
 * - Gemini: Comprehensive structured format with numbered sections (for "What is X about" queries)
 * - Short (≤50 words): Quick confirmations, status updates
 * - Medium (100-200 words): Document summaries, explanations
 * - Long (≥200 words): Detailed analyses, multi-document comparisons
 */

interface ResponseContext {
  queryLength: number;
  documentCount: number;
  intentType: string;
  chunks: any[];
  hasFinancialData: boolean;
  hasMultipleSheets?: boolean;
  hasSlides?: boolean;
}

interface Section {
  header: string;
  content: string;
  subsections?: { label: string; text: string }[];
}

class ResponseFormatterService {
  /**
   * Main entry point - Format KODA response
   */
  async formatResponse(
    rawAnswer: string,
    context: ResponseContext,
    sources: any[],
    query?: string
  ): Promise<string> {
    // If query not provided, use standard format
    if (!query) {
      const format = this.selectFormat(context);
      return this.applyStandardFormat(rawAnswer, format, context, sources);
    }

    // Determine if Gemini format is appropriate
    if (this.shouldUseGeminiFormat(query, context)) {
      console.log(`📝 [ResponseFormatter] Applying Gemini-style format`);
      return this.formatGeminiStyle(rawAnswer, query, sources);
    }

    // Otherwise use standard format selection
    const format = this.selectFormat(context);
    console.log(`📝 [ResponseFormatter] Selected format: ${format}`);
    return this.applyStandardFormat(rawAnswer, format, context, sources);
  }

  /**
   * Detect when to use Gemini format
   */
  private shouldUseGeminiFormat(query: string, context: ResponseContext): boolean {
    const lowerQuery = query.toLowerCase();

    // Pattern 1: Explicit summary/explanation requests
    const summaryPatterns = [
      /what is .+ about/i,
      /what's .+ about/i,
      /summarize .+/i,
      /explain .+/i,
      /tell me about .+/i,
      /describe .+/i,
      /overview of .+/i,
      /breakdown of .+/i,
      /details? (?:of|about) .+/i,
    ];

    const isSummaryRequest = summaryPatterns.some(p => p.test(query));

    // Pattern 2: Business/strategic queries
    const isBusinessQuery = /business plan|strategy|funding|market|competitive|financial projection|roadmap|revenue|investment/i.test(query);

    // Pattern 3: Complex multi-document or detailed analysis
    const isComplexQuery =
      context.documentCount > 1 ||
      context.chunks.length > 5 ||
      context.intentType === 'detailed_analysis' ||
      context.intentType === 'compare';

    // Use Gemini format if:
    // - Explicit summary request, OR
    // - Business query with multiple chunks, OR
    // - Complex analysis with detailed content
    return isSummaryRequest ||
           (isBusinessQuery && context.chunks.length > 3) ||
           (isComplexQuery && query.length > 30);
  }

  /**
   * Format response in Gemini style
   */
  private formatGeminiStyle(rawAnswer: string, query: string, sources: any[]): string {
    // Remove any filler phrases first
    let cleaned = this.removeFiller(rawAnswer);

    // Step 1: Split into paragraphs
    const paragraphs = cleaned.split('\n\n').filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) return cleaned;

    // Step 2: Extract opening (unformatted for accurate removal)
    const openingText = paragraphs[0];

    // Step 3: Remove opening from remaining text BEFORE formatting
    const remainingText = paragraphs.slice(1).join('\n\n');

    // Step 4: Format opening with bold
    const formattedOpening = this.addInlineBold(openingText);

    // Step 5: Generate transition sentence
    const transition = this.generateTransition(query);

    // Step 6: Extract and format main sections from remaining text
    const sections = this.extractSectionsFromText(remainingText);
    const formattedSections = this.formatSections(sections);

    // Assemble final response (no follow-up question)
    return `${formattedOpening}\n\n${transition}\n\n${formattedSections}`;
  }

  /**
   * Extract opening context from raw answer
   * @deprecated Use formatGeminiStyle directly
   */
  private extractOpening(text: string): string {
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length === 0) return text;
    return this.addInlineBold(paragraphs[0]);
  }

  /**
   * Generate transition sentence
   */
  private generateTransition(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (/business plan/i.test(query)) {
      return "Here is a summary of what the business plan is about:";
    }

    if (/strategy/i.test(query)) {
      return "Here is a breakdown of the strategy:";
    }

    if (/market/i.test(query)) {
      return "Here is an overview of the market analysis:";
    }

    if (/financial|revenue|funding/i.test(query)) {
      return "Here is a summary of the financial details:";
    }

    // Default
    return "Here is a summary:";
  }

  /**
   * Extract sections from text (new method - no opening removal needed)
   */
  private extractSectionsFromText(text: string): Section[] {
    // If text is empty, return empty array
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Try to detect existing structure
    const sections: Section[] = [];

    // Pattern 1: Already has numbered sections (1., 2., 3.)
    const numberedPattern = /(?:^|\n)(\d+)\.\s*([^\n]+)\n([^]*?)(?=\n\d+\.|$)/g;
    let match;

    while ((match = numberedPattern.exec(text)) !== null) {
      const header = match[2].trim();
      const content = match[3].trim();

      sections.push({
        header: header,
        content: content,
        subsections: this.extractSubsections(content)
      });
    }

    // If no numbered sections found, try to intelligently split
    if (sections.length === 0) {
      sections.push(...this.intelligentSectionSplit(text));
    }

    return sections;
  }

  /**
   * Extract sections from cleaned text
   * @deprecated Use extractSectionsFromText instead
   */
  private extractSections(text: string, opening: string): Section[] {
    let remainingText = text.replace(opening, '').trim();
    return this.extractSectionsFromText(remainingText);
  }

  /**
   * Intelligently split text into sections
   */
  private intelligentSectionSplit(text: string): Section[] {
    const sections: Section[] = [];
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);

    // If text is very short, don't apply Gemini format
    if (paragraphs.length <= 1) {
      return [{
        header: 'Overview',
        content: text,
        subsections: []
      }];
    }

    // Try to identify natural sections based on content
    // Look for topic indicators in each paragraph
    const topicKeywords = {
      'concept|value|core|vision|mission': 'The Core Concept',
      'problem|challenge|pain|issue|gap': 'The Problem',
      'solution|approach|product|technology|platform': 'The Solution',
      'business model|revenue|pricing|tiers|monetization': 'Business Model',
      'funding|investment|capital|raise': 'Funding Requirements',
      'market|segment|customer|target|audience': 'Market Opportunity',
      'competition|competitive|advantage|differentiation': 'Competitive Position',
      'projections|forecast|growth|timeline': 'Financial Projections'
    };

    // Assign each paragraph to a section based on content
    const assignments: { para: string; header: string; index: number }[] = [];

    paragraphs.forEach((para, idx) => {
      const paraLower = para.toLowerCase();
      let assigned = false;

      for (const [keywords, header] of Object.entries(topicKeywords)) {
        const regex = new RegExp(keywords, 'i');
        if (regex.test(paraLower)) {
          assignments.push({ para, header, index: idx });
          assigned = true;
          break;
        }
      }

      // If no match, assign to most recent section or create "Additional Details"
      if (!assigned) {
        const lastHeader = assignments.length > 0
          ? assignments[assignments.length - 1].header
          : 'Overview';
        assignments.push({ para, header: lastHeader, index: idx });
      }
    });

    // Group consecutive paragraphs with same header
    const grouped = new Map<string, string[]>();
    assignments.forEach(a => {
      if (!grouped.has(a.header)) {
        grouped.set(a.header, []);
      }
      grouped.get(a.header)!.push(a.para);
    });

    // Convert to sections
    let sectionNumber = 0;
    grouped.forEach((paras, header) => {
      if (paras.length > 0) {
        const content = paras.join('\n\n');
        sections.push({
          header,
          content,
          subsections: this.extractSubsections(content)
        });
      }
    });

    // If we ended up with only 1 section, force split into 3-4 sections
    if (sections.length === 1 && paragraphs.length >= 3) {
      const forcedSections: Section[] = [];
      const sectionCount = Math.min(4, Math.max(3, Math.ceil(paragraphs.length / 2)));
      const parasPerSection = Math.ceil(paragraphs.length / sectionCount);

      for (let i = 0; i < sectionCount; i++) {
        const start = i * parasPerSection;
        const end = Math.min(start + parasPerSection, paragraphs.length);
        const sectionParas = paragraphs.slice(start, end);

        if (sectionParas.length > 0) {
          const header = this.generateSectionHeader(sectionParas[0], i);
          forcedSections.push({
            header,
            content: sectionParas.join('\n\n'),
            subsections: this.extractSubsections(sectionParas.join('\n\n'))
          });
        }
      }
      return forcedSections;
    }

    return sections.length > 0 ? sections : [{
      header: 'Overview',
      content: text,
      subsections: []
    }];
  }

  /**
   * Generate section header from content
   */
  private generateSectionHeader(text: string, index: number): string {
    // Extract key concepts
    const keyTerms = [
      'Core Concept', 'Problem', 'Solution', 'Funding',
      'Market', 'Strategy', 'Business Model', 'Technology',
      'Product', 'Revenue', 'Investment', 'Opportunity'
    ];

    for (const term of keyTerms) {
      if (new RegExp(term, 'i').test(text)) {
        return `The ${term}`;
      }
    }

    // Default headers
    const defaults = ['Overview', 'Key Details', 'Additional Information', 'Summary'];
    return defaults[index] || 'Details';
  }

  /**
   * Extract subsections (bullet points)
   */
  private extractSubsections(content: string): { label: string; text: string }[] {
    const subsections: { label: string; text: string }[] = [];

    // Pattern: "Label: Text" or "• Label: Text"
    const bulletPattern = /(?:^|\n)[•\-\*]?\s*([A-Z][^:]+):\s*([^\n]+)/g;
    let match;

    while ((match = bulletPattern.exec(content)) !== null) {
      subsections.push({
        label: match[1].trim(),
        text: match[2].trim()
      });
    }

    return subsections;
  }

  /**
   * Format sections with numbering and bold
   */
  private formatSections(sections: Section[]): string {
    return sections.map((section, index) => {
      const number = index + 1;
      let formatted = `**${number}. ${section.header}**\n\n`;

      // If has subsections, format as bullets
      if (section.subsections && section.subsections.length > 0) {
        // Add intro paragraph if content has one
        const introPara = section.content.split('\n\n')[0];
        if (introPara && !introPara.includes(':')) {
          formatted += `${this.addInlineBold(introPara)}\n\n`;
        }

        // Add subsections as bullets
        section.subsections.forEach(sub => {
          formatted += `• **${sub.label}**: ${this.addInlineBold(sub.text)}\n\n`;
        });
      } else {
        // No subsections, just format content
        formatted += `${this.addInlineBold(section.content)}\n\n`;
      }

      return formatted.trim();
    }).join('\n\n');
  }

  /**
   * Add inline bold to key terms
   */
  private addInlineBold(text: string): string {
    // Bold quoted terms (including single quotes)
    text = text.replace(/"([^"]+)"/g, '**"$1"**');
    text = text.replace(/'([^']+)'/g, "**'$1'**");

    // Bold monetary values (including ranges and "over X")
    text = text.replace(/(over\s+)?\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B|K))?(?:\s*(?:to|-)\s*\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B|K))?)?/gi, '**$&**');

    // Bold percentages (including ranges like "6.0x to 18.0x")
    text = text.replace(/(\d+(?:\.\d+)?(?:x|%)(?:\s*(?:to|-)\s*\d+(?:\.\d+)?(?:x|%))?)/gi, '**$1**');

    // Bold numbers with context (Year 1, Year 3, 18-20 months, etc.)
    text = text.replace(/(Year\s+\d+|Q\d+|\d+-\d+\s+months?|\d+\s+months?)/gi, '**$1**');

    // Bold key business terms (expanded list)
    const keyTerms = [
      'AI-powered', 'zero-knowledge', 'encryption', 'freemium',
      'pre-seed funding', 'revenue', 'profitability', 'MOIC',
      'market segment', 'business model', 'conversational AI',
      'semantic intelligence', 'document management', 'document assistant',
      'intelligent, secure assistant', 'active, intelligent assistance',
      'passive document storage', 'active, intelligent assistance',
      'military-grade', 'Conversational Semantic AI',
      'woefully underserved', 'profound pain point',
      'universal frustration, anxiety, and inefficiency'
    ];

    keyTerms.forEach(term => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\*\\*)(${escapedTerm})(?!\\*\\*)`, 'gi');
      text = text.replace(regex, '**$1**');
    });

    return text;
  }

  /**
   * Generate follow-up question
   */
  private generateFollowUpQuestion(query: string, sources: any[]): string {
    const lowerQuery = query.toLowerCase();

    // Business plan queries
    if (/business plan/i.test(query)) {
      return "Would you like a more detailed breakdown of a specific section, such as the target market, competitive analysis, or the financial projections?";
    }

    // Financial queries
    if (/financial|revenue|funding/i.test(query)) {
      return "Would you like me to extract specific financial metrics or create a summary table of the projections?";
    }

    // Strategy queries
    if (/strategy|roadmap/i.test(query)) {
      return "Would you like more details about the implementation timeline or specific strategic initiatives?";
    }

    // Market queries
    if (/market|competitive/i.test(query)) {
      return "Would you like a deeper analysis of the competitive landscape or target market segments?";
    }

    // Default follow-up based on sources
    if (sources.length > 1) {
      return "Would you like me to compare this with other documents or focus on a specific aspect?";
    }

    return "Would you like more details about any specific section?";
  }

  /**
   * Apply standard format (non-Gemini)
   */
  private applyStandardFormat(
    rawAnswer: string,
    format: 'short' | 'medium' | 'long',
    context: ResponseContext,
    sources: any[]
  ): string {
    switch (format) {
      case 'short':
        return this.formatShort(rawAnswer);

      case 'medium':
        return this.formatMedium(rawAnswer, sources);

      case 'long':
        return this.formatLong(rawAnswer, context, sources);

      default:
        return rawAnswer;
    }
  }

  /**
   * Select appropriate format for non-Gemini responses
   */
  private selectFormat(context: ResponseContext): 'short' | 'medium' | 'long' {
    // Short format: Quick commands or confirmations
    if (
      context.intentType === 'file_action' ||
      context.intentType === 'confirmation' ||
      context.queryLength < 20
    ) {
      return 'short';
    }

    // Long format: Multi-document or detailed analysis
    if (
      context.documentCount > 1 ||
      context.intentType === 'compare' ||
      context.intentType === 'detailed_analysis' ||
      (context.hasFinancialData && context.chunks.length > 5)
    ) {
      return 'long';
    }

    // Default: Medium format
    return 'medium';
  }

  /**
   * Format short response (≤ 50 words)
   */
  private formatShort(rawAnswer: string): string {
    let formatted = rawAnswer.trim();
    formatted = this.removeFiller(formatted);

    // Limit to ~50 words
    const words = formatted.split(' ');
    if (words.length > 50) {
      formatted = words.slice(0, 50).join(' ') + '...';
    }

    return formatted;
  }

  /**
   * Format medium response (100-200 words)
   */
  private formatMedium(rawAnswer: string, sources: any[]): string {
    let formatted = rawAnswer.trim();
    formatted = this.removeFiller(formatted);

    // Add structure
    const sentences = formatted.split('. ');

    if (sentences.length >= 3) {
      const firstSentence = sentences[0] + '.';
      const mainContent = sentences.slice(1).join('. ');
      formatted = `${firstSentence}\n\n${mainContent}`;
    }

    // Add actionable ending if missing
    if (!this.hasActionableEnding(formatted)) {
      formatted += '\n\n' + this.generateActionSuggestion(sources);
    }

    return formatted;
  }

  /**
   * Format long response (≥ 200 words)
   */
  private formatLong(
    rawAnswer: string,
    context: ResponseContext,
    sources: any[]
  ): string {
    let formatted = rawAnswer.trim();
    formatted = this.removeFiller(formatted);

    // Check if already has markdown structure
    const hasMarkdown = formatted.includes('**') || formatted.includes('##');

    if (!hasMarkdown) {
      formatted = this.addStructure(formatted, context);
    }

    // Add next steps if missing
    if (!formatted.includes('Next Steps:') && !formatted.includes('**Next Steps**')) {
      formatted += '\n\n' + this.generateNextSteps(context, sources);
    }

    return formatted;
  }

  /**
   * Remove filler words and phrases
   */
  private removeFiller(text: string): string {
    return text
      .replace(/^(Sure thing!|Absolutely!|Of course!|Gotcha!|I'd be happy to help!|Great question!)\s*/gi, '')
      .replace(/Let me (take a look|check|see|analyze|help you with that)/gi, '')
      .replace(/Okay,?\s*(so\s*)?/gi, '')
      .replace(/Well,?\s*/gi, '')
      .replace(/It (looks|appears|seems) like\s*/gi, '')
      .replace(/I (found|noticed|see) that\s*/gi, '')
      .replace(/I can (tell|see) that\s*/gi, '')
      .replace(/Based on (the|my) analysis,?\s*/gi, 'Analysis shows ')
      .replace(/After (analyzing|reviewing|checking)\s*(the)?\s*(document|file)?,?\s*/gi, '')
      .trim();
  }

  /**
   * Check if response has actionable ending
   */
  private hasActionableEnding(text: string): boolean {
    const actionPatterns = [
      /You can ask/i,
      /Would you like/i,
      /Next steps?:/i,
      /I can (also|generate|extract|create)/i,
      /You can (also|generate|extract|create|compare|export)/i,
    ];

    return actionPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Generate action suggestion
   */
  private generateActionSuggestion(sources: any[]): string {
    if (sources.length === 0) {
      return 'You can upload related documents for deeper analysis.';
    }

    const hasExcel = sources.some(s => s.filename?.includes('.xlsx') || s.filename?.includes('.xls'));
    const hasPDF = sources.some(s => s.filename?.includes('.pdf'));
    const hasPPTX = sources.some(s => s.filename?.includes('.pptx') || s.filename?.includes('.ppt'));

    if (hasExcel) {
      return 'You can ask KODA to extract all financial values or create a summary table.';
    }

    if (hasPDF) {
      return 'You can ask KODA to extract key clauses or generate a compliance checklist.';
    }

    if (hasPPTX) {
      return 'You can ask KODA to extract slide content or generate a presentation summary.';
    }

    return 'You can ask KODA to compare this with other documents or export the details.';
  }

  /**
   * Add structure to long responses
   */
  private addStructure(text: string, context: ResponseContext): string {
    // If already structured with markdown, return as-is
    if (text.includes('##') || text.includes('**')) {
      return text;
    }

    // Split into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);

    if (paragraphs.length < 2) {
      return text;
    }

    let structured = '';

    // Add title if missing
    if (!text.startsWith('**')) {
      structured += `**Document Analysis**\n\n`;
    }

    // Add overview
    structured += `Overview: ${paragraphs[0]}\n\n`;

    // Add key points
    if (paragraphs.length > 2) {
      structured += `**Key Points:**\n\n`;
      for (let i = 1; i < paragraphs.length; i++) {
        structured += `• ${paragraphs[i]}\n`;
      }
    } else {
      structured += paragraphs.slice(1).join('\n\n');
    }

    return structured;
  }

  /**
   * Generate next steps section
   */
  private generateNextSteps(context: ResponseContext, sources: any[]): string {
    const suggestions = [];

    if (context.hasFinancialData) {
      suggestions.push('Generate a financial summary');
      suggestions.push('Extract all monetary values');
    }

    if (context.documentCount > 1) {
      suggestions.push('Compare with other documents');
      suggestions.push('Create a consolidated report');
    }

    if (context.hasMultipleSheets) {
      suggestions.push('Analyze specific sheets in detail');
      suggestions.push('Export data to CSV');
    }

    if (context.hasSlides) {
      suggestions.push('Extract slide content');
      suggestions.push('Generate presentation summary');
    }

    if (suggestions.length === 0) {
      suggestions.push('Extract key information');
      suggestions.push('Summarize in different format');
      suggestions.push('Cross-link with related documents');
    }

    return `**Next Steps:**\n\nI can ${suggestions.slice(0, 3).join(', or ')}.`;
  }

  /**
   * Add privacy reminder (occasionally, 10% probability)
   */
  addPrivacyReminder(text: string, probability: number = 0.1): string {
    if (Math.random() < probability) {
      return text + '\n\n🔒 Your documents remain private and encrypted.';
    }
    return text;
  }
}

export default new ResponseFormatterService();
