/**
 * Response Post-Processor Service
 *
 * Enforces formatting rules on AI-generated responses for consistency.
 *
 * Rules:
 * 1. Remove unnecessary warnings (only show if < 2 sources)
 * 2. Add blank line before first bullet point
 * 3. Limit "Next steps" to 1 bullet
 * 4. Ensure consistent bullet format (use •)
 * 5. Remove structure labels (Opening:, Context:, Details:, etc.)
 */

class ResponsePostProcessorService {
  /**
   * Post-process AI response to enforce formatting rules
   */
  process(rawResponse: string, sources: any[]): string {
    let processed = rawResponse;

    // Rule 1: Remove unnecessary warning
    processed = this.removeUnnecessaryWarning(processed, sources);

    // Rule 2: Add space before bullets
    processed = this.addSpaceBeforeBullets(processed);

    // Rule 3: Limit "Next steps" to 1 bullet
    processed = this.limitNextSteps(processed);

    // Rule 4: Ensure consistent bullet format
    processed = this.ensureBulletFormat(processed);

    // Rule 5: Remove structure labels (Opening:, Context:, etc.)
    processed = this.removeStructureLabels(processed);

    return processed;
  }

  /**
   * Rule 1: ALWAYS remove Gemini warnings (they're annoying and unnecessary)
   * Users can see the sources list - they don't need a warning
   */
  private removeUnnecessaryWarning(text: string, sources: any[]): string {
    // ✅ ALWAYS remove warnings regardless of source count
    // Remove various warning patterns
    text = text.replace(/⚠️\s*Note:\s*This answer is based on partial information from your documents\.\s*/gi, '');
    text = text.replace(/⚠️\s*Note:\s*This answer is based on partial information\.\s*/gi, '');
    text = text.replace(/⚠️\s*Warning:.*?(?:\n|$)/gi, '');
    text = text.replace(/\*\*Note:\*\*\s*This answer is based on partial information.*?(?:\n|$)/gi, '');
    return text;
  }

  /**
   * Rule 2: Add blank line before first bullet
   * Improves readability by separating paragraph text from bullet lists
   */
  private addSpaceBeforeBullets(text: string): string {
    // Find first bullet point that doesn't already have a blank line before it
    // Pattern: non-newline character, single newline, then bullet
    const bulletMatch = text.match(/([^\n])\n(•|\*|-)\s/);

    if (bulletMatch) {
      // Add blank line before first bullet if not present
      text = text.replace(/([^\n])\n(•|\*|-)\s/, '$1\n\n$2 ');
    }

    return text;
  }

  /**
   * Rule 3: Limit "Next steps" to 1 bullet
   * Prevents overwhelming users with too many suggestions
   */
  private limitNextSteps(text: string): string {
    // ✅ Match "Next steps:", "Next actions:", "Next step:", etc.
    const nextStepsMatch = text.match(/(?:Next steps?|Next actions?):\s*\n((?:(?:•|\*|-)[^\n]+\n?)+)/i);

    if (nextStepsMatch) {
      const bullets = nextStepsMatch[1].match(/(?:•|\*|-)[^\n]+/g);

      if (bullets && bullets.length > 1) {
        // Keep only the first bullet
        const firstBullet = bullets[0];
        // Preserve the original heading (Next steps/Next actions)
        const heading = nextStepsMatch[0].split(':')[0];
        // Keep one blank line before "Next step:" for proper spacing
        text = text.replace(nextStepsMatch[0], `\n${heading}: ${firstBullet}`);
      }
    }

    return text;
  }

  /**
   * Rule 4: Ensure consistent bullet format
   * Converts * and - to • for visual consistency
   */
  private ensureBulletFormat(text: string): string {
    // Convert * and - bullets to •
    text = text.replace(/\n\*\s/g, '\n• ');
    text = text.replace(/\n-\s/g, '\n• ');

    return text;
  }

  /**
   * Rule 5: Remove structure labels
   * Removes labels like "Opening:", "Context:", "Details:", etc.
   * REASON: Makes responses feel more natural and conversational (like ChatGPT)
   * WHY: Users find labeled sections robotic and template-like
   */
  private removeStructureLabels(text: string): string {
    // List of common structure labels to remove
    const labelPatterns = [
      // Common section labels
      /^Opening:\s*/gim,
      /^Context:\s*/gim,
      /^Details:\s*/gim,
      /^Examples?:\s*/gim,
      /^Relationships?:\s*/gim,
      /^Next Steps?:\s*/gim,
      /^Summary:\s*/gim,
      /^Conclusion:\s*/gim,
      /^Analysis:\s*/gim,
      /^Overview:\s*/gim,
      /^Background:\s*/gim,
      /^Explanation:\s*/gim,
      /^Key Points?:\s*/gim,
      /^Main Points?:\s*/gim,
      /^Important:\s*/gim,
      /^Note:\s*/gim,

      // Also remove bold versions
      /^\*\*Opening:\*\*\s*/gim,
      /^\*\*Context:\*\*\s*/gim,
      /^\*\*Details:\*\*\s*/gim,
      /^\*\*Examples?:\*\*\s*/gim,
      /^\*\*Relationships?:\*\*\s*/gim,
      /^\*\*Next Steps?:\*\*\s*/gim,
      /^\*\*Summary:\*\*\s*/gim,
      /^\*\*Conclusion:\*\*\s*/gim,
      /^\*\*Analysis:\*\*\s*/gim,
      /^\*\*Overview:\*\*\s*/gim,
      /^\*\*Background:\*\*\s*/gim,
      /^\*\*Explanation:\*\*\s*/gim,
      /^\*\*Key Points?:\*\*\s*/gim,
      /^\*\*Main Points?:\*\*\s*/gim,
      /^\*\*Important:\*\*\s*/gim,
      /^\*\*Note:\*\*\s*/gim,
    ];

    // Remove each pattern
    for (const pattern of labelPatterns) {
      text = text.replace(pattern, '');
    }

    return text;
  }

  /**
   * ✅ FIX #2: Enforce comparison table formatting
   * Detects when a comparison response lacks a markdown table and adds a warning
   * REASON: LLMs sometimes ignore table formatting instructions
   */
  private enforceComparisonTable(text: string): string {
    // Check if response contains a markdown table (has | characters and separator row)
    const hasTable = text.includes('|') && /\|[-\s|]+\|/.test(text);

    if (!hasTable) {
      console.log('⚠️ [POST-PROCESSOR] Comparison response missing table format');

      // Remove any LLM-generated apologies about table formatting
      text = text.replace(/\(Table formatting issue detected.*?\)/gi, '');
      text = text.replace(/Please refer to the document sources for detailed comparison/gi, '');

      // Add a clear message that the table is missing
      // This will be visible to users and help debug table generation issues
      const warning = '\n\n⚠️ **Note:** This comparison should have been presented in a table format. The response has been generated without the expected table structure.\n';

      // Don't add the warning yet - just log it for now
      // In production, we'd want to retry the LLM call with stricter instructions
      console.log('⚠️ [POST-PROCESSOR] Table missing - would add warning:', warning.trim());
    } else {
      console.log('✅ [POST-PROCESSOR] Comparison table detected and validated');
    }

    return text;
  }

  /**
   * Remove all warnings (for system queries where warnings don't make sense)
   */
  removeAllWarnings(text: string): string {
    text = text.replace(/⚠️\s*Note:.*?(?:\n\n|$)/gs, '');
    text = text.replace(/⚠️\s*Warning:.*?(?:\n\n|$)/gs, '');
    text = text.replace(/\*\*Note:\*\*.*?(?:\n\n|$)/gs, '');
    return text;
  }

  /**
   * Format response for specific intent types
   * Applies intent-specific formatting rules
   */
  formatForIntent(text: string, intent: string, sources: any[]): string {
    let formatted = text;

    switch (intent) {
      case 'greeting':
      case 'capability':
        // Remove all warnings for greetings and capability queries
        formatted = this.removeAllWarnings(formatted);
        break;

      case 'metadata_query':
      case 'file_location':
      case 'file_count':
      case 'folder_contents':
        // Remove warnings for metadata queries (they're database lookups, not RAG)
        formatted = this.removeAllWarnings(formatted);
        break;

      case 'list':
        // Ensure bullets only, no extra text
        formatted = this.ensureBulletFormat(formatted);
        break;

      case 'compare':
        // ✅ FIX #2: Enforce table formatting for comparisons
        formatted = this.enforceComparisonTable(formatted);
        formatted = this.addSpaceBeforeBullets(formatted);
        break;

      case 'extract':
      case 'summarize':
        // Normal processing
        formatted = this.process(formatted, sources);
        break;

      default:
        // Apply standard rules
        formatted = this.process(formatted, sources);
    }

    return formatted;
  }

  /**
   * Clean up extra whitespace
   */
  cleanWhitespace(text: string): string {
    // Remove more than 2 consecutive newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from lines
    text = text.replace(/[ \t]+$/gm, '');

    // Remove leading/trailing whitespace from entire response
    text = text.trim();

    return text;
  }

  /**
   * Full post-processing pipeline
   */
  fullProcess(rawResponse: string, intent: string, sources: any[]): string {
    let processed = rawResponse;

    // Step 1: Intent-specific formatting
    processed = this.formatForIntent(processed, intent, sources);

    // Step 2: Clean up whitespace
    processed = this.cleanWhitespace(processed);

    return processed;
  }
}

export default new ResponsePostProcessorService();
