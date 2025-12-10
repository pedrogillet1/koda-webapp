/**
 * ============================================================================
 * LAYER 1: KODA OUTPUT STRUCTURE ENGINE
 * ============================================================================
 * 
 * GOAL: Take raw LLM text and decide:
 * - Do we add a title or not?
 * - Is this a one-paragraph answer, bullet list, or multi-section analysis?
 * - How big should the paragraphs be?
 * - Do we add a closing sentence or not?
 * 
 * This is the "layout brain" of Koda.
 * 
 * Based on Note 6 - Section 1
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  StructureEngineInput,
  StructureEngineOutput,
  PrimaryIntent,
  AnswerMode,
  Language,
} from '../types';

export class KodaOutputStructureEngine {
  
  /**
   * MAIN ENTRY POINT
   */
  public shapeAnswer(input: StructureEngineInput): StructureEngineOutput {
    console.log(`[Structure] Shaping answer: intent=${input.primaryIntent}, mode=${input.answerMode}`);
    
    let text = input.rawAnswer;
    
    // Step 1: Normalize line breaks early
    text = this.normalizeLineBreaks(text);
    
    // Step 2: Remove bad or unnecessary headings
    text = this.removeBadHeadings(text, input.answerMode);
    
    // Step 3: Decide if we need a title
    const { text: textWithTitle, hasTitle } = this.addTitleIfNeeded(text, input);
    text = textWithTitle;
    
    // Step 4: Add light sections when needed
    text = this.addSectionsIfNeeded(text, input);
    
    // Step 5: Steps mode → force numbered steps
    if (input.answerMode === 'steps') {
      text = this.formatAsSteps(text, input.language);
    }
    
    // Step 6: Bullet mode → clean bullet list
    if (input.answerMode === 'bullet_list') {
      text = this.formatAsBulletList(text, input.language);
    }
    
    // Step 7: Enforce paragraph size
    text = this.enforceParagraphSize(text);
    
    // Step 8: Add a closing sentence (or not)
    text = this.addClosingIfNeeded(text, input);
    
    // Calculate stats
    const sectionCount = this.countSections(text);
    const paragraphCount = this.countParagraphs(text);
    const structureScore = this.calculateStructureScore(text, input);
    
    return {
      structuredText: text,
      hasTitle,
      hasSections: sectionCount > 0,
      sectionCount,
      paragraphCount,
      structureScore,
    };
  }
  
  // ==========================================================================
  // STEP 1: NORMALIZE LINE BREAKS
  // ==========================================================================
  
  private normalizeLineBreaks(text: string): string {
    // Convert \r\n to \n
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    // Collapse 3+ blank lines into 2 max
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Trim trailing spaces at end of each line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');
    
    return text.trim();
  }
  
  // ==========================================================================
  // STEP 2: REMOVE BAD OR UNNECESSARY HEADINGS
  // ==========================================================================
  
  private removeBadHeadings(text: string, mode: AnswerMode): string {
    // For direct_short and bullet_list: NO title
    if (mode === 'direct_short' || mode === 'bullet_list') {
      // Remove generic headings like "# Resumo", "# Answer"
      text = text.replace(/^#\s+(Resumo|Answer|Resposta|Summary)\s*$/gim, '');
      
      // Remove resulting empty lines
      text = text.replace(/\n{3,}/g, '\n\n');
    }
    
    return text.trim();
  }
  
  // ==========================================================================
  // STEP 3: DECIDE IF WE NEED A TITLE
  // ==========================================================================
  
  private addTitleIfNeeded(
    text: string,
    input: StructureEngineInput
  ): { text: string; hasTitle: boolean } {
    // Check if already has a title
    if (/^#{1,2}\s+/.test(text)) {
      return { text, hasTitle: true };
    }
    
    // Add title ONLY when:
    // - The answer is not ultra-short AND
    // - The mode is more "heavy" (structured_sections, explanatory)
    
    const isUltraShort = text.length < 100;
    const isHeavyMode = input.answerMode === 'structured_sections' || input.answerMode === 'explanatory';
    
    if (isUltraShort || !isHeavyMode) {
      return { text, hasTitle: false };
    }
    
    // For greetings, meta queries, simple factual answers: NO title
    if (input.primaryIntent === 'meta' || input.primaryIntent === 'file_action') {
      return { text, hasTitle: false };
    }
    
    // Generate minimal title
    const title = this.generateTitle(input.query, input.language);
    
    if (title) {
      return {
        text: `## ${title}\n\n${text}`,
        hasTitle: true,
      };
    }
    
    return { text, hasTitle: false };
  }
  
  private generateTitle(query: string, language: Language): string | null {
    // Keep it minimal
    const prefix = language === 'pt' ? 'Resposta sobre:' : 'Answer:';
    
    // Clean up query
    let cleanQuery = query
      .replace(/^(what|how|why|when|where|who|which|can you|could you|please|por favor|qual|como|por que|quando|onde|quem|o que|você pode|poderia)\s+/gi, '')
      .replace(/\?+$/, '')
      .trim();
    
    // Capitalize first letter
    cleanQuery = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);
    
    // Truncate if too long
    if (cleanQuery.length > 60) {
      cleanQuery = cleanQuery.substring(0, 57) + '...';
    }
    
    // Don't return very short titles
    if (cleanQuery.length < 10) {
      return null;
    }
    
    return `${prefix} ${cleanQuery}`;
  }
  
  // ==========================================================================
  // STEP 4: ADD LIGHT SECTIONS WHEN NEEDED
  // ==========================================================================
  
  private addSectionsIfNeeded(text: string, input: StructureEngineInput): string {
    // Only for complex answers
    if (input.answerMode !== 'structured_sections' && input.answerMode !== 'explanatory') {
      return text;
    }
    
    // Don't add sections if text is too short
    if (text.length < 300) {
      return text;
    }
    
    // Don't add sections if already has them
    if (/^###\s+/m.test(text)) {
      return text;
    }
    
    // Split into paragraphs
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    
    // Need at least 3 paragraphs to add sections
    if (paragraphs.length < 3) {
      return text;
    }
    
    // Add simple, reusable headings
    const headings = this.getSectionHeadings(input.language);
    
    // Limit to max 3-4 headings
    const maxSections = Math.min(paragraphs.length, 4);
    
    const sections: string[] = [];
    for (let i = 0; i < maxSections; i++) {
      const heading = headings[i % headings.length];
      sections.push(`### ${heading}\n\n${paragraphs[i]}`);
    }
    
    // Add remaining paragraphs without headings
    for (let i = maxSections; i < paragraphs.length; i++) {
      sections.push(paragraphs[i]);
    }
    
    return sections.join('\n\n');
  }
  
  private getSectionHeadings(language: Language): string[] {
    const headings: Record<Language, string[]> = {
      pt: ['Resumo', 'Detalhes', 'Análise', 'Conclusão'],
      en: ['Overview', 'Details', 'Analysis', 'Conclusion'],
      es: ['Resumen', 'Detalles', 'Análisis', 'Conclusión'],
      fr: ['Résumé', 'Détails', 'Analyse', 'Conclusion'],
    };
    
    return headings[language] || headings.en;
  }
  
  // ==========================================================================
  // STEP 5: STEPS MODE → FORCE NUMBERED STEPS
  // ==========================================================================
  
  private formatAsSteps(text: string, language: Language): string {
    const intro = language === 'pt' ? 'Passo a passo:' : 'Step-by-step:';
    
    // Split into sentences or lines
    const lines = text.split(/\n+/).filter(l => l.trim());
    
    // Convert to numbered steps
    const steps = lines.map((line, index) => {
      // Remove existing numbering if any
      const cleaned = line.replace(/^(\d+\.|[-*•])\s*/, '').trim();
      return `${index + 1}. ${cleaned}`;
    });
    
    return `${intro}\n\n${steps.join('\n')}`;
  }
  
  // ==========================================================================
  // STEP 6: BULLET MODE → CLEAN BULLET LIST
  // ==========================================================================
  
  private formatAsBulletList(text: string, language: Language): string {
    const intro = language === 'pt' ? 'Resumo:' : 'Summary:';
    
    // Split into lines
    const lines = text.split(/\n+/).filter(l => l.trim());
    
    // Convert to clean bullets
    const bullets = lines.map(line => {
      // Remove existing bullets if any
      const cleaned = line.replace(/^[-*•]\s*/, '').trim();
      return `- ${cleaned}`;
    });
    
    return `${intro}\n\n${bullets.join('\n')}`;
  }
  
  // ==========================================================================
  // STEP 7: ENFORCE PARAGRAPH SIZE
  // ==========================================================================
  
  private enforceParagraphSize(text: string): string {
    const paragraphs = text.split(/\n\n+/);
    const result: string[] = [];
    
    for (const para of paragraphs) {
      // Skip headings
      if (/^#{1,6}\s+/.test(para)) {
        result.push(para);
        continue;
      }
      
      // Count lines
      const lines = para.split('\n');
      
      // If paragraph is too long (10+ lines), split it
      if (lines.length > 10) {
        // Split by sentences
        const sentences = para.split(/\.\s+/);
        
        let currentChunk = '';
        let lineCount = 0;
        
        for (const sentence of sentences) {
          const sentenceLines = sentence.split('\n').length;
          
          if (lineCount + sentenceLines > 5 && currentChunk) {
            result.push(currentChunk.trim() + '.');
            currentChunk = sentence;
            lineCount = sentenceLines;
          } else {
            currentChunk += (currentChunk ? '. ' : '') + sentence;
            lineCount += sentenceLines;
          }
        }
        
        if (currentChunk) {
          result.push(currentChunk.trim());
        }
      } else {
        result.push(para);
      }
    }
    
    return result.join('\n\n');
  }
  
  // ==========================================================================
  // STEP 8: ADD CLOSING IF NEEDED
  // ==========================================================================
  
  private addClosingIfNeeded(text: string, input: StructureEngineInput): string {
    // Add a short, friendly closing when:
    // - The answer is explanatory or analytic, AND
    // - It doesn't already end with a question or invitation
    
    const isExplanatoryOrAnalytic = 
      input.answerMode === 'explanatory' || 
      input.answerMode === 'structured_sections';
    
    if (!isExplanatoryOrAnalytic) {
      return text;
    }
    
    // Check if already has a closing
    const lastLine = text.split('\n').pop()?.trim() || '';
    
    if (/[?]$/.test(lastLine)) {
      return text; // Already ends with a question
    }
    
    const closingPhrases = [
      'posso',
      'quiser',
      'precisar',
      'ajudar',
      'let me know',
      'feel free',
      'if you need',
    ];
    
    if (closingPhrases.some(phrase => lastLine.toLowerCase().includes(phrase))) {
      return text; // Already has a closing
    }
    
    // Add appropriate closing
    const closing = this.getClosing(input.language, input.hasDocuments);
    
    return `${text}\n\n${closing}`;
  }
  
  private getClosing(language: Language, hasDocuments: boolean): string {
    if (language === 'pt') {
      if (hasDocuments) {
        return 'Se quiser, posso entrar em mais detalhes sobre esses documentos ou cruzar informações entre eles.';
      } else {
        return 'Quando você enviar seus documentos, posso fazer análises bem mais específicas para o seu caso.';
      }
    } else {
      if (hasDocuments) {
        return 'I can provide more details about these documents or cross-reference information between them if needed.';
      } else {
        return 'Once you upload your documents, I can provide much more specific analysis for your case.';
      }
    }
  }
  
  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================
  
  private countSections(text: string): number {
    return (text.match(/^###\s+/gm) || []).length;
  }
  
  private countParagraphs(text: string): number {
    return text.split(/\n\n+/).filter(p => p.trim() && !/^#{1,6}\s+/.test(p)).length;
  }
  
  private calculateStructureScore(text: string, input: StructureEngineInput): number {
    let score = 50; // Base score
    
    // Good: Has appropriate structure for mode
    if (input.answerMode === 'structured_sections' && this.countSections(text) > 0) {
      score += 20;
    }
    
    if (input.answerMode === 'steps' && /^\d+\.\s+/m.test(text)) {
      score += 20;
    }
    
    if (input.answerMode === 'bullet_list' && /^-\s+/m.test(text)) {
      score += 20;
    }
    
    // Good: Reasonable paragraph count
    const paraCount = this.countParagraphs(text);
    if (paraCount >= 2 && paraCount <= 6) {
      score += 10;
    }
    
    // Bad: Too many blank lines
    if ((text.match(/\n{3,}/g) || []).length > 0) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}

// Export singleton instance
export const kodaOutputStructureEngine = new KodaOutputStructureEngine();
