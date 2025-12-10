/**
 * Performance Tracker Service - A+ Implementation
 * Tracks performance metrics for RAG pipeline stages
 *
 * Features:
 * - High-resolution timing (performance.now())
 * - Structured metrics output
 * - Easy to use start/end methods
 * - Automatic total calculation
 */

import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  stage: string;
  durationMs: number;
}

export class PerformanceTracker {
  private timings: PerformanceMetric[] = [];
  private stageStarts: Map<string, number> = new Map();
  private totalStartTime: number;

  constructor() {
    this.totalStartTime = performance.now();
  }

  /**
   * Start tracking a performance stage
   */
  start(stage: string): void {
    this.stageStarts.set(stage, performance.now());
  }

  /**
   * End tracking a performance stage
   */
  end(stage: string): number {
    const startTime = this.stageStarts.get(stage);
    if (startTime === undefined) {
      // Silently fail - don't crash for performance tracking
      return 0;
    }

    const durationMs = performance.now() - startTime;
    this.timings.push({ stage, durationMs });
    this.stageStarts.delete(stage);

    return durationMs;
  }

  /**
   * Get all performance metrics
   */
  getMetrics(): { metrics: PerformanceMetric[]; totalDurationMs: number } {
    const totalDurationMs = performance.now() - this.totalStartTime;
    return {
      metrics: this.timings.sort((a, b) => b.durationMs - a.durationMs),
      totalDurationMs,
    };
  }

  /**
   * Get a summary of performance metrics
   */
  getSummary(): string {
    const { metrics, totalDurationMs } = this.getMetrics();

    let summary = `Total duration: ${totalDurationMs.toFixed(2)}ms\n`;
    summary += '------------------------------------\n';

    metrics.forEach(({ stage, durationMs }) => {
      const percentage = (durationMs / totalDurationMs) * 100;
      summary += `${stage.padEnd(20)}: ${durationMs.toFixed(2).padStart(8)}ms (${percentage.toFixed(1)}%)\n`;
    });

    return summary;
  }
}
