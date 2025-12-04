import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { useUserAnalytics } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { Users, UserPlus, UserCheck, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function UsersPage() {
  const { data, loading, error } = useUserAnalytics();

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load user analytics</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = data?.userGrowthTrend?.map(item => ({
    date: formatDate(item.date),
    users: item.count
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground mt-1">
            User analytics and growth metrics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Users"
            value={data?.totalUsers?.toLocaleString() || '0'}
            icon={<Users className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="New Today"
            value={data?.newUsersToday?.toLocaleString() || '0'}
            icon={<UserPlus className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="New This Week"
            value={data?.newUsersThisWeek?.toLocaleString() || '0'}
            icon={<UserPlus className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Growth Rate"
            value={`${data?.userGrowthRate?.toFixed(1) || 0}%`}
            trend={data?.userGrowthRate > 0 ? 'up' : 'down'}
            icon={<TrendingUp className="w-6 h-6" />}
            loading={loading}
          />
        </div>

        {/* Active Users */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="stat-label">Daily Active Users</h3>
            <p className="stat-value mt-2">{data?.activeUsersToday?.toLocaleString() || '0'}</p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">Weekly Active Users</h3>
            <p className="stat-value mt-2">{data?.activeUsersThisWeek?.toLocaleString() || '0'}</p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">Monthly Active Users</h3>
            <p className="stat-value mt-2">{data?.activeUsersThisMonth?.toLocaleString() || '0'}</p>
          </Card>
        </div>

        {/* User Growth Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">User Growth Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
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
                  dataKey="users"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Users Table */}
        {data?.topUsersByMessages && data.topUsersByMessages.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Users by Messages</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th className="text-right">Messages</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {data.topUsersByMessages.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.email}</td>
                    <td>{user.name || '-'}</td>
                    <td className="text-right">{user.messageCount.toLocaleString()}</td>
                    <td className="text-muted-foreground">
                      {new Date(user.lastActive).toLocaleDateString()}
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
