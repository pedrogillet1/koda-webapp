/**
 * ============================================================================
 * LAYER 4: KODA UNIFIED POST-PROCESSOR
 * ============================================================================
 * 
 * GOAL: Final polish - guarantee markdown is never broken for frontend
 * - Strip internal artifacts
 * - Fix unbalanced markdown
 * - Normalize final whitespace
 * 
 * This is the last layer before streaming to frontend.
 * 
 * Based on Note 6 - Section 4
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  PostProcessorInput,
  PostProcessorOutput,
} from '../types';

export class KodaUnifiedPostProcessor {
  
  /**
   * MAIN ENTRY POINT
   */
  public postProcess(input: PostProcessorInput): PostProcessorOutput {
    console.log('[PostProcessor] Final polish');
    
    let text = input.formattedText;
    let artifactsRemoved = 0;
    let markdownFixed = false;
    
    // Step 1: Strip internal artifacts
    const { text: cleaned, count } = this.stripArtifacts(text);
    text = cleaned;
    artifactsRemoved = count;
    
    // Step 2: Fix unbalanced markdown
    const { text: fixed, wasFixed } = this.fixUnbalancedMarkdown(text);
    text = fixed;
    markdownFixed = wasFixed;
    
    // Step 3: Normalize final whitespace
    text = this.normalizeFinalWhitespace(text);
    
    return {
      finalText: text,
      fixes: {
        artifactsRemoved,
        markdownFixed,
        whitespaceNormalized: true,
      },
    };
  }
  
  // ==========================================================================
  // STEP 1: STRIP INTERNAL ARTIFACTS
  // ==========================================================================
  
  private stripArtifacts(text: string): { text: string; count: number } {
    let count = 0;
    
    // Remove internal tags
    const artifactPatterns = [
      /\[THINKING\][\s\S]*?\[\/THINKING\]/gi,
      /\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi,
      /\[DEBUG\][\s\S]*?\[\/DEBUG\]/gi,
      /\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi,
      /\[METADATA\][\s\S]*?\[\/METADATA\]/gi,
      /\[CONTEXT\][\s\S]*?\[\/CONTEXT\]/gi,
    ];
    
    for (const pattern of artifactPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
        text = text.replace(pattern, '');
      }
    }
    
    // Remove any remaining {{PLACEHOLDER}} style artifacts
    const placeholderPattern = /\{\{[A-Z_]+\}\}/g;
    const placeholders = text.match(placeholderPattern);
    if (placeholders) {
      count += placeholders.length;
      text = text.replace(placeholderPattern, '');
    }
    
    return { text, count };
  }
  
  // ==========================================================================
  // STEP 2: FIX UNBALANCED MARKDOWN
  // ==========================================================================
  
  private fixUnbalancedMarkdown(text: string): { text: string; wasFixed: boolean } {
    let wasFixed = false;
    
    // Fix unbalanced bold (**) 
    const boldCount = (text.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      // Odd number of ** - add one at the end
      text = text + '**';
      wasFixed = true;
    }
    
    // Fix unbalanced code fences (```)
    const fenceCount = (text.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      // Odd number of ``` - add one at the end
      text = text + '\n```';
      wasFixed = true;
    }
    
    // Fix unbalanced inline code (`)
    const lines = text.split('\n');
    const fixedLines = lines.map(line => {
      const backtickCount = (line.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        // Odd number of ` in this line - add one at the end
        wasFixed = true;
        return line + '`';
      }
      return line;
    });
    text = fixedLines.join('\n');
    
    // Normalize headings: ##Title → ## Title
    const headingPattern = /^(#{1,6})([^\s#])/gm;
    if (headingPattern.test(text)) {
      text = text.replace(headingPattern, '$1 $2');
      wasFixed = true;
    }
    
    // Ensure bullets have space: -text → - text
    const bulletPattern = /^([-*•])([^\s])/gm;
    if (bulletPattern.test(text)) {
      text = text.replace(bulletPattern, '$1 $2');
      wasFixed = true;
    }
    
    // Fix double bold markers: **** → (remove)
    if (/\*{4,}/.test(text)) {
      text = text.replace(/\*{4,}/g, '');
      wasFixed = true;
    }
    
    return { text, wasFixed };
  }
  
  // ==========================================================================
  // STEP 3: NORMALIZE FINAL WHITESPACE
  // ==========================================================================
  
  private normalizeFinalWhitespace(text: string): string {
    // CRLF → LF
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    // 3+ blank lines → 2
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Remove trailing spaces at end of each line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');
    
    // Ensure the final text ends with exactly one newline
    text = text.trim() + '\n';
    
    return text;
  }
}

// Export singleton instance
export const kodaUnifiedPostProcessor = new KodaUnifiedPostProcessor();
