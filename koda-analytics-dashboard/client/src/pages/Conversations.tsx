import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { useConversationAnalytics } from "@/hooks/useAnalytics";
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
  const { data, loading, error } = useConversationAnalytics();

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load conversation analytics</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = data?.messagesByDay?.map(item => ({
    date: formatDate(item.date),
    messages: item.count
  })) || [];

  const hourlyData = data?.messagesByHour?.map(item => ({
    hour: `${item.hour}:00`,
    messages: item.count
  })) || [];

  return (
    <DashboardLayout>
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
            value={data?.totalConversations?.toLocaleString() || '0'}
            icon={<MessageSquare className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Total Messages"
            value={data?.totalMessages?.toLocaleString() || '0'}
            icon={<BarChart3 className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Messages Today"
            value={data?.messagesToday?.toLocaleString() || '0'}
            icon={<TrendingUp className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Avg per Conversation"
            value={data?.avgMessagesPerConversation?.toFixed(1) || '0'}
            icon={<Clock className="w-6 h-6" />}
            loading={loading}
          />
        </div>

        {/* Today's Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="stat-label">Conversations Today</h3>
            <p className="stat-value mt-2">{data?.conversationsToday?.toLocaleString() || '0'}</p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">This Week</h3>
            <p className="stat-value mt-2">{data?.conversationsThisWeek?.toLocaleString() || '0'}</p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">This Month</h3>
            <p className="stat-value mt-2">{data?.conversationsThisMonth?.toLocaleString() || '0'}</p>
          </Card>
        </div>

        {/* Messages Over Time Chart */}
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

        {/* Recent Conversations Table */}
        {data?.recentConversations && data.recentConversations.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Conversations</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="text-right">Messages</th>
                  <th>Started</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {data.recentConversations.map((conv) => (
                  <tr key={conv.id}>
                    <td className="font-medium">{conv.userEmail || 'Anonymous'}</td>
                    <td className="text-right">{conv.messageCount}</td>
                    <td className="text-muted-foreground">
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-muted-foreground">
                      {new Date(conv.lastMessageAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
