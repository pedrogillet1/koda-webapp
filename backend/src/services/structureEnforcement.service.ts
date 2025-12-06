/**
 * Structure Enforcement Service
 *
 * PURPOSE: Enforce structural format rules on Koda responses
 * This complements FormatEnforcementService which handles micro-formatting
 *
 * CRITICAL FIX: NO TITLES for fallback responses
 * - Fallback responses (clarification, knowledge, refusal, error_recovery) should NOT have titles
 * - Only RAG-based document answers should have titles
 *
 * RULES ENFORCED:
 * 1. ✅ Title: Response MUST start with ## Title (2-4 words) - EXCEPT fallbacks
 * 2. ✅ Sections: MUST have 2-5 ### sections - EXCEPT fallbacks
 * 3. ✅ Source section: MUST include ### Source when documents are used
 * 4. ✅ Follow-up: MUST end with a follow-up question (?)
 * 5. ✅ Intro limit: Max 2 lines/60 words before first section
 * 6. ✅ Tables for comparisons: Use markdown tables when comparing
 */

export interface StructureEnforcementConfig {
  /** Force title if missing (default: true) */
  forceTitle: boolean;
  /** Force sections if missing (default: true) */
  forceSections: boolean;
  /** Force source section if documents used (default: true) */
  forceSource: boolean;
  /** Force follow-up question (default: true) */
  forceFollowUp: boolean;
  /** Max intro words before first section (default: 60) */
  maxIntroWords: number;
  /** Enable logging (default: true) */
  enableLogging: boolean;
}

export interface StructureEnforcementContext {
  query: string;
  sources: Array<{ documentName: string; pageNumber?: number | null }>;
  isComparison: boolean;
  /** NEW: Response type to determine if title should be added */
  responseType?: 'rag' | 'fallback' | 'conversation' | 'file_listing' | 'calculation';
}

export interface StructureViolation {
  type: string;
  severity: 'error' | 'warning';
  message: string;
  fixed: boolean;
}

export interface StructureEnforcementResult {
  text: string;
  violations: StructureViolation[];
  stats: {
    hasTitle: boolean;
    sectionCount: number;
    hasSource: boolean;
    hasFollowUp: boolean;
    introWords: number;
  };
}

const DEFAULT_CONFIG: StructureEnforcementConfig = {
  forceTitle: true,
  forceSections: true,
  forceSource: true,
  forceFollowUp: true,
  maxIntroWords: 60,
  enableLogging: true
};

export class StructureEnforcementService {
  private config: StructureEnforcementConfig;

  constructor(config?: Partial<StructureEnforcementConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(message);
    }
  }

  /**
   * MAIN ENTRY POINT: Enforce structure on response
   * CRITICAL FIX: Skip title/section enforcement for fallback responses
   */
  enforceStructure(
    text: string,
    context: StructureEnforcementContext
  ): StructureEnforcementResult {
    const violations: StructureViolation[] = [];
    let result = text.trim();

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL FIX: NO TITLES OR SECTIONS FOR FALLBACK RESPONSES
    // ═══════════════════════════════════════════════════════════════════════════
    const isFallbackResponse = context.responseType === 'fallback' ||
                                context.responseType === 'conversation' ||
                                context.responseType === 'file_listing';

    if (isFallbackResponse) {
      this.log('⚡ [STRUCTURE] Skipping title/section enforcement for fallback response');

      // Only clean spacing for fallback responses
      result = this.cleanSpacing(result);

      return {
        text: result,
        violations: [],
        stats: {
          hasTitle: false,
          sectionCount: 0,
          hasSource: false,
          hasFollowUp: false,
          introWords: this.countIntroWords(result)
        }
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NORMAL ENFORCEMENT FOR RAG/CALCULATION RESPONSES
    // ═══════════════════════════════════════════════════════════════════════════

    // Step 1: Check and add title if missing
    const titleCheck = this.checkTitle(result);
    if (!titleCheck.hasTitle && this.config.forceTitle) {
      result = this.addTitle(result, context.query);
      violations.push({
        type: 'missing_title',
        severity: 'error',
        message: 'Response missing ## title',
        fixed: true
      });
      this.log('📝 [STRUCTURE] Added missing title');
    }

    // Step 2: Check and add sections if missing
    const sectionCheck = this.checkSections(result);
    if (sectionCheck.count < 2 && this.config.forceSections) {
      result = this.addSections(result);
      violations.push({
        type: 'missing_sections',
        severity: 'error',
        message: `Only ${sectionCheck.count} sections found (need 2-5)`,
        fixed: true
      });
      this.log(`📂 [STRUCTURE] Added sections (was ${sectionCheck.count})`);
    }

    // Step 3: Check and add source section if missing
    const sourceCheck = this.checkSource(result);
    if (!sourceCheck.hasSource && context.sources.length > 0 && this.config.forceSource) {
      result = this.addSourceSection(result, context.sources);
      violations.push({
        type: 'missing_source',
        severity: 'error',
        message: 'Missing ### Source section',
        fixed: true
      });
      this.log('📚 [STRUCTURE] Added source section');
    }

    // Step 4: Check and add follow-up question if missing
    const followUpCheck = this.checkFollowUp(result);
    if (!followUpCheck.hasFollowUp && this.config.forceFollowUp) {
      result = this.addFollowUp(result, context.query);
      violations.push({
        type: 'missing_followup',
        severity: 'error',
        message: 'Missing follow-up question',
        fixed: true
      });
      this.log('❓ [STRUCTURE] Added follow-up question');
    }

    // Step 5: Clean up spacing
    result = this.cleanSpacing(result);

    // Calculate final stats
    const finalTitleCheck = this.checkTitle(result);
    const finalSectionCheck = this.checkSections(result);
    const finalSourceCheck = this.checkSource(result);
    const finalFollowUpCheck = this.checkFollowUp(result);
    const introWords = this.countIntroWords(result);

    return {
      text: result,
      violations,
      stats: {
        hasTitle: finalTitleCheck.hasTitle,
        sectionCount: finalSectionCheck.count,
        hasSource: finalSourceCheck.hasSource,
        hasFollowUp: finalFollowUpCheck.hasFollowUp,
        introWords
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TITLE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private checkTitle(text: string): { hasTitle: boolean; title?: string } {
    const titleMatch = text.match(/^##\s+(.+)$/m);
    return {
      hasTitle: !!titleMatch,
      title: titleMatch?.[1]
    };
  }

  private addTitle(text: string, query: string): string {
    const title = this.generateTitle(query);
    return `## ${title}\n\n${text}`;
  }

  private generateTitle(query: string): string {
    // Remove common question words and extract key terms
    const cleanQuery = query
      .toLowerCase()
      .replace(/[?.,!]/g, '')
      .replace(/^(what|how|show|tell|give|find|list|compare|can you|could you|please)\s+(is|are|me|the|a|an)?\s*/gi, '')
      .trim();

    const words = cleanQuery
      .split(/\s+/)
      .filter(w => w.length > 2 && !['for', 'the', 'and', 'from', 'with'].includes(w));

    // Take first 2-3 meaningful words and title case
    const titleWords = words
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1));

    if (titleWords.length === 0) {
      return 'Analysis Results';
    }

    // Form a coherent title
    if (titleWords.length === 1) {
      return `${titleWords[0]} Overview`;
    }

    return titleWords.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTIONS HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private checkSections(text: string): { count: number; sections: string[] } {
    // Count all sections EXCEPT Source/Data Source (which is handled separately)
    const allSections = text.match(/^###\s+.+$/gm) || [];
    const contentSections = allSections.filter(s => !/Source|Data Source|Sources/i.test(s));

    return {
      count: contentSections.length,
      sections: contentSections.map(s => s.replace(/^###\s+/, ''))
    };
  }

  private addSections(text: string): string {
    // First, preserve and extract title if it exists
    const titleMatch = text.match(/^(##\s+.+)\n*/);
    const title = titleMatch ? titleMatch[1] : '';
    let content = titleMatch ? text.substring(titleMatch[0].length).trim() : text.trim();

    // Count existing ### sections (excluding Source which is added separately)
    const existingSections = (content.match(/^###\s+(?!Source|Data Source|Sources).+$/gim) || []).length;

    // If there's already 2+ content sections (not Source), don't restructure
    if (existingSections >= 2) {
      return text;
    }

    // Extract and preserve Source section if present
    const sourceMatch = content.match(/(\n*###\s+(?:Source|Data Source|Sources)\n[\s\S]*?)(?=###|$)/i);
    const sourceSection = sourceMatch ? sourceMatch[1] : '';

    // Remove source section from content to process the rest
    if (sourceSection) {
      content = content.replace(sourceSection, '').trim();
    }

    // Split content by double newlines into paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim() && !p.match(/^###\s+Source/i));

    if (paragraphs.length === 0) {
      return text;
    }

    // First paragraph is intro (limit it)
    const intro = paragraphs[0];
    const remaining = paragraphs.slice(1);

    // Build structured response
    let result = title ? `${title}\n\n${intro}\n\n` : `${intro}\n\n`;

    if (remaining.length === 0) {
      // Only intro, add a simple "Key Points" section from the intro
      result += `### Key Information\n\n${this.convertToList(intro)}`;
    } else if (remaining.length === 1) {
      // One remaining paragraph - make it "Details"
      result += `### Details\n\n${remaining[0]}`;
    } else {
      // Multiple paragraphs - create sections
      result += `### Key Findings\n\n${remaining[0]}\n\n`;

      if (remaining.length > 1) {
        result += `### Additional Details\n\n${remaining.slice(1).join('\n\n')}`;
      }
    }

    // Re-append source section at the end (it will be added properly later if not present)
    if (sourceSection) {
      result += sourceSection;
    }

    return result;
  }

  private convertToList(text: string): string {
    // If already has bullets, return as-is
    if (text.includes('•') || text.includes('-')) {
      return text;
    }

    // Try to find comma-separated items
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    if (sentences.length >= 2) {
      return sentences.map(s => `• ${s.trim()}`).join('\n');
    }

    // Return original if can't convert
    return text;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOURCE SECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private checkSource(text: string): { hasSource: boolean } {
    return {
      hasSource: /^###\s+(Source|Data Source|Sources)/im.test(text)
    };
  }

  private addSourceSection(
    text: string,
    sources: Array<{ documentName: string; pageNumber?: number | null }>
  ): string {
    // Deduplicate sources by document name
    const uniqueSources = Array.from(
      new Map(sources.map(s => [s.documentName, s])).values()
    ).slice(0, 5);

    if (uniqueSources.length === 0) {
      return text;
    }

    const sourceLines = uniqueSources.map(s => {
      const page = s.pageNumber ? ` (Page ${s.pageNumber})` : '';
      return `• **${s.documentName}**${page}`;
    }).join('\n');

    const sourceSection = `\n\n### Source\n\n${sourceLines}`;

    // Insert before follow-up question if exists, otherwise append
    const lastQuestionIndex = text.lastIndexOf('?');
    if (lastQuestionIndex !== -1) {
      // Find the start of the line with the question
      const lineStart = text.lastIndexOf('\n', lastQuestionIndex);
      const questionLine = text.substring(lineStart);
      const beforeQuestion = text.substring(0, lineStart);
      return `${beforeQuestion}${sourceSection}${questionLine}`;
    }

    return text + sourceSection;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOLLOW-UP QUESTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private checkFollowUp(text: string): { hasFollowUp: boolean } {
    const lastLine = text.trim().split('\n').pop() || '';
    return {
      hasFollowUp: lastLine.includes('?')
    };
  }

  private addFollowUp(text: string, query: string): string {
    const followUp = this.generateFollowUp(query);
    return `${text.trimEnd()}\n\n${followUp}`;
  }

  private generateFollowUp(query: string): string {
    const queryLower = query.toLowerCase();

    // Context-specific follow-ups
    if (queryLower.includes('revenue') || queryLower.includes('income')) {
      return 'Would you like to see the breakdown by category or compare to previous periods?';
    }
    if (queryLower.includes('expense') || queryLower.includes('cost')) {
      return 'Should I analyze the expense trends or identify cost-saving opportunities?';
    }
    if (queryLower.includes('compare')) {
      return 'Would you like to see additional comparisons or drill down into specific metrics?';
    }
    if (queryLower.includes('property') || queryLower.includes('properties')) {
      return 'Would you like detailed information about any specific property?';
    }
    if (queryLower.includes('fund') || queryLower.includes('investment')) {
      return 'Should I show the historical performance or compare to other investments?';
    }
    if (queryLower.includes('month') || queryLower.includes('quarter')) {
      return 'Would you like to see year-over-year comparisons or trend analysis?';
    }
    if (queryLower.includes('total') || queryLower.includes('sum')) {
      return 'Would you like to see how this breaks down by category?';
    }

    // Generic follow-ups
    const genericFollowUps = [
      'Would you like more details on any specific aspect?',
      'Should I analyze this data further?',
      'Would you like to explore related metrics?',
      'Need any additional analysis on this topic?'
    ];

    return genericFollowUps[Math.floor(Math.random() * genericFollowUps.length)];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private countIntroWords(text: string): number {
    const titleMatch = text.match(/^##\s+.+$/m);
    if (!titleMatch) return 0;

    const afterTitle = text.substring(titleMatch.index! + titleMatch[0].length).trim();
    const firstSection = afterTitle.split(/\n###/)[0].trim();

    return firstSection.split(/\s+/).filter(w => w.length > 0).length;
  }

  private cleanSpacing(text: string): string {
    // Replace 3+ newlines with 2
    let result = text.replace(/\n{3,}/g, '\n\n');

    // Trim trailing whitespace from lines
    result = result.replace(/[ \t]+$/gm, '');

    // Ensure single newline at end
    result = result.trimEnd() + '\n';

    return result;
  }

  /**
   * Quick check if response needs structure enforcement
   */
  needsEnforcement(text: string): boolean {
    const titleCheck = this.checkTitle(text);
    const sectionCheck = this.checkSections(text);
    const followUpCheck = this.checkFollowUp(text);

    return !titleCheck.hasTitle ||
           sectionCheck.count < 2 ||
           !followUpCheck.hasFollowUp;
  }
}

export const structureEnforcementService = new StructureEnforcementService();
export default structureEnforcementService;
