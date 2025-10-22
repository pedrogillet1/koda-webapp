/**
 * Quality Monitor Service
 * Continuous monitoring of RAG system quality in production
 * Tracks latency, success rates, error rates, and quality degradation
 * Sends alerts when thresholds are exceeded
 */

interface QualityMetrics {
  // Performance metrics
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Success metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;

  // Quality metrics
  averageRelevanceScore: number;
  averageGroundingScore: number;
  averageCitationCoverage: number;
  hallucinationRate: number;

  // User feedback metrics
  thumbsUpRate: number;
  thumbsDownRate: number;

  // Resource metrics
  averageTokensUsed: number;
  totalCost: number;
}

interface QualityAlert {
  type: 'latency' | 'success_rate' | 'quality' | 'error_spike' | 'cost';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
}

interface QualityThresholds {
  maxAverageLatency: number; // ms
  minSuccessRate: number; // %
  minRelevanceScore: number; // 0-1
  minGroundingScore: number; // 0-1
  maxHallucinationRate: number; // %
  minThumbsUpRate: number; // %
  maxCostPerQuery: number; // $
}

interface PerformanceLog {
  requestId: string;
  timestamp: Date;
  userId: string;
  query: string;
  latency: number;
  success: boolean;
  error?: string;
  relevanceScore?: number;
  groundingScore?: number;
  citationCoverage?: number;
  tokensUsed: number;
  cost: number;
  metadata?: any;
}

class QualityMonitorService {
  private performanceLogs: PerformanceLog[] = [];
  private alerts: QualityAlert[] = [];

  private defaultThresholds: QualityThresholds = {
    maxAverageLatency: 5000, // 5 seconds
    minSuccessRate: 95, // 95%
    minRelevanceScore: 0.7,
    minGroundingScore: 0.8,
    maxHallucinationRate: 5, // 5%
    minThumbsUpRate: 70, // 70%
    maxCostPerQuery: 0.10 // $0.10
  };

  /**
   * Log performance metrics for a request
   */
  async logPerformance(log: PerformanceLog): Promise<void> {
    // Store in memory (in production, use database or time-series DB like InfluxDB)
    this.performanceLogs.push(log);

    // Keep only last 1000 logs in memory
    if (this.performanceLogs.length > 1000) {
      this.performanceLogs.shift();
    }

    // Check thresholds
    await this.checkThresholds();
  }

  /**
   * Get quality metrics for time range
   */
  async getMetrics(
    timeRange?: { start: Date; end: Date }
  ): Promise<QualityMetrics> {
    let logs = this.performanceLogs;

    if (timeRange) {
      logs = logs.filter(
        log => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      );
    }

    if (logs.length === 0) {
      return this.getEmptyMetrics();
    }

    // Calculate latency metrics
    const latencies = logs.map(l => l.latency).sort((a, b) => a - b);
    const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    // Calculate success metrics
    const totalRequests = logs.length;
    const successfulRequests = logs.filter(l => l.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = (successfulRequests / totalRequests) * 100;

    // Calculate quality metrics
    const relevanceScores = logs
      .filter(l => l.relevanceScore !== undefined)
      .map(l => l.relevanceScore!);
    const averageRelevanceScore =
      relevanceScores.length > 0
        ? relevanceScores.reduce((sum, s) => sum + s, 0) / relevanceScores.length
        : 0;

    const groundingScores = logs
      .filter(l => l.groundingScore !== undefined)
      .map(l => l.groundingScore!);
    const averageGroundingScore =
      groundingScores.length > 0
        ? groundingScores.reduce((sum, s) => sum + s, 0) / groundingScores.length
        : 0;

    const citationCoverages = logs
      .filter(l => l.citationCoverage !== undefined)
      .map(l => l.citationCoverage!);
    const averageCitationCoverage =
      citationCoverages.length > 0
        ? citationCoverages.reduce((sum, s) => sum + s, 0) / citationCoverages.length
        : 0;

    // Hallucination rate = requests with low grounding score
    const lowGroundingCount = logs.filter(
      l => l.groundingScore !== undefined && l.groundingScore < 0.7
    ).length;
    const hallucinationRate =
      logs.length > 0 ? (lowGroundingCount / logs.length) * 100 : 0;

    // User feedback (would integrate with FeedbackCollectorService in production)
    const thumbsUpRate = 0; // Placeholder
    const thumbsDownRate = 0; // Placeholder

    // Resource metrics
    const averageTokensUsed =
      logs.reduce((sum, l) => sum + l.tokensUsed, 0) / logs.length;
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);

    return {
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      averageRelevanceScore,
      averageGroundingScore,
      averageCitationCoverage,
      hallucinationRate,
      thumbsUpRate,
      thumbsDownRate,
      averageTokensUsed,
      totalCost
    };
  }

  /**
   * Check if metrics exceed thresholds
   */
  private async checkThresholds(
    customThresholds?: Partial<QualityThresholds>
  ): Promise<void> {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };

    // Get recent metrics (last 100 requests)
    const recentLogs = this.performanceLogs.slice(-100);
    if (recentLogs.length < 10) {
      return; // Not enough data
    }

    const metrics = await this.getMetrics();

    // Check latency
    if (metrics.averageLatency > thresholds.maxAverageLatency) {
      this.createAlert({
        type: 'latency',
        severity: 'high',
        message: `Average latency ${metrics.averageLatency.toFixed(0)}ms exceeds threshold ${thresholds.maxAverageLatency}ms`,
        metric: 'averageLatency',
        currentValue: metrics.averageLatency,
        threshold: thresholds.maxAverageLatency,
        timestamp: new Date()
      });
    }

    // Check success rate
    if (metrics.successRate < thresholds.minSuccessRate) {
      this.createAlert({
        type: 'success_rate',
        severity: 'critical',
        message: `Success rate ${metrics.successRate.toFixed(1)}% below threshold ${thresholds.minSuccessRate}%`,
        metric: 'successRate',
        currentValue: metrics.successRate,
        threshold: thresholds.minSuccessRate,
        timestamp: new Date()
      });
    }

    // Check relevance
    if (
      metrics.averageRelevanceScore > 0 &&
      metrics.averageRelevanceScore < thresholds.minRelevanceScore
    ) {
      this.createAlert({
        type: 'quality',
        severity: 'medium',
        message: `Average relevance score ${metrics.averageRelevanceScore.toFixed(2)} below threshold ${thresholds.minRelevanceScore}`,
        metric: 'averageRelevanceScore',
        currentValue: metrics.averageRelevanceScore,
        threshold: thresholds.minRelevanceScore,
        timestamp: new Date()
      });
    }

    // Check grounding
    if (
      metrics.averageGroundingScore > 0 &&
      metrics.averageGroundingScore < thresholds.minGroundingScore
    ) {
      this.createAlert({
        type: 'quality',
        severity: 'high',
        message: `Average grounding score ${metrics.averageGroundingScore.toFixed(2)} below threshold ${thresholds.minGroundingScore}`,
        metric: 'averageGroundingScore',
        currentValue: metrics.averageGroundingScore,
        threshold: thresholds.minGroundingScore,
        timestamp: new Date()
      });
    }

    // Check hallucination rate
    if (metrics.hallucinationRate > thresholds.maxHallucinationRate) {
      this.createAlert({
        type: 'quality',
        severity: 'critical',
        message: `Hallucination rate ${metrics.hallucinationRate.toFixed(1)}% exceeds threshold ${thresholds.maxHallucinationRate}%`,
        metric: 'hallucinationRate',
        currentValue: metrics.hallucinationRate,
        threshold: thresholds.maxHallucinationRate,
        timestamp: new Date()
      });
    }

    // Check cost per query
    const costPerQuery = metrics.totalCost / metrics.totalRequests;
    if (costPerQuery > thresholds.maxCostPerQuery) {
      this.createAlert({
        type: 'cost',
        severity: 'medium',
        message: `Cost per query $${costPerQuery.toFixed(4)} exceeds threshold $${thresholds.maxCostPerQuery}`,
        metric: 'costPerQuery',
        currentValue: costPerQuery,
        threshold: thresholds.maxCostPerQuery,
        timestamp: new Date()
      });
    }
  }

  /**
   * Create alert
   */
  private createAlert(alert: QualityAlert): void {
    // Avoid duplicate alerts (within 5 minutes)
    const recentSimilar = this.alerts.find(
      a =>
        a.type === alert.type &&
        a.metric === alert.metric &&
        Date.now() - a.timestamp.getTime() < 5 * 60 * 1000
    );

    if (recentSimilar) {
      return; // Already alerted recently
    }

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Log alert
    const emoji =
      alert.severity === 'critical'
        ? '🚨'
        : alert.severity === 'high'
          ? '⚠️'
          : alert.severity === 'medium'
            ? '⚡'
            : 'ℹ️';

    console.log(`${emoji} QUALITY ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // In production: send to alerting service (PagerDuty, Slack, etc.)
    // await alertingService.send(alert);
  }

  /**
   * Get recent alerts
   */
  getAlerts(
    severity?: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 10
  ): QualityAlert[] {
    let alerts = this.alerts;

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    return alerts.slice(-limit).reverse();
  }

  /**
   * Generate monitoring dashboard
   */
  async generateDashboard(
    timeRange?: { start: Date; end: Date }
  ): Promise<string> {
    const metrics = await this.getMetrics(timeRange);
    const recentAlerts = this.getAlerts(undefined, 5);

    const latencyStatus =
      metrics.averageLatency < 2000
        ? '✅ Excellent'
        : metrics.averageLatency < 5000
          ? '⚠️ Acceptable'
          : '❌ Slow';

    const successStatus =
      metrics.successRate >= 99
        ? '✅ Excellent'
        : metrics.successRate >= 95
          ? '⚠️ Good'
          : '❌ Poor';

    const qualityStatus =
      metrics.averageGroundingScore >= 0.9
        ? '✅ Excellent'
        : metrics.averageGroundingScore >= 0.8
          ? '⚠️ Good'
          : '❌ Poor';

    let dashboard = `
╔═══════════════════════════════════════════════════════╗
║          RAG SYSTEM QUALITY DASHBOARD                 ║
╠═══════════════════════════════════════════════════════╣
║ PERFORMANCE                                          ║
║   Avg Latency: ${metrics.averageLatency.toFixed(0)}ms ${latencyStatus.padEnd(30)} ║
║   P50: ${metrics.p50Latency.toFixed(0)}ms, P95: ${metrics.p95Latency.toFixed(0)}ms, P99: ${metrics.p99Latency.toFixed(0)}ms${' '.repeat(20 - metrics.p50Latency.toFixed(0).length - metrics.p95Latency.toFixed(0).length - metrics.p99Latency.toFixed(0).length)} ║
╠═══════════════════════════════════════════════════════╣
║ SUCCESS RATE                                         ║
║   Total Requests: ${metrics.totalRequests.toString().padEnd(33)} ║
║   Successful: ${metrics.successfulRequests.toString().padEnd(39)} ║
║   Failed: ${metrics.failedRequests.toString().padEnd(43)} ║
║   Success Rate: ${metrics.successRate.toFixed(1)}% ${successStatus.padEnd(28)} ║
╠═══════════════════════════════════════════════════════╣
║ QUALITY METRICS                                      ║
║   Relevance: ${(metrics.averageRelevanceScore * 100).toFixed(1)}%${' '.repeat(39)} ║
║   Grounding: ${(metrics.averageGroundingScore * 100).toFixed(1)}% ${qualityStatus.padEnd(28)} ║
║   Citation Coverage: ${(metrics.averageCitationCoverage * 100).toFixed(1)}%${' '.repeat(27)} ║
║   Hallucination Rate: ${metrics.hallucinationRate.toFixed(1)}%${' '.repeat(26)} ║
╠═══════════════════════════════════════════════════════╣
║ RESOURCES                                            ║
║   Avg Tokens: ${metrics.averageTokensUsed.toFixed(0).padEnd(38)} ║
║   Total Cost: $${metrics.totalCost.toFixed(4).padEnd(37)} ║
║   Cost/Query: $${(metrics.totalCost / metrics.totalRequests).toFixed(4).padEnd(37)} ║
╠═══════════════════════════════════════════════════════╣
║ RECENT ALERTS (${recentAlerts.length})${' '.repeat(40 - recentAlerts.length.toString().length)} ║
`;

    for (const alert of recentAlerts.slice(0, 3)) {
      const emoji =
        alert.severity === 'critical'
          ? '🚨'
          : alert.severity === 'high'
            ? '⚠️'
            : '⚡';

      const lines = this.wrapText(`${emoji} ${alert.message}`, 51);
      for (const line of lines) {
        dashboard += `║ ${line.padEnd(53)} ║\n`;
      }
    }

    dashboard += `╚═══════════════════════════════════════════════════════╝`;

    return dashboard.trim();
  }

  /**
   * Generate health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: string;
    issues: string[];
  }> {
    const metrics = await this.getMetrics();
    const issues: string[] = [];

    if (metrics.averageLatency > 5000) {
      issues.push('High latency detected');
    }

    if (metrics.successRate < 95) {
      issues.push('Low success rate');
    }

    if (metrics.averageGroundingScore < 0.8) {
      issues.push('Poor grounding quality');
    }

    if (metrics.hallucinationRate > 5) {
      issues.push('High hallucination rate');
    }

    const healthy = issues.length === 0;
    const status = healthy ? 'healthy' : 'degraded';

    return { healthy, status, issues };
  }

  /**
   * Wrap text for display
   */
  private wrapText(text: string, maxLength: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Empty metrics for initialization
   */
  private getEmptyMetrics(): QualityMetrics {
    return {
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageRelevanceScore: 0,
      averageGroundingScore: 0,
      averageCitationCoverage: 0,
      hallucinationRate: 0,
      thumbsUpRate: 0,
      thumbsDownRate: 0,
      averageTokensUsed: 0,
      totalCost: 0
    };
  }

  /**
   * Clear old logs (cleanup)
   */
  clearOldLogs(olderThanDays: number = 7): void {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const before = this.performanceLogs.length;
    this.performanceLogs = this.performanceLogs.filter(
      log => log.timestamp > cutoffDate
    );
    const after = this.performanceLogs.length;

    console.log(`🧹 Cleared ${before - after} logs older than ${olderThanDays} days`);
  }
}

export default new QualityMonitorService();
export {
  QualityMonitorService,
  QualityMetrics,
  QualityAlert,
  QualityThresholds,
  PerformanceLog
};
