import { useEffect } from 'react';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { MessageSquare, TrendingUp, Clock, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export default function ConversationsPage() {
  const { conversations, loading, fetchConversations } = useAnalytics();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  if (loading && !conversations) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!conversations) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No conversation data available</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = conversations?.messagesTrend?.map(item => ({
    date: formatDate(item.date),
    messages: item.count
  })) || [];

  const hourlyData = conversations?.peakUsageHours?.map(item => ({
    hour: `${item.hour}:00`,
    messages: item.messageCount
  })) || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Conversations</h2>
        <p className="text-muted-foreground mt-1">
          Conversation and message analytics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Conversations"
          value={conversations?.totalConversations?.toLocaleString() || '0'}
          icon={<MessageSquare className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Total Messages"
          value={conversations?.totalMessages?.toLocaleString() || '0'}
          icon={<BarChart3 className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Messages Today"
          value={conversations?.messagesToday?.toLocaleString() || '0'}
          icon={<TrendingUp className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Avg per Conversation"
          value={conversations?.avgMessagesPerConversation?.toFixed(1) || '0'}
          icon={<Clock className="w-6 h-6" />}
          loading={loading}
        />
      </div>

      {/* Today's Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="stat-label">Conversations Today</h3>
          <p className="stat-value mt-2">{conversations?.newConversationsToday?.toLocaleString() || '0'}</p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">This Week</h3>
          <p className="stat-value mt-2">{conversations?.newConversationsThisWeek?.toLocaleString() || '0'}</p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">This Month</h3>
          <p className="stat-value mt-2">{conversations?.newConversationsThisMonth?.toLocaleString() || '0'}</p>
        </Card>
      </div>

      {/* Messages Over Time Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Messages Over Time</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="#8B5CF6"
                  fillOpacity={1}
                  fill="url(#colorMessages)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Messages by Hour */}
      {hourlyData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Messages by Hour</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="messages" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Longest Conversations Table */}
      {conversations?.longestConversations && conversations.longestConversations.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Longest Conversations</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>User</th>
                <th className="text-right">Messages</th>
              </tr>
            </thead>
            <tbody>
              {conversations.longestConversations.map((conv) => (
                <tr key={conv.conversationId}>
                  <td className="font-medium max-w-[200px] truncate">{conv.title || 'Untitled'}</td>
                  <td className="text-muted-foreground">{conv.userEmail || 'Anonymous'}</td>
                  <td className="text-right">{conv.messageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
