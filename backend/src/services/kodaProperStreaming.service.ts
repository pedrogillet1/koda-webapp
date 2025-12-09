/**
 * Koda Proper Streaming Service
 *
 * Handles Server-Sent Events (SSE) streaming for chat responses.
 * Provides smooth, character-by-character streaming with proper
 * event formatting and connection management.
 *
 * @version 1.0.0
 */

import type { Response } from 'express';

// ═══════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface StreamingConfig {
  chunkSize: number;           // Characters per chunk
  delayBetweenChunks: number;  // Milliseconds between chunks
  enableHeartbeat: boolean;    // Send keep-alive pings
  heartbeatInterval: number;   // Milliseconds between heartbeats
}

export interface StreamEvent {
  type: 'start' | 'chunk' | 'end' | 'error' | 'metadata' | 'heartbeat';
  data: unknown;
  timestamp: number;
}

export interface StreamMetadata {
  messageId?: string;
  conversationId?: string;
  intent?: string;
  isFastPath?: boolean;
  processingTimeMs?: number;
  cached?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: StreamingConfig = {
  chunkSize: 3,              // 3 characters at a time for smooth effect
  delayBetweenChunks: 15,    // 15ms delay = ~200 chars/second
  enableHeartbeat: true,
  heartbeatInterval: 15000,  // 15 seconds
};

// ═══════════════════════════════════════════════════════════════════════════
// SSE Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format data as SSE event
 */
function formatSSE(event: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${event}\ndata: ${jsonData}\n\n`;
}

/**
 * Setup SSE headers
 */
export function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
}

/**
 * Send SSE event
 */
export function sendSSEEvent(
  res: Response,
  event: string,
  data: unknown
): boolean {
  try {
    if (res.writableEnded) return false;
    res.write(formatSSE(event, data));
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Stream Controller Class
// ═══════════════════════════════════════════════════════════════════════════

export class StreamController {
  private res: Response;
  private config: StreamingConfig;
  private isActive: boolean = true;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startTime: number;
  private chunksSent: number = 0;
  private totalCharsSent: number = 0;

  constructor(res: Response, config: Partial<StreamingConfig> = {}) {
    this.res = res;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();

    // Setup SSE
    setupSSEHeaders(this.res);

    // Start heartbeat if enabled
    if (this.config.enableHeartbeat) {
      this.startHeartbeat();
    }

    // Handle client disconnect
    this.res.on('close', () => {
      this.cleanup();
    });
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isActive) {
        this.sendEvent('heartbeat', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isActive = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Check if stream is still active
   */
  isStreamActive(): boolean {
    return this.isActive && !this.res.writableEnded;
  }

  /**
   * Send a stream event
   */
  sendEvent(event: string, data: unknown): boolean {
    if (!this.isStreamActive()) return false;
    return sendSSEEvent(this.res, event, data);
  }

  /**
   * Send start event with metadata
   */
  sendStart(metadata: StreamMetadata = {}): boolean {
    return this.sendEvent('start', {
      ...metadata,
      timestamp: Date.now(),
    });
  }

  /**
   * Send a text chunk
   */
  sendChunk(text: string): boolean {
    if (!this.isStreamActive()) return false;

    this.chunksSent++;
    this.totalCharsSent += text.length;

    return this.sendEvent('chunk', {
      content: text,
      chunkIndex: this.chunksSent,
    });
  }

  /**
   * Send end event
   */
  sendEnd(metadata: StreamMetadata = {}): boolean {
    const result = this.sendEvent('end', {
      ...metadata,
      totalChunks: this.chunksSent,
      totalChars: this.totalCharsSent,
      processingTimeMs: Date.now() - this.startTime,
      timestamp: Date.now(),
    });

    this.cleanup();
    return result;
  }

  /**
   * Send error event
   */
  sendError(error: string, code?: string): boolean {
    const result = this.sendEvent('error', {
      error,
      code,
      timestamp: Date.now(),
    });

    this.cleanup();
    return result;
  }

  /**
   * Stream a complete response with typing effect
   */
  async streamResponse(
    text: string,
    metadata: StreamMetadata = {}
  ): Promise<void> {
    if (!this.isStreamActive()) return;

    // Send start event
    this.sendStart(metadata);

    // Stream text in chunks
    const { chunkSize, delayBetweenChunks } = this.config;

    for (let i = 0; i < text.length; i += chunkSize) {
      if (!this.isStreamActive()) break;

      const chunk = text.slice(i, i + chunkSize);
      this.sendChunk(chunk);

      // Small delay for typing effect
      if (delayBetweenChunks > 0 && i + chunkSize < text.length) {
        await this.delay(delayBetweenChunks);
      }
    }

    // Send end event
    this.sendEnd(metadata);
  }

  /**
   * Stream response instantly (no typing effect)
   */
  streamInstant(text: string, metadata: StreamMetadata = {}): void {
    if (!this.isStreamActive()) return;

    this.sendStart(metadata);
    this.sendChunk(text);
    this.sendEnd(metadata);
  }

  /**
   * End the stream and close connection
   */
  close(): void {
    if (this.isStreamActive()) {
      this.res.end();
    }
    this.cleanup();
  }

  /**
   * Helper: delay for ms
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get streaming stats
   */
  getStats() {
    return {
      chunksSent: this.chunksSent,
      totalCharsSent: this.totalCharsSent,
      elapsedTimeMs: Date.now() - this.startTime,
      isActive: this.isActive,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a stream controller for a response
 */
export function createStreamController(
  res: Response,
  config?: Partial<StreamingConfig>
): StreamController {
  return new StreamController(res, config);
}

/**
 * Stream a fast-path response
 */
export async function streamFastPathResponse(
  res: Response,
  text: string,
  metadata: StreamMetadata
): Promise<void> {
  const controller = new StreamController(res, {
    chunkSize: 5,           // Slightly larger chunks for fast responses
    delayBetweenChunks: 10, // Faster streaming
  });

  await controller.streamResponse(text, {
    ...metadata,
    isFastPath: true,
  });

  controller.close();
}

/**
 * Stream a RAG response (slower, more deliberate)
 */
export async function streamRAGResponse(
  res: Response,
  text: string,
  metadata: StreamMetadata
): Promise<void> {
  const controller = new StreamController(res, {
    chunkSize: 3,           // Smaller chunks for RAG
    delayBetweenChunks: 20, // Slower for "thinking" effect
  });

  await controller.streamResponse(text, {
    ...metadata,
    isFastPath: false,
  });

  controller.close();
}

/**
 * Send instant response (no streaming)
 */
export function sendInstantResponse(
  res: Response,
  text: string,
  metadata: StreamMetadata
): void {
  const controller = new StreamController(res);
  controller.streamInstant(text, metadata);
  controller.close();
}

/**
 * Stream from an async generator (for LLM streaming)
 */
export async function streamFromGenerator(
  res: Response,
  generator: AsyncGenerator<string, void, unknown>,
  metadata: StreamMetadata
): Promise<void> {
  const controller = new StreamController(res, {
    chunkSize: 1,            // Stream each token as it comes
    delayBetweenChunks: 0,   // No delay - LLM provides pacing
  });

  controller.sendStart(metadata);

  try {
    for await (const chunk of generator) {
      if (!controller.isStreamActive()) break;
      controller.sendChunk(chunk);
    }

    controller.sendEnd(metadata);
  } catch (error) {
    controller.sendError(
      error instanceof Error ? error.message : 'Stream error',
      'STREAM_ERROR'
    );
  }

  controller.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export default {
  StreamController,
  createStreamController,
  streamFastPathResponse,
  streamRAGResponse,
  sendInstantResponse,
  streamFromGenerator,
  setupSSEHeaders,
  sendSSEEvent,
};
