/**
 * ============================================================================
 * CENTRALIZED ANSWER FORMATTER - Single Source of Truth
 * ============================================================================
 * 
 * This is the ONLY formatter that should be used in Koda.
 * Replaces ALL existing formatting services.
 * 
 * Based on:
 * - Note 4: Fixes all formatting issues (bold, spacing, lists, document names)
 * - Note 5: Implements mode-aware formatting (META, FACTUAL, COMPLEX, etc.)
 * 
 * Key Features:
 * 1. Mode-aware formatting (different rules per answer mode)
 * 2. Proper Markdown (## headings, correct bold, real bullets)
 * 3. Smart spacing (no gaps, no walls of text)
 * 4. Selective bolding (labels, numbers, filenames only)
 * 5. Clean document names (no {{DOC}} garbage)
 * 6. No duplicate paragraphs
 * 7. ChatGPT-like quality
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  AnswerMode,
  FormattingContext,
  FormattedOutput,
  IAnswerFormatter,
  LanguageCode,
  QueryIntent,
} from '../types';

import {
  getAnswerModeTemplate,
  getFormattingRules,
  modeAllowsSections,
  modeRequiresHeadings,
  getMaxLength,
  getMaxBulletPoints,
} from './answerModeTemplates';

// ============================================================================
// CENTRALIZED ANSWER FORMATTER
// ============================================================================

export class CentralizedAnswerFormatter implements IAnswerFormatter {
  
  /**
   * MAIN ENTRY POINT
   * Format answer based on mode and context
   */
  formatAnswer(
    rawAnswer: string,
    context: FormattingContext
  ): FormattedOutput {
    const startTime = Date.now();
    const originalLength = rawAnswer.length;
    
    console.log(`🎨 [FORMATTER] Starting format for mode: ${context.answerMode}`);
    
    // Step 1: Clean internal placeholders FIRST
    let text = this.cleanInternalPlaceholders(rawAnswer);
    
    // Step 2: Fix UTF-8 encoding issues
    text = this.fixUTF8Encoding(text);
    
    // Step 3: Remove duplicate paragraphs
    text = this.removeDuplicateParagraphs(text);
    
    // Step 4: Apply answer mode formatting
    text = this.applyAnswerMode(text, context.answerMode, context.language);
    
    // Step 5: Fix Markdown issues (unbalanced bold, etc.)
    text = this.fixMarkdownIssues(text);
    
    // Step 6: Apply selective bolding based on mode
    text = this.applySelectiveBold(text, context.answerMode);
    
    // Step 7: Format lists properly
    text = this.formatLists(text);
    
    // Step 8: Format document names for frontend
    text = this.formatDocumentNames(text);
    
    // Step 9: Normalize spacing
    text = this.normalizeSpacing(text);
    
    // Step 10: Final cleanup
    text = this.finalCleanup(text);
    
    // Collect stats
    const stats = this.collectStats(rawAnswer, text);
    
    const result: FormattedOutput = {
      text,
      mode: context.answerMode,
      hasTitle: this.hasTitle(text),
      hasClosing: this.hasClosing(text),
      hasSections: this.hasSections(text),
      sectionCount: this.countSections(text),
      bulletCount: this.countBullets(text),
      stats,
    };
    
    console.log(`🎨 [FORMATTER] Complete in ${Date.now() - startTime}ms`);
    console.log(`🎨 [FORMATTER] Stats: ${stats.paragraphCount}p, ${stats.headingCount}h, ${stats.boldCount}b, ${stats.listCount}l`);
    
    return result;
  }
  
  // ==========================================================================
  // STEP 1: CLEAN INTERNAL PLACEHOLDERS
  // ==========================================================================
  
  cleanInternalPlaceholders(text: string): string {
    let cleaned = text;

    // Remove {{DOC ...}} blobs
    cleaned = cleaned.replace(/\{\{DOC[^}]*\}\}/g, '');

    // Remove MIME type markers in various formats:
    // - :::application/vnd.openxmlformats-officedocument...:::
    // - (application/vnd.openxmlformats-officedocument...)
    // - application/vnd.openxmlformats-officedocument...
    cleaned = cleaned.replace(/:::application\/[a-z0-9+.-]+:::/gi, '');
    cleaned = cleaned.replace(/:::[a-z]+\/[a-z0-9+.-]+:::/gi, '');
    cleaned = cleaned.replace(/\(application\/[a-z0-9+.-]+\)/gi, '');

    // Remove Windows file paths (C:/Users/... or C:\Users\...)
    // Match paths with ** markers like koda**test**files
    cleaned = cleaned.replace(/[A-Z]:[\\\/][\w\\\/\-.*]+(?:\s|$|,|\))/gi, '');

    // Remove "(Pasta: C:/Users/...)" or "(Pasta: application/...)" with system paths/mimetypes
    cleaned = cleaned.replace(/\(Pasta:\s*[A-Z]:[\\\/][^)]+\)/gi, '');
    cleaned = cleaned.replace(/\(Pasta:\s*application\/[^)]+\)/gi, '');

    // Remove standalone "Pasta: C:/Users/..." or "Pasta: application/..."
    cleaned = cleaned.replace(/Pasta:\s*[A-Z]:[\\\/][^\s\n]+/gi, '');
    cleaned = cleaned.replace(/Pasta:\s*application\/[^\s\n]+/gi, '');

    // Remove "Koda:" prefix inside answer body
    cleaned = cleaned.replace(/^Koda:\s*/gim, '');

    // Clean up any leftover empty lines or multiple spaces
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleaned = cleaned.replace(/  +/g, ' ');

    return cleaned;
  }
  
  // ==========================================================================
  // STEP 2: FIX UTF-8 ENCODING
  // ==========================================================================
  
  fixUTF8Encoding(text: string): string {
    const replacements: Record<string, string> = {
      // Portuguese
      'Ã¡': 'á', 'Ã ': 'à', 'Ã£': 'ã', 'Ã¢': 'â',
      'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê',
      'Ã­': 'í', 'Ã¬': 'ì',
      'Ã³': 'ó', 'Ã²': 'ò', 'Ãµ': 'õ', 'Ã´': 'ô',
      'Ãº': 'ú', 'Ã¹': 'ù',
      'Ã§': 'ç',
      // Spanish
      'Ã±': 'ñ',
      // Quotes
      'â€œ': '"', 'â€': '"', 'â€™': "'",
      'â€"': '—',
    };
    
    let fixed = text;
    for (const [wrong, correct] of Object.entries(replacements)) {
      fixed = fixed.split(wrong).join(correct);
    }
    
    return fixed;
  }
  
  // ==========================================================================
  // STEP 3: REMOVE DUPLICATE PARAGRAPHS
  // ==========================================================================
  
  removeDuplicateParagraphs(text: string): string {
    const paragraphs = text.split(/\n\n+/);
    const seen = new Set<string>();
    const unique: string[] = [];
    
    for (const para of paragraphs) {
      const normalized = para.trim().toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        unique.push(para.trim());
      }
    }
    
    return unique.join('\n\n');
  }
  
  // ==========================================================================
  // STEP 4: APPLY ANSWER MODE FORMATTING
  // ==========================================================================
  
  applyAnswerMode(
    text: string,
    mode: AnswerMode,
    language: LanguageCode
  ): string {
    const template = getAnswerModeTemplate(mode);
    const rules = template.rules;
    
    console.log(`🎨 [FORMATTER] Applying mode: ${mode}`);
    
    // Handle different modes
    switch (mode) {
      case AnswerMode.META_SYSTEM:
        return this.applyMetaSystemMode(text, rules, language);
      
      case AnswerMode.SINGLE_DOC_FACTUAL:
        return this.applySingleDocFactualMode(text, rules, language);
      
      case AnswerMode.MULTI_DOC_COMPLEX:
        return this.applyMultiDocComplexMode(text, rules, language);
      
      case AnswerMode.NAVIGATION_SECTION:
        return this.applyNavigationMode(text, rules, language);
      
      case AnswerMode.CALCULATION_ROI:
        return this.applyCalculationMode(text, rules, language);
      
      case AnswerMode.ONBOARDING_SUPPORT:
        return this.applyOnboardingMode(text, rules, language);
      
      case AnswerMode.NO_DATA_NOT_FOUND:
        return this.applyNoDataMode(text, rules, language);
      
      default:
        return text;
    }
  }
  
  // --------------------------------------------------------------------------
  // META/SYSTEM MODE
  // --------------------------------------------------------------------------
  
  private applyMetaSystemMode(text: string, rules: any, language: LanguageCode): string {
    // Remove any "Resumo Executivo" / "Análise Detalhada" headings
    let formatted = this.stripHeavyHeadings(text);
    
    // Keep max 2 short paragraphs
    const paragraphs = formatted.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length > 2) {
      formatted = paragraphs.slice(0, 2).join('\n\n');
    }
    
    // No long explanations
    formatted = this.limitParagraphLength(formatted, 200);
    
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // SINGLE-DOC FACTUAL MODE
  // --------------------------------------------------------------------------
  
  private applySingleDocFactualMode(text: string, rules: any, language: LanguageCode): string {
    // Remove heavy headings
    let formatted = this.stripHeavyHeadings(text);
    
    // Keep 1-3 sentences or 1 paragraph + small bullet list
    formatted = this.limitParagraphLength(formatted, 300);
    
    // Optional: Add closing suggestion
    // (Already in text if LLM generated it)
    
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // MULTI-DOC / COMPLEX MODE
  // --------------------------------------------------------------------------
  
  private applyMultiDocComplexMode(text: string, rules: any, language: LanguageCode): string {
    // This mode CAN use structured sections with ## headings
    let formatted = text;
    
    // Convert plain text section titles to ## headings
    formatted = this.convertToMarkdownHeadings(formatted, language);
    
    // Ensure sections are 3-6 lines max
    formatted = this.limitSectionLength(formatted, 400);
    
    // Use bullets inside sections for enumerations
    formatted = this.convertEnumerationsToBullets(formatted);
    
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // NAVIGATION MODE
  // --------------------------------------------------------------------------
  
  private applyNavigationMode(text: string, rules: any, language: LanguageCode): string {
    // Direct answer with location
    let formatted = this.stripHeavyHeadings(text);
    formatted = this.limitParagraphLength(formatted, 250);
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // CALCULATION MODE
  // --------------------------------------------------------------------------
  
  private applyCalculationMode(text: string, rules: any, language: LanguageCode): string {
    // Short intro + bullet list of values + conclusion
    let formatted = this.convertToMarkdownHeadings(text, language);
    formatted = this.convertEnumerationsToBullets(formatted);
    formatted = this.limitSectionLength(formatted, 300);
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // ONBOARDING MODE
  // --------------------------------------------------------------------------
  
  private applyOnboardingMode(text: string, rules: any, language: LanguageCode): string {
    // Short intro + numbered list of steps
    let formatted = this.stripHeavyHeadings(text);
    
    // Convert to numbered list if not already
    formatted = this.convertToNumberedList(formatted);
    
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // NO-DATA MODE
  // --------------------------------------------------------------------------
  
  private applyNoDataMode(text: string, rules: any, language: LanguageCode): string {
    // One clear message + suggestion
    let formatted = this.stripHeavyHeadings(text);
    
    // Remove any fallback Parque Global paragraphs
    formatted = this.stripIrrelevantContent(formatted);
    
    // Keep max 2-4 lines
    const paragraphs = formatted.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length > 2) {
      formatted = paragraphs.slice(0, 2).join('\n\n');
    }
    
    return formatted;
  }
  
  // ==========================================================================
  // HELPER: STRIP HEAVY HEADINGS
  // ==========================================================================
  
  private stripHeavyHeadings(text: string): string {
    const heavyHeadings = [
      /^Resumo Executivo\s*$/gim,
      /^Análise Detalhada\s*$/gim,
      /^Componentes Financeiros\s*$/gim,
      /^Principais Descobertas\s*$/gim,
      /^Recomendações\s*$/gim,
      /^Executive Summary\s*$/gim,
      /^Detailed Analysis\s*$/gim,
      /^Key Findings\s*$/gim,
      /^Recommendations\s*$/gim,
    ];
    
    let cleaned = text;
    for (const pattern of heavyHeadings) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    // Remove resulting empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned;
  }
  
  // ==========================================================================
  // HELPER: CONVERT TO MARKDOWN HEADINGS
  // ==========================================================================
  
  private convertToMarkdownHeadings(text: string, language: LanguageCode): string {
    // Convert plain text section titles to ## headings
    const sectionTitles: Record<LanguageCode, string[]> = {
      pt: ['Visão geral', 'Comparação', 'Conclusão', 'Cálculo', 'Resultado'],
      en: ['Overview', 'Comparison', 'Conclusion', 'Calculation', 'Result'],
      es: ['Visión general', 'Comparación', 'Conclusión', 'Cálculo', 'Resultado'],
      fr: ['Vue d\'ensemble', 'Comparaison', 'Conclusion', 'Calcul', 'Résultat'],
    };
    
    let formatted = text;
    const titles = sectionTitles[language] || sectionTitles.pt;
    
    for (const title of titles) {
      // Match title as standalone line
      const pattern = new RegExp(`^${title}\\s*$`, 'gim');
      formatted = formatted.replace(pattern, `## ${title}`);
    }
    
    return formatted;
  }
  
  // ==========================================================================
  // HELPER: LIMIT PARAGRAPH LENGTH
  // ==========================================================================
  
  private limitParagraphLength(text: string, maxLength: number): string {
    const paragraphs = text.split(/\n\n+/);
    const limited: string[] = [];
    
    for (const para of paragraphs) {
      if (para.trim().length > maxLength) {
        // Split at sentence boundaries
        const sentences = para.split(/\.\s+/);
        let current = '';
        
        for (const sentence of sentences) {
          if ((current + sentence).length <= maxLength) {
            current += sentence + '. ';
          } else {
            if (current) limited.push(current.trim());
            current = sentence + '. ';
          }
        }
        
        if (current) limited.push(current.trim());
      } else {
        limited.push(para.trim());
      }
    }
    
    return limited.join('\n\n');
  }
  
  // ==========================================================================
  // HELPER: LIMIT SECTION LENGTH
  // ==========================================================================
  
  private limitSectionLength(text: string, maxLength: number): string {
    // Split by headings
    const sections = text.split(/^## /gm);
    const limited: string[] = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (i === 0 && !section.trim()) continue;
      
      if (section.length > maxLength) {
        const parts = section.split(/\n\n+/);
        const heading = parts[0];
        const body = parts.slice(1).join('\n\n');
        
        // Limit body
        const limitedBody = this.limitParagraphLength(body, maxLength);
        limited.push((i > 0 ? '## ' : '') + heading + '\n\n' + limitedBody);
      } else {
        limited.push((i > 0 ? '## ' : '') + section);
      }
    }
    
    return limited.join('');
  }
  
  // ==========================================================================
  // HELPER: CONVERT ENUMERATIONS TO BULLETS
  // ==========================================================================
  
  private convertEnumerationsToBullets(text: string): string {
    // Pattern: "Label: value" repeated lines → bullet list
    const lines = text.split('\n');
    const result: string[] = [];
    let inEnumeration = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line looks like "Label: value"
      if (/^[A-Za-zÀ-ÿ\s]+:\s*.+$/.test(line) && !line.startsWith('-') && !line.startsWith('*')) {
        if (!inEnumeration) {
          inEnumeration = true;
        }
        result.push(`- ${line}`);
      } else {
        inEnumeration = false;
        result.push(lines[i]);
      }
    }
    
    return result.join('\n');
  }
  
  // ==========================================================================
  // HELPER: CONVERT TO NUMBERED LIST
  // ==========================================================================
  
  private convertToNumberedList(text: string): string {
    // Find step-like patterns and convert to numbered list
    const lines = text.split('\n');
    const result: string[] = [];
    let stepNumber = 1;
    let inSteps = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if line looks like a step
      if (
        /^(Passo|Step|Paso|Étape)\s+\d+/i.test(trimmed) ||
        /^(\d+[.)]|[-*])\s+/.test(trimmed)
      ) {
        if (!inSteps) {
          inSteps = true;
          stepNumber = 1;
        }
        
        // Extract step content
        const content = trimmed.replace(/^(Passo|Step|Paso|Étape)\s+\d+[:.)\s]*/i, '')
                              .replace(/^(\d+[.)]|[-*])\s+/, '');
        
        result.push(`${stepNumber}. ${content}`);
        stepNumber++;
      } else if (trimmed && inSteps && !/^##/.test(trimmed)) {
        // Continue previous step
        result[result.length - 1] += ' ' + trimmed;
      } else {
        inSteps = false;
        result.push(line);
      }
    }
    
    return result.join('\n');
  }
  
  // ==========================================================================
  // HELPER: STRIP IRRELEVANT CONTENT
  // ==========================================================================
  
  private stripIrrelevantContent(text: string): string {
    // Remove paragraphs about Parque Global when doc is missing
    const irrelevantPatterns = [
      /O empreendimento Parque Global[^.]+\./gi,
      /Parque Global demonstra[^.]+\./gi,
      /localizado às margens da Marginal Pinheiros[^.]+\./gi,
    ];
    
    let cleaned = text;
    for (const pattern of irrelevantPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    return cleaned;
  }
  
  // ==========================================================================
  // STEP 5: FIX MARKDOWN ISSUES
  // ==========================================================================
  
  fixMarkdownIssues(text: string): string {
    let fixed = text;
    
    // Fix unbalanced bold markers
    const boldCount = (fixed.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      // Remove last unmatched **
      const lastIndex = fixed.lastIndexOf('**');
      if (lastIndex !== -1) {
        fixed = fixed.substring(0, lastIndex) + fixed.substring(lastIndex + 2);
      }
    }
    
    // Fix spaces inside bold: "** text **" → "**text**"
    fixed = fixed.replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**');
    
    // Fix unbalanced code fences
    const fenceCount = (fixed.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      fixed += '\n```';
    }
    
    return fixed;
  }
  
  // ==========================================================================
  // STEP 6: APPLY SELECTIVE BOLDING
  // ==========================================================================
  
  applySelectiveBold(text: string, mode: AnswerMode): string {
    const template = getAnswerModeTemplate(mode);
    const targets = template.rules.boldTargets;
    
    // First, remove aggressive bolding (entire sentences)
    let formatted = this.removeAggressiveBold(text);
    
    // Then, apply selective bolding based on targets
    if (targets.includes('labels')) {
      formatted = this.boldLabels(formatted);
    }
    
    if (targets.includes('numbers')) {
      formatted = this.boldNumbers(formatted);
    }
    
    if (targets.includes('filenames')) {
      formatted = this.boldFilenames(formatted);
    }
    
    if (targets.includes('keywords')) {
      formatted = this.boldKeywords(formatted);
    }
    
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // REMOVE AGGRESSIVE BOLD
  // --------------------------------------------------------------------------
  
  private removeAggressiveBold(text: string): string {
    // Remove bold from entire long sentences (> 50 chars)
    return text.replace(/\*\*([^*]{50,}?)\*\*/g, '$1');
  }
  
  // --------------------------------------------------------------------------
  // BOLD LABELS
  // --------------------------------------------------------------------------
  
  private boldLabels(text: string): string {
    // Pattern: "Label:" → "**Label:**"
    return text.replace(/\b([A-Za-zÀ-ÿ\s]{2,30}):/g, (match, label) => {
      // Don't bold if already bold
      if (text.substring(text.indexOf(match) - 2, text.indexOf(match)) === '**') {
        return match;
      }
      return `**${label}:**`;
    });
  }
  
  // --------------------------------------------------------------------------
  // BOLD NUMBERS
  // --------------------------------------------------------------------------
  
  private boldNumbers(text: string): string {
    // Pattern: Currency values, large numbers
    let formatted = text;
    
    // Currency: R$ 4,47 bilhões
    formatted = formatted.replace(/\b(R\$\s*[\d.,]+\s*(bilh[õo]es?|milh[õo]es?|mil)?)\b/gi, '**$1**');
    
    // Percentages: 73%
    formatted = formatted.replace(/\b(\d+[.,]?\d*%)\b/g, '**$1**');
    
    // Large numbers with separators
    formatted = formatted.replace(/\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?)\b/g, '**$1**');
    
    return formatted;
  }
  
  // --------------------------------------------------------------------------
  // BOLD FILENAMES
  // --------------------------------------------------------------------------
  
  private boldFilenames(text: string): string {
    // Pattern: filename.ext
    const extensions = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv'];
    const pattern = new RegExp(`\\b([\\w-]+\\.(${extensions.join('|')}))\\b`, 'gi');
    
    return text.replace(pattern, (match) => {
      // Don't bold if already bold
      if (text.substring(text.indexOf(match) - 2, text.indexOf(match)) === '**') {
        return match;
      }
      return `**${match}**`;
    });
  }
  
  // --------------------------------------------------------------------------
  // BOLD KEYWORDS
  // --------------------------------------------------------------------------
  
  private boldKeywords(text: string): string {
    // Bold important keywords in context
    const keywords = [
      'Receita total', 'Lucro líquido', 'ROI', 'VPL', 'TIR', 'Payback',
      'Total revenue', 'Net profit', 'NPV', 'IRR',
      'Ingreso total', 'Beneficio neto',
      'Revenu total', 'Bénéfice net',
    ];
    
    let formatted = text;
    for (const keyword of keywords) {
      const pattern = new RegExp(`\\b(${keyword})\\b`, 'gi');
      formatted = formatted.replace(pattern, (match) => {
        // Don't bold if already bold
        const index = formatted.indexOf(match);
        if (formatted.substring(index - 2, index) === '**') {
          return match;
        }
        return `**${match}**`;
      });
    }
    
    return formatted;
  }
  
  // ==========================================================================
  // STEP 7: FORMAT LISTS
  // ==========================================================================
  
  formatLists(text: string): string {
    // Ensure proper bullet syntax
    let formatted = text;
    
    // Fix bullets: ensure space after bullet
    formatted = formatted.replace(/^([*-])([^\s])/gm, '$1 $2');
    
    // Convert "Label: value" lines to bullets if multiple in a row
    // (Already done in convertEnumerationsToBullets)
    
    return formatted;
  }
  
  // ==========================================================================
  // STEP 8: FORMAT DOCUMENT NAMES
  // ==========================================================================
  
  formatDocumentNames(text: string): string {
    // Document names should be **filename.ext** for frontend to make clickable
    // Already done in boldFilenames
    return text;
  }
  
  // ==========================================================================
  // STEP 9: NORMALIZE SPACING
  // ==========================================================================
  
  normalizeSpacing(text: string): string {
    let normalized = text;
    
    // Replace 3+ newlines with 2 newlines (one blank line)
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    
    // Ensure exactly one blank line after headings
    normalized = normalized.replace(/^(##[^\n]+)\n{3,}/gm, '$1\n\n');
    
    // Remove trailing spaces on each line
    normalized = normalized.split('\n').map(line => line.trimEnd()).join('\n');
    
    // Ensure answer ends with exactly one newline
    normalized = normalized.trim() + '\n';
    
    return normalized;
  }
  
  // ==========================================================================
  // STEP 10: FINAL CLEANUP
  // ==========================================================================
  
  private finalCleanup(text: string): string {
    let cleaned = text;
    
    // Remove any remaining empty paragraphs
    cleaned = cleaned.replace(/\n\n\s*\n\n/g, '\n\n');
    
    // Trim
    cleaned = cleaned.trim();
    
    return cleaned;
  }
  
  // ==========================================================================
  // STATS COLLECTION
  // ==========================================================================
  
  private collectStats(original: string, formatted: string) {
    return {
      originalLength: original.length,
      finalLength: formatted.length,
      paragraphCount: (formatted.match(/\n\n/g) || []).length + 1,
      headingCount: (formatted.match(/^##/gm) || []).length,
      boldCount: (formatted.match(/\*\*[^*]+\*\*/g) || []).length,
      listCount: (formatted.match(/^[-*]\s/gm) || []).length,
    };
  }
  
  // ==========================================================================
  // DETECTION HELPERS
  // ==========================================================================
  
  private hasTitle(text: string): boolean {
    return /^#\s+/m.test(text);
  }
  
  private hasClosing(text: string): boolean {
    const closingPatterns = [
      /Se quiser.*posso/i,
      /If you want.*I can/i,
      /Si quieres.*puedo/i,
      /Si vous voulez.*je peux/i,
    ];
    return closingPatterns.some(p => p.test(text));
  }
  
  private hasSections(text: string): boolean {
    return /^##\s+/m.test(text);
  }
  
  private countSections(text: string): number {
    return (text.match(/^##\s+/gm) || []).length;
  }
  
  private countBullets(text: string): number {
    return (text.match(/^[-*]\s/gm) || []).length;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const centralizedAnswerFormatter = new CentralizedAnswerFormatter();
