/**
 * Analytics API Client
 */

import axios, { AxiosInstance } from 'axios';
import type { Environment } from './environments';

export interface AnalyticsOverview {
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    activeToday: number;
    activeThisWeek: number;
    activeThisMonth: number;
    growthRate: number;
  };
  conversations: {
    total: number;
    newToday: number;
    newThisWeek: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
  };
  documents: {
    total: number;
    uploadedToday: number;
    uploadedThisWeek: number;
    totalStorageGB: number;
  };
  system: {
    health: 'healthy' | 'warning' | 'error';
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
  };
  costs: {
    totalMonthly: number;
    costPerUser: number;
  };
}

export interface UserAnalytics {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;
  userGrowthRate: number;
  retentionRate: number;
  userGrowthTrend: Array<{ date: string; count: number }>;
  mostActiveUsers: Array<{
    userId: string;
    email: string;
    messageCount: number;
    conversationCount: number;
    documentCount: number;
  }>;
  inactiveUsers: Array<{
    userId: string;
    email: string;
    lastActive: string | null;
    daysSinceActive: number;
  }>;
  usersBySubscriptionTier: Array<{ tier: string; count: number }>;
}

export interface ConversationAnalytics {
  totalConversations: number;
  newConversationsToday: number;
  newConversationsThisWeek: number;
  newConversationsThisMonth: number;
  activeConversations: number;
  totalMessages: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  avgMessagesPerConversation: number;
  userMessagesCount: number;
  assistantMessagesCount: number;
  messagesTrend: Array<{ date: string; count: number }>;
  peakUsageHours: Array<{ hour: number; messageCount: number }>;
  longestConversations: Array<{
    conversationId: string;
    title: string;
    messageCount: number;
    userId: string;
    userEmail: string;
  }>;
}

export interface DocumentAnalytics {
  totalDocuments: number;
  documentsUploadedToday: number;
  documentsUploadedThisWeek: number;
  documentsUploadedThisMonth: number;
  totalStorageBytes: number;
  totalStorageGB: number;
  avgDocumentSizeBytes: number;
  documentsByType: Array<{ type: string; count: number }>;
  documentsByStatus: Array<{ status: string; count: number }>;
  uploadTrend: Array<{ date: string; count: number }>;
  largestDocuments: Array<{
    documentId: string;
    filename: string;
    sizeBytes: number;
    sizeMB: number;
    userId: string;
    userEmail: string;
  }>;
  recentUploads: Array<{
    documentId: string;
    filename: string;
    uploadedAt: string;
    userId: string;
    userEmail: string;
  }>;
  embeddingStats: {
    totalEmbeddings: number;
    avgChunksPerDocument: number;
  };
}

export interface SystemHealth {
  databaseSize: string;
  databaseConnections: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  errorCount24h: number;
  errorRate: number;
  avgResponseTime: number;
  tableSizes: Array<{ table: string; size: string; rowCount: number }>;
  recentErrors: Array<{
    message: string;
    count: number;
    lastOccurred: string;
  }>;
}

export interface CostAnalytics {
  totalCostMTD: number;
  costToday: number;
  avgDailyCost: number;
  projectedMonthlyCost: number;
  totalTokensMTD: number;
  inputTokensMTD: number;
  outputTokensMTD: number;
  avgCostPerMessage: number;
  monthOverMonthChange: number;
  dailyCosts: Array<{ date: string; totalCost: number; totalTokens: number }>;
  costsByModel: Array<{ model: string; cost: number; tokens: number }>;
  costsByFeature: Array<{ feature: string; cost: number; percentage: number }>;
  topUsersByCost: Array<{ email: string; tokens: number; cost: number }>;
  costAlerts?: Array<{ severity: string; title: string; message: string }>;
}

class AnalyticsAPI {
  private client: AxiosInstance;
  private currentEnvironment: Environment;

  constructor(environment: Environment) {
    this.currentEnvironment = environment;
    this.client = axios.create({
      baseURL: environment.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  setEnvironment(environment: Environment) {
    this.currentEnvironment = environment;
    this.client.defaults.baseURL = environment.apiUrl;
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async getOverview(): Promise<AnalyticsOverview> {
    const response = await this.client.get('/admin/analytics/overview');
    return response.data;
  }

  async getQuickStats(): Promise<any> {
    const response = await this.client.get('/admin/analytics/quick-stats');
    return response.data;
  }

  async getUserAnalytics(): Promise<UserAnalytics> {
    const response = await this.client.get('/admin/analytics/users');
    return response.data;
  }

  async getConversationAnalytics(): Promise<ConversationAnalytics> {
    const response = await this.client.get('/admin/analytics/conversations');
    return response.data;
  }

  async getDocumentAnalytics(): Promise<DocumentAnalytics> {
    const response = await this.client.get('/admin/analytics/documents');
    return response.data;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.client.get('/admin/analytics/system-health');
    return response.data;
  }

  async getCostAnalytics(): Promise<CostAnalytics> {
    const response = await this.client.get('/admin/analytics/costs');
    return response.data;
  }

  async clearCache(): Promise<void> {
    await this.client.post('/admin/analytics/clear-cache');
  }
}

export default AnalyticsAPI;
