/**
 * Status Emitter Service
 *
 * Emits real-time status updates during RAG processing.
 * Inspired by Manus's progressive status updates.
 *
 * Impact: Users never see blank screen, understand what's happening
 */

export enum ProcessingStage {
  ANALYZING = 'analyzing',
  SEARCHING = 'searching',
  RETRIEVING = 'retrieving',
  GENERATING = 'generating',
  COMPLETE = 'complete',
}

export interface StatusUpdate {
  stage: ProcessingStage;
  message: string;
  progress?: number; // 0-100
  metadata?: any;
}

export type StatusCallback = (update: StatusUpdate) => void;

class StatusEmitterService {
  /**
   * Emit status update with standardized messaging
   *
   * @param callback - Callback function to send status to client
   * @param stage - Current processing stage
   * @param metadata - Optional metadata (e.g., chunk count)
   */
  emit(callback: StatusCallback | undefined, stage: ProcessingStage, metadata?: any): void {
    if (!callback) return;

    const update = this.buildStatusUpdate(stage, metadata);
    callback(update);
  }

  /**
   * Build status update with user-friendly message
   *
   * Messages are designed to be:
   * - Informative (tell user what's happening)
   * - Reassuring (system is working)
   * - Professional (no emoji, clean language)
   */
  private buildStatusUpdate(stage: ProcessingStage, metadata?: any): StatusUpdate {
    switch (stage) {
      case ProcessingStage.ANALYZING:
        return {
          stage,
          message: 'Understanding your question...',
          progress: 10,
        };

      case ProcessingStage.SEARCHING:
        return {
          stage,
          message: 'Searching your documents...',
          progress: 30,
        };

      case ProcessingStage.RETRIEVING:
        const chunkCount = metadata?.chunkCount || 0;
        return {
          stage,
          message: chunkCount > 0
            ? `Found ${chunkCount} relevant sections...`
            : 'Retrieving relevant content...',
          progress: 60,
          metadata,
        };

      case ProcessingStage.GENERATING:
        return {
          stage,
          message: 'Generating answer...',
          progress: 80,
        };

      case ProcessingStage.COMPLETE:
        return {
          stage,
          message: 'Complete',
          progress: 100,
        };

      default:
        return {
          stage,
          message: 'Processing...',
          progress: 0,
        };
    }
  }

  /**
   * Emit custom status message
   * For special cases not covered by standard stages
   */
  emitCustom(callback: StatusCallback | undefined, message: string, progress?: number): void {
    if (!callback) return;

    callback({
      stage: ProcessingStage.ANALYZING,
      message,
      progress,
    });
  }
}

export default new StatusEmitterService();
