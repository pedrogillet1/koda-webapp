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

    return processed;
  }

  /**
   * Rule 1: Remove warning if we have enough sources
   * Only show warning if < 2 sources (meaning very limited information)
   */
  private removeUnnecessaryWarning(text: string, sources: any[]): string {
    // Only show warning if we have very few sources
    if (sources.length >= 2) {
      // Remove various warning patterns
      text = text.replace(/⚠️\s*Note:\s*This answer is based on partial information from your documents\.\s*/gi, '');
      text = text.replace(/⚠️\s*Warning:.*?(?:\n|$)/gi, '');
      text = text.replace(/\*\*Note:\*\*\s*This answer is based on partial information.*?(?:\n|$)/gi, '');
    }
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
    // Find "Next steps:" section with multiple bullets
    const nextStepsMatch = text.match(/Next steps?:\s*\n((?:(?:•|\*|-)[^\n]+\n?)+)/i);

    if (nextStepsMatch) {
      const bullets = nextStepsMatch[1].match(/(?:•|\*|-)[^\n]+/g);

      if (bullets && bullets.length > 1) {
        // Keep only the first bullet
        const firstBullet = bullets[0];
        text = text.replace(nextStepsMatch[0], `Next steps:\n${firstBullet}\n`);
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
        // Comparisons should have proper spacing
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
