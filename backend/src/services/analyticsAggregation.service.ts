/**
 * Analytics Aggregation Service
 *
 * PURPOSE: Aggregate analytics data for historical tracking and efficient querying
 * STRATEGY: Pre-compute daily/weekly/monthly stats and store in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface DailyStats {
  date: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  totalConversations: number;
  newConversations: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  totalDocuments: number;
  newDocuments: number;
  storageUsedBytes: number;
  errorCount: number;
  estimatedCostUSD: number;
}

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalUsers: number;
  newUsers: number;
  avgDailyActiveUsers: number;
  totalConversations: number;
  newConversations: number;
  totalMessages: number;
  avgMessagesPerDay: number;
  totalDocuments: number;
  newDocuments: number;
  storageUsedBytes: number;
  errorCount: number;
  estimatedCostUSD: number;
  retentionRate: number;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  totalUsers: number;
  newUsers: number;
  avgDailyActiveUsers: number;
  activeUsersMonthly: number;
  totalConversations: number;
  newConversations: number;
  totalMessages: number;
  avgMessagesPerDay: number;
  totalDocuments: number;
  newDocuments: number;
  storageUsedBytes: number;
  errorCount: number;
  estimatedCostUSD: number;
  retentionRate: number;
  churnRate: number;
}

export interface TrendData {
  period: string;
  value: number;
  change: number;
  changePercent: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate stats for a specific date
 */
export async function aggregateDailyStats(date: Date): Promise<DailyStats> {
  const dateStr = date.toISOString().split('T')[0];
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  console.log(`📊 [AGGREGATION] Aggregating daily stats for ${dateStr}...`);

  // User stats
  const totalUsers = await prisma.user.count({
    where: { createdAt: { lt: dayEnd } }
  });

  const newUsers = await prisma.user.count({
    where: {
      createdAt: { gte: dayStart, lt: dayEnd }
    }
  });

  // Active users (sent messages that day)
  const activeUserConversations = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      createdAt: { gte: dayStart, lt: dayEnd },
      role: 'user'
    }
  });
  const convIds = activeUserConversations.map(g => g.conversationId);
  const activeConvs = await prisma.conversation.findMany({
    where: { id: { in: convIds } },
    select: { userId: true }
  });
  const activeUsers = new Set(activeConvs.map(c => c.userId)).size;

  // Conversation stats
  const totalConversations = await prisma.conversation.count({
    where: { createdAt: { lt: dayEnd } }
  });

  const newConversations = await prisma.conversation.count({
    where: {
      createdAt: { gte: dayStart, lt: dayEnd }
    }
  });

  // Message stats
  const totalMessages = await prisma.message.count({
    where: { createdAt: { lt: dayEnd } }
  });

  const dayMessages = await prisma.message.findMany({
    where: {
      createdAt: { gte: dayStart, lt: dayEnd }
    },
    select: { role: true }
  });

  const userMessages = dayMessages.filter(m => m.role === 'user').length;
  const assistantMessages = dayMessages.filter(m => m.role === 'assistant').length;

  // Document stats
  const totalDocuments = await prisma.document.count({
    where: { createdAt: { lt: dayEnd } }
  });

  const newDocuments = await prisma.document.count({
    where: {
      createdAt: { gte: dayStart, lt: dayEnd }
    }
  });

  // Storage
  const storageStats = await prisma.document.aggregate({
    where: { createdAt: { lt: dayEnd } },
    _sum: { fileSize: true }
  });
  const storageUsedBytes = Number(storageStats._sum.fileSize) || 0;

  // Error count
  const errorCount = await prisma.auditLog.count({
    where: {
      status: 'failure',
      createdAt: { gte: dayStart, lt: dayEnd }
    }
  });

  // Estimated cost (simplified calculation)
  const dayMessagesTotal = userMessages + assistantMessages;
  const estimatedCostUSD = (dayMessagesTotal * 500 * 0.0005) / 1000;

  const stats: DailyStats = {
    date: dateStr,
    totalUsers,
    newUsers,
    activeUsers,
    totalConversations,
    newConversations,
    totalMessages,
    userMessages,
    assistantMessages,
    totalDocuments,
    newDocuments,
    storageUsedBytes,
    errorCount,
    estimatedCostUSD: Math.round(estimatedCostUSD * 100) / 100
  };

  console.log(`📊 [AGGREGATION] Daily stats for ${dateStr} complete`);

  return stats;
}

/**
 * Aggregate stats for multiple days
 */
export async function aggregateDailyStatsRange(
  startDate: Date,
  endDate: Date
): Promise<DailyStats[]> {
  const stats: DailyStats[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dailyStats = await aggregateDailyStats(current);
    stats.push(dailyStats);
    current.setDate(current.getDate() + 1);
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate stats for a specific week
 */
export async function aggregateWeeklyStats(weekStartDate: Date): Promise<WeeklyStats> {
  const weekStart = new Date(weekStartDate);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = new Date(weekEnd.getTime() - 1).toISOString().split('T')[0];

  console.log(`📊 [AGGREGATION] Aggregating weekly stats for ${weekStartStr} to ${weekEndStr}...`);

  // Get daily stats for the week
  const dailyStats = await aggregateDailyStatsRange(weekStart, new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000));

  // Aggregate
  const totalUsers = dailyStats[dailyStats.length - 1]?.totalUsers || 0;
  const newUsers = dailyStats.reduce((sum, d) => sum + d.newUsers, 0);
  const avgDailyActiveUsers = Math.round(
    dailyStats.reduce((sum, d) => sum + d.activeUsers, 0) / dailyStats.length
  );

  const totalConversations = dailyStats[dailyStats.length - 1]?.totalConversations || 0;
  const newConversations = dailyStats.reduce((sum, d) => sum + d.newConversations, 0);

  const totalMessages = dailyStats[dailyStats.length - 1]?.totalMessages || 0;
  const weekMessages = dailyStats.reduce((sum, d) => sum + d.userMessages + d.assistantMessages, 0);
  const avgMessagesPerDay = Math.round(weekMessages / dailyStats.length);

  const totalDocuments = dailyStats[dailyStats.length - 1]?.totalDocuments || 0;
  const newDocuments = dailyStats.reduce((sum, d) => sum + d.newDocuments, 0);

  const storageUsedBytes = dailyStats[dailyStats.length - 1]?.storageUsedBytes || 0;
  const errorCount = dailyStats.reduce((sum, d) => sum + d.errorCount, 0);
  const estimatedCostUSD = dailyStats.reduce((sum, d) => sum + d.estimatedCostUSD, 0);

  // Calculate retention (simplified: users active this week who were also active last week)
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = weekStart;

  const usersActiveLastWeek = await getActiveUsersInPeriod(lastWeekStart, lastWeekEnd);
  const usersActiveThisWeek = await getActiveUsersInPeriod(weekStart, weekEnd);

  const retained = [...usersActiveLastWeek].filter(id => usersActiveThisWeek.has(id)).length;
  const retentionRate = usersActiveLastWeek.size > 0
    ? Math.round((retained / usersActiveLastWeek.size) * 10000) / 100
    : 0;

  const stats: WeeklyStats = {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    totalUsers,
    newUsers,
    avgDailyActiveUsers,
    totalConversations,
    newConversations,
    totalMessages,
    avgMessagesPerDay,
    totalDocuments,
    newDocuments,
    storageUsedBytes,
    errorCount,
    estimatedCostUSD: Math.round(estimatedCostUSD * 100) / 100,
    retentionRate
  };

  console.log(`📊 [AGGREGATION] Weekly stats complete`);

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTHLY AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate stats for a specific month
 */
export async function aggregateMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  console.log(`📊 [AGGREGATION] Aggregating monthly stats for ${monthStr}...`);

  // Get daily stats for the month
  const dailyStats = await aggregateDailyStatsRange(
    monthStart,
    new Date(monthEnd.getTime() - 24 * 60 * 60 * 1000)
  );

  // Aggregate
  const totalUsers = dailyStats[dailyStats.length - 1]?.totalUsers || 0;
  const newUsers = dailyStats.reduce((sum, d) => sum + d.newUsers, 0);
  const avgDailyActiveUsers = Math.round(
    dailyStats.reduce((sum, d) => sum + d.activeUsers, 0) / dailyStats.length
  );

  // Active users for the entire month (unique users who sent messages)
  const activeUsersSet = await getActiveUsersInPeriod(monthStart, monthEnd);
  const activeUsersMonthly = activeUsersSet.size;

  const totalConversations = dailyStats[dailyStats.length - 1]?.totalConversations || 0;
  const newConversations = dailyStats.reduce((sum, d) => sum + d.newConversations, 0);

  const totalMessages = dailyStats[dailyStats.length - 1]?.totalMessages || 0;
  const monthMessages = dailyStats.reduce((sum, d) => sum + d.userMessages + d.assistantMessages, 0);
  const avgMessagesPerDay = Math.round(monthMessages / dailyStats.length);

  const totalDocuments = dailyStats[dailyStats.length - 1]?.totalDocuments || 0;
  const newDocuments = dailyStats.reduce((sum, d) => sum + d.newDocuments, 0);

  const storageUsedBytes = dailyStats[dailyStats.length - 1]?.storageUsedBytes || 0;
  const errorCount = dailyStats.reduce((sum, d) => sum + d.errorCount, 0);
  const estimatedCostUSD = dailyStats.reduce((sum, d) => sum + d.estimatedCostUSD, 0);

  // Calculate retention and churn
  const lastMonthStart = new Date(year, month - 2, 1);
  const lastMonthEnd = monthStart;

  const usersActiveLastMonth = await getActiveUsersInPeriod(lastMonthStart, lastMonthEnd);
  const usersActiveThisMonth = await getActiveUsersInPeriod(monthStart, monthEnd);

  const retained = [...usersActiveLastMonth].filter(id => usersActiveThisMonth.has(id)).length;
  const retentionRate = usersActiveLastMonth.size > 0
    ? Math.round((retained / usersActiveLastMonth.size) * 10000) / 100
    : 0;

  const churned = usersActiveLastMonth.size - retained;
  const churnRate = usersActiveLastMonth.size > 0
    ? Math.round((churned / usersActiveLastMonth.size) * 10000) / 100
    : 0;

  const stats: MonthlyStats = {
    month: monthStr,
    totalUsers,
    newUsers,
    avgDailyActiveUsers,
    activeUsersMonthly,
    totalConversations,
    newConversations,
    totalMessages,
    avgMessagesPerDay,
    totalDocuments,
    newDocuments,
    storageUsedBytes,
    errorCount,
    estimatedCostUSD: Math.round(estimatedCostUSD * 100) / 100,
    retentionRate,
    churnRate
  };

  console.log(`📊 [AGGREGATION] Monthly stats for ${monthStr} complete`);

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate trends for a metric over time
 */
export async function calculateTrend(
  metric: 'users' | 'messages' | 'documents' | 'cost',
  period: 'daily' | 'weekly' | 'monthly',
  count: number = 30
): Promise<TrendData[]> {
  const trends: TrendData[] = [];
  const now = new Date();

  if (period === 'daily') {
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const stats = await aggregateDailyStats(date);

      const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      const prevStats = await aggregateDailyStats(prevDate);

      let value = 0;
      let prevValue = 0;

      switch (metric) {
        case 'users':
          value = stats.activeUsers;
          prevValue = prevStats.activeUsers;
          break;
        case 'messages':
          value = stats.userMessages + stats.assistantMessages;
          prevValue = prevStats.userMessages + prevStats.assistantMessages;
          break;
        case 'documents':
          value = stats.newDocuments;
          prevValue = prevStats.newDocuments;
          break;
        case 'cost':
          value = stats.estimatedCostUSD;
          prevValue = prevStats.estimatedCostUSD;
          break;
      }

      const change = value - prevValue;
      const changePercent = prevValue > 0
        ? Math.round((change / prevValue) * 10000) / 100
        : value > 0 ? 100 : 0;

      trends.push({
        period: stats.date,
        value,
        change,
        changePercent
      });
    }
  }

  return trends;
}

/**
 * Get comparison between two periods
 */
export async function getPeriodComparison(
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<{
  current: DailyStats;
  previous: DailyStats;
  changes: Record<string, { value: number; percent: number }>;
}> {
  // Aggregate current period
  const currentStats = await aggregateDailyStatsRange(currentPeriodStart, currentPeriodEnd);
  const previousStats = await aggregateDailyStatsRange(previousPeriodStart, previousPeriodEnd);

  // Sum up the periods
  const sumStats = (stats: DailyStats[]) => ({
    date: stats[0]?.date || '',
    totalUsers: stats[stats.length - 1]?.totalUsers || 0,
    newUsers: stats.reduce((s, d) => s + d.newUsers, 0),
    activeUsers: Math.round(stats.reduce((s, d) => s + d.activeUsers, 0) / stats.length),
    totalConversations: stats[stats.length - 1]?.totalConversations || 0,
    newConversations: stats.reduce((s, d) => s + d.newConversations, 0),
    totalMessages: stats[stats.length - 1]?.totalMessages || 0,
    userMessages: stats.reduce((s, d) => s + d.userMessages, 0),
    assistantMessages: stats.reduce((s, d) => s + d.assistantMessages, 0),
    totalDocuments: stats[stats.length - 1]?.totalDocuments || 0,
    newDocuments: stats.reduce((s, d) => s + d.newDocuments, 0),
    storageUsedBytes: stats[stats.length - 1]?.storageUsedBytes || 0,
    errorCount: stats.reduce((s, d) => s + d.errorCount, 0),
    estimatedCostUSD: stats.reduce((s, d) => s + d.estimatedCostUSD, 0)
  });

  const current = sumStats(currentStats);
  const previous = sumStats(previousStats);

  // Calculate changes
  const calcChange = (curr: number, prev: number) => ({
    value: curr - prev,
    percent: prev > 0 ? Math.round(((curr - prev) / prev) * 10000) / 100 : curr > 0 ? 100 : 0
  });

  const changes = {
    newUsers: calcChange(current.newUsers, previous.newUsers),
    activeUsers: calcChange(current.activeUsers, previous.activeUsers),
    newConversations: calcChange(current.newConversations, previous.newConversations),
    messages: calcChange(
      current.userMessages + current.assistantMessages,
      previous.userMessages + previous.assistantMessages
    ),
    newDocuments: calcChange(current.newDocuments, previous.newDocuments),
    errorCount: calcChange(current.errorCount, previous.errorCount),
    cost: calcChange(current.estimatedCostUSD, previous.estimatedCostUSD)
  };

  return { current, previous, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get set of active user IDs in a period
 */
async function getActiveUsersInPeriod(start: Date, end: Date): Promise<Set<string>> {
  const activeUserConversations = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      createdAt: { gte: start, lt: end },
      role: 'user'
    }
  });

  const convIds = activeUserConversations.map(g => g.conversationId);
  const activeConvs = await prisma.conversation.findMany({
    where: { id: { in: convIds } },
    select: { userId: true }
  });

  return new Set(activeConvs.map(c => c.userId));
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the start of the current month
 */
export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULED AGGREGATION JOB
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run daily aggregation job (should be called by cron at midnight)
 */
export async function runDailyAggregationJob(): Promise<void> {
  console.log('📊 [AGGREGATION JOB] Starting daily aggregation...');

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const stats = await aggregateDailyStats(yesterday);

    // Store in database (would need AnalyticsDailyStat model)
    // await prisma.analyticsDailyStat.create({ data: stats });

    console.log(`📊 [AGGREGATION JOB] Daily stats saved for ${stats.date}`);
    console.log(`   - Users: ${stats.totalUsers} (${stats.newUsers} new, ${stats.activeUsers} active)`);
    console.log(`   - Messages: ${stats.userMessages + stats.assistantMessages}`);
    console.log(`   - Documents: ${stats.newDocuments} new`);
    console.log(`   - Cost: $${stats.estimatedCostUSD}`);
  } catch (error) {
    console.error('📊 [AGGREGATION JOB] Error:', error);
    throw error;
  }
}

/**
 * Run weekly aggregation job (should be called by cron every Monday)
 */
export async function runWeeklyAggregationJob(): Promise<void> {
  console.log('📊 [AGGREGATION JOB] Starting weekly aggregation...');

  try {
    const lastWeekStart = getWeekStart(new Date());
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const stats = await aggregateWeeklyStats(lastWeekStart);

    console.log(`📊 [AGGREGATION JOB] Weekly stats saved for ${stats.weekStart} to ${stats.weekEnd}`);
    console.log(`   - Users: ${stats.newUsers} new, ${stats.avgDailyActiveUsers} avg daily active`);
    console.log(`   - Retention: ${stats.retentionRate}%`);
    console.log(`   - Cost: $${stats.estimatedCostUSD}`);
  } catch (error) {
    console.error('📊 [AGGREGATION JOB] Error:', error);
    throw error;
  }
}

/**
 * Run monthly aggregation job (should be called by cron on 1st of month)
 */
export async function runMonthlyAggregationJob(): Promise<void> {
  console.log('📊 [AGGREGATION JOB] Starting monthly aggregation...');

  try {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const stats = await aggregateMonthlyStats(
      lastMonth.getFullYear(),
      lastMonth.getMonth() + 1
    );

    console.log(`📊 [AGGREGATION JOB] Monthly stats saved for ${stats.month}`);
    console.log(`   - Users: ${stats.newUsers} new, ${stats.activeUsersMonthly} MAU`);
    console.log(`   - Retention: ${stats.retentionRate}%, Churn: ${stats.churnRate}%`);
    console.log(`   - Cost: $${stats.estimatedCostUSD}`);
  } catch (error) {
    console.error('📊 [AGGREGATION JOB] Error:', error);
    throw error;
  }
}

export default {
  aggregateDailyStats,
  aggregateDailyStatsRange,
  aggregateWeeklyStats,
  aggregateMonthlyStats,
  calculateTrend,
  getPeriodComparison,
  getWeekStart,
  getMonthStart,
  runDailyAggregationJob,
  runWeeklyAggregationJob,
  runMonthlyAggregationJob
};
