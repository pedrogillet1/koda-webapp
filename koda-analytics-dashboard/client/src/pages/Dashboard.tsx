import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import StatCard from "@/components/StatCard";
import { useQuickStats } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { Users, MessageSquare, FileText, Activity, MessageCircle, BarChart3, HardDrive } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function Dashboard() {
  const { data, loading, error } = useQuickStats();

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load analytics data</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Overview of your Koda application metrics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Users"
            value={data?.totalUsers?.toLocaleString() || '0'}
            change={data?.userGrowthRate}
            changeLabel="vs last month"
            trend={data?.userGrowthRate > 0 ? 'up' : data?.userGrowthRate < 0 ? 'down' : 'neutral'}
            icon={<Users className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Messages Today"
            value={data?.messagesToday?.toLocaleString() || '0'}
            subtitle={`${data?.totalMessages?.toLocaleString() || 0} total`}
            icon={<MessageSquare className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Documents"
            value={data?.totalDocuments?.toLocaleString() || '0'}
            subtitle={`${data?.documentsToday || 0} uploaded today`}
            icon={<FileText className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Active Users"
            value={data?.activeUsersToday?.toLocaleString() || '0'}
            subtitle="today"
            icon={<Activity className="w-6 h-6" />}
            loading={loading}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="Conversations"
            value={data?.totalConversations?.toLocaleString() || '0'}
            subtitle={`${data?.newConversationsToday || 0} new today`}
            icon={MessageCircle}
            color="text-blue-500"
            loading={loading}
          />
          <StatCard
            title="Avg Messages/Conv"
            value={data?.avgMessagesPerConversation?.toFixed(1) || '0'}
            subtitle="messages per conversation"
            icon={BarChart3}
            color="text-purple-500"
            loading={loading}
          />
          <StatCard
            title="Storage Used"
            value={`${data?.totalStorageGB?.toFixed(2) || '0'} GB`}
            subtitle="document storage"
            icon={HardDrive}
            color="text-green-500"
            loading={loading}
          />
        </div>

        {/* Activity Chart */}
        {data?.recentActivity && data.recentActivity.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.recentActivity}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
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
                    dataKey="count"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorMessages)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
