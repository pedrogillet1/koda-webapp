import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * API Usage Tracking Service
 * Monitors and controls Gemini API costs
 * CRITICAL for preventing unexpected bills
 */

// Pricing (as of 2024 - update with current Gemini pricing)
const PRICING = {
  GEMINI_INPUT_PER_1K_TOKENS: 0.00025,   // $0.25 per 1M tokens
  GEMINI_OUTPUT_PER_1K_TOKENS: 0.00050,  // $0.50 per 1M tokens
  EMBEDDING_PER_1K_TOKENS: 0.00001,      // $0.01 per 1M tokens
};

interface UsageData {
  geminiInputTokens?: number;
  geminiOutputTokens?: number;
  embeddingTokens?: number;
}

class APIUsageService {
  /**
   * Track API usage for a user
   */
  async trackUsage(userId: string, data: UsageData): Promise<void> {
    try {
      const month = this.getCurrentMonth();

      // Calculate cost
      const cost = this.calculateCost(data);

      // Get or create usage record
      let usage = await prisma.aPIUsage.findUnique({
        where: {
          userId_month: {
            userId,
            month,
          },
        },
      });

      if (!usage) {
        usage = await prisma.aPIUsage.create({
          data: {
            userId,
            month,
            geminiTokensUsed: 0,
            embeddingRequests: 0,
            chatRequests: 0,
            costUSD: 0,
          },
        });
      }

      // Update usage
      await prisma.aPIUsage.update({
        where: { id: usage.id },
        data: {
          geminiTokensUsed: {
            increment: (data.geminiInputTokens || 0) + (data.geminiOutputTokens || 0),
          },
          embeddingRequests: {
            increment: data.embeddingTokens ? 1 : 0,
          },
          chatRequests: {
            increment: data.geminiInputTokens ? 1 : 0,
          },
          costUSD: {
            increment: cost,
          },
        },
      });

      console.log(`💰 API Usage tracked: User ${userId}, Cost: $${cost.toFixed(4)}`);
    } catch (error) {
      console.error('Error tracking API usage:', error);
      // Don't throw - tracking should never break the app
    }
  }

  /**
   * Check if user has exceeded their usage limit
   */
  async checkLimit(userId: string, subscriptionTier: string): Promise<{
    allowed: boolean;
    usage: number;
    limit: number;
    costUSD: number;
  }> {
    const month = this.getCurrentMonth();
    const usage = await prisma.aPIUsage.findUnique({
      where: {
        userId_month: {
          userId,
          month,
        },
      },
    });

    const limits = this.getLimitsByTier(subscriptionTier);
    const currentUsage = usage?.geminiTokensUsed || 0;

    return {
      allowed: currentUsage < limits.monthlyTokens,
      usage: currentUsage,
      limit: limits.monthlyTokens,
      costUSD: usage?.costUSD || 0,
    };
  }

  /**
   * Get usage summary for a user
   */
  async getUserUsage(userId: string, months: number = 3) {
    const monthStrings = this.getRecentMonths(months);

    const usageData = await prisma.aPIUsage.findMany({
      where: {
        userId,
        month: {
          in: monthStrings,
        },
      },
      orderBy: {
        month: 'desc',
      },
    });

    return {
      history: usageData,
      totalCost: usageData.reduce((sum, u) => sum + u.costUSD, 0),
      totalTokens: usageData.reduce((sum, u) => sum + u.geminiTokensUsed, 0),
      totalRequests: usageData.reduce((sum, u) => sum + u.chatRequests, 0),
    };
  }

  /**
   * Get system-wide usage stats (admin only)
   */
  async getSystemUsage(month?: string) {
    const targetMonth = month || this.getCurrentMonth();

    const usage = await prisma.aPIUsage.findMany({
      where: { month: targetMonth },
    });

    return {
      month: targetMonth,
      totalUsers: usage.length,
      totalCost: usage.reduce((sum, u) => sum + u.costUSD, 0),
      totalTokens: usage.reduce((sum, u) => sum + u.geminiTokensUsed, 0),
      totalRequests: usage.reduce((sum, u) => sum + u.chatRequests, 0),
      averageCostPerUser: usage.length > 0
        ? usage.reduce((sum, u) => sum + u.costUSD, 0) / usage.length
        : 0,
    };
  }

  /**
   * Calculate cost from usage data
   */
  private calculateCost(data: UsageData): number {
    let cost = 0;

    if (data.geminiInputTokens) {
      cost += (data.geminiInputTokens / 1000) * PRICING.GEMINI_INPUT_PER_1K_TOKENS;
    }

    if (data.geminiOutputTokens) {
      cost += (data.geminiOutputTokens / 1000) * PRICING.GEMINI_OUTPUT_PER_1K_TOKENS;
    }

    if (data.embeddingTokens) {
      cost += (data.embeddingTokens / 1000) * PRICING.EMBEDDING_PER_1K_TOKENS;
    }

    return cost;
  }

  /**
   * Get usage limits by subscription tier
   */
  private getLimitsByTier(tier: string) {
    const limits: Record<string, { monthlyTokens: number; costLimit: number }> = {
      free: {
        monthlyTokens: 100_000,      // 100K tokens (~$25 worth)
        costLimit: 25,
      },
      personal: {
        monthlyTokens: 500_000,      // 500K tokens (~$125 worth)
        costLimit: 125,
      },
      premium: {
        monthlyTokens: 2_000_000,    // 2M tokens (~$500 worth)
        costLimit: 500,
      },
      business: {
        monthlyTokens: 10_000_000,   // 10M tokens (~$2500 worth)
        costLimit: 2500,
      },
    };

    return limits[tier] || limits.free;
  }

  /**
   * Get current month string (format: "2024-01")
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get recent month strings
   */
  private getRecentMonths(count: number): string[] {
    const months: string[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    return months;
  }

  /**
   * Send warning notification when approaching limit
   */
  async checkAndWarnUsage(userId: string, subscriptionTier: string): Promise<void> {
    const { allowed, usage, limit, costUSD } = await this.checkLimit(userId, subscriptionTier);
    const usagePercentage = (usage / limit) * 100;

    // Warn at 80% and 95%
    if (usagePercentage >= 95 && allowed) {
      await this.sendUsageWarning(userId, usagePercentage, costUSD, 'critical');
    } else if (usagePercentage >= 80 && usagePercentage < 95 && allowed) {
      await this.sendUsageWarning(userId, usagePercentage, costUSD, 'warning');
    }
  }

  /**
   * Send usage warning notification
   */
  private async sendUsageWarning(
    userId: string,
    percentage: number,
    cost: number,
    severity: 'warning' | 'critical'
  ): Promise<void> {
    try {
      const title = severity === 'critical'
        ? 'API Usage Limit Almost Reached'
        : 'High API Usage Detected';

      const message = `You've used ${percentage.toFixed(1)}% of your monthly API quota (${cost.toFixed(2)} USD). Consider upgrading your plan to avoid interruptions.`;

      // Get user info for email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, subscriptionTier: true },
      });

      if (!user) {
        console.error('User not found for usage warning');
        return;
      }

      // Create in-app notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'system',
          title,
          message,
          isRead: false,
        },
      });

      // Send email notification
      const { sendUsageLimitWarning } = await import('./email.service');
      await sendUsageLimitWarning(user.email, percentage, cost, user.subscriptionTier);

      console.log(`⚠️  Usage warning sent to user ${userId}: ${percentage.toFixed(1)}%`);
    } catch (error) {
      console.error('Error sending usage warning:', error);
    }
  }
}

export default new APIUsageService();
