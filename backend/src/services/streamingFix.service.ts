/**
 * ============================================================================
 * STREAMING FIX SERVICE
 * ============================================================================
 *
 * Memory Engine 3.0 - Fixes streaming response issues
 *
 * Problems Fixed:
 * 1. UTF-8 character corruption (multi-byte chars split across chunks)
 * 2. Response truncation (incomplete responses)
 * 3. Buffer handling for SSE streaming
 *
 * How it works:
 * - Buffers incomplete UTF-8 sequences
 * - Validates complete chunks before sending
 * - Handles SSE format properly
 */

import { Transform, TransformCallback } from 'stream';

// ============================================================================
// UTF-8 STREAMING TRANSFORMER
// ============================================================================

/**
 * Transform stream that ensures UTF-8 characters are not split across chunks
 */
export class UTF8StreamTransformer extends Transform {
  private incompleteBuffer: Buffer = Buffer.alloc(0);

  constructor() {
    super({ encoding: 'utf8' });
  }

  _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      // Convert to buffer if string
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);

      // Combine with any incomplete bytes from previous chunk
      const combined = Buffer.concat([this.incompleteBuffer, buffer]);

      // Find the last complete UTF-8 sequence
      let lastCompleteIndex = combined.length;

      // Check for incomplete multi-byte sequences at the end
      for (let i = combined.length - 1; i >= Math.max(0, combined.length - 4); i--) {
        const byte = combined[i];

        // Check if this is a leading byte of a multi-byte sequence
        if ((byte & 0x80) === 0) {
          // ASCII character - complete
          break;
        } else if ((byte & 0xC0) === 0xC0) {
          // Leading byte found - check if sequence is complete
          const expectedLength = this.getUTF8SequenceLength(byte);
          const actualLength = combined.length - i;

          if (actualLength < expectedLength) {
            // Incomplete sequence - save for next chunk
            lastCompleteIndex = i;
          }
          break;
        }
        // Continuation byte - keep looking for leading byte
      }

      // Push complete portion
      if (lastCompleteIndex > 0) {
        const completeChunk = combined.slice(0, lastCompleteIndex);
        this.push(completeChunk.toString('utf8'));
      }

      // Save incomplete portion
      this.incompleteBuffer = combined.slice(lastCompleteIndex);

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    // Push any remaining bytes (may be incomplete - best effort)
    if (this.incompleteBuffer.length > 0) {
      try {
        this.push(this.incompleteBuffer.toString('utf8'));
      } catch (e) {
        // Ignore encoding errors on final flush
      }
    }
    callback();
  }

  private getUTF8SequenceLength(leadingByte: number): number {
    if ((leadingByte & 0x80) === 0) return 1;      // 0xxxxxxx
    if ((leadingByte & 0xE0) === 0xC0) return 2;   // 110xxxxx
    if ((leadingByte & 0xF0) === 0xE0) return 3;   // 1110xxxx
    if ((leadingByte & 0xF8) === 0xF0) return 4;   // 11110xxx
    return 1; // Invalid - treat as single byte
  }
}

// ============================================================================
// SSE RESPONSE BUILDER
// ============================================================================

/**
 * Builds properly formatted SSE (Server-Sent Events) responses
 */
export class SSEResponseBuilder {
  private buffer: string = '';
  private isComplete: boolean = false;

  /**
   * Add a chunk to the response
   */
  addChunk(chunk: string): string {
    this.buffer += chunk;
    return this.formatSSEChunk(chunk);
  }

  /**
   * Format a chunk for SSE
   */
  formatSSEChunk(chunk: string, eventType: string = 'chunk'): string {
    const data = JSON.stringify({ type: eventType, content: chunk });
    return `data: ${data}\n\n`;
  }

  /**
   * Format a complete event
   */
  formatSSEEvent(type: string, data: any): string {
    return `data: ${JSON.stringify({ type, ...data })}\n\n`;
  }

  /**
   * Get the complete response
   */
  getComplete(): string {
    this.isComplete = true;
    return this.buffer;
  }

  /**
   * Mark as complete and return final SSE event
   */
  finalize(): string {
    this.isComplete = true;
    return this.formatSSEEvent('done', { content: this.buffer });
  }

  /**
   * Check if response is complete
   */
  get completed(): boolean {
    return this.isComplete;
  }

  /**
   * Get current buffer length
   */
  get length(): number {
    return this.buffer.length;
  }
}

// ============================================================================
// RESPONSE VALIDATOR
// ============================================================================

/**
 * Validates that a streaming response is complete and not truncated
 */
export class ResponseValidator {
  /**
   * Check if a response appears to be truncated
   */
  static isTruncated(response: string): boolean {
    if (!response || response.length === 0) return true;

    const trimmed = response.trim();

    // Check for incomplete sentences (ends mid-word)
    if (/\w$/.test(trimmed) && !trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?')) {
      // Could be truncated, but might just be a fragment
      // Check if it's very short
      if (trimmed.length < 50) return false;

      // Check for incomplete markdown
      const openBrackets = (trimmed.match(/\[/g) || []).length;
      const closeBrackets = (trimmed.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) return true;

      // Check for incomplete code blocks
      const codeBlocks = (trimmed.match(/```/g) || []).length;
      if (codeBlocks % 2 !== 0) return true;
    }

    return false;
  }

  /**
   * Check if response starts mid-sentence (indicating missing beginning)
   */
  static hasIncompleteStart(response: string): boolean {
    if (!response) return false;

    const trimmed = response.trim();

    // Starts with lowercase (likely mid-sentence)
    if (/^[a-z]/.test(trimmed)) {
      // But allow common lowercase starters
      const validStarters = ['i ', 'i\'', 'a ', 'an '];
      if (!validStarters.some(s => trimmed.toLowerCase().startsWith(s))) {
        return true;
      }
    }

    // Starts with continuation words
    const continuationWords = ['and ', 'but ', 'or ', 'with ', 'for '];
    if (continuationWords.some(w => trimmed.toLowerCase().startsWith(w))) {
      return true;
    }

    return false;
  }

  /**
   * Attempt to fix a truncated response
   */
  static fixTruncated(response: string): string {
    let fixed = response;

    // Close unclosed code blocks
    const codeBlocks = (fixed.match(/```/g) || []).length;
    if (codeBlocks % 2 !== 0) {
      fixed += '\n```';
    }

    // Close unclosed brackets
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      fixed += ']'.repeat(openBrackets - closeBrackets);
    }

    return fixed;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Create singleton instances
export const utf8Transformer = new UTF8StreamTransformer();

export default {
  UTF8StreamTransformer,
  SSEResponseBuilder,
  ResponseValidator,
};
