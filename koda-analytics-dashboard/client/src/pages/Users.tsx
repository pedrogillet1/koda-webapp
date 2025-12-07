import { useEffect } from 'react';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Users, UserPlus, TrendingUp } from "lucide-react";
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
  const { users, loading, fetchUsers } = useAnalytics();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading && !users) {
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

  if (!users) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No user data available</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = users?.userGrowthTrend?.map(item => ({
    date: formatDate(item.date),
    users: item.count
  })) || [];

  return (
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
          value={users?.totalUsers?.toLocaleString() || '0'}
          icon={<Users className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="New Today"
          value={users?.newUsersToday?.toLocaleString() || '0'}
          icon={<UserPlus className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="New This Week"
          value={users?.newUsersThisWeek?.toLocaleString() || '0'}
          icon={<UserPlus className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Growth Rate"
          value={`${users?.userGrowthRate?.toFixed(1) || 0}%`}
          trend={users?.userGrowthRate && users.userGrowthRate > 0 ? 'up' : 'down'}
          icon={<TrendingUp className="w-6 h-6" />}
          loading={loading}
        />
      </div>

      {/* Active Users */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="stat-label">Daily Active Users</h3>
          <p className="stat-value mt-2">{users?.activeUsersToday?.toLocaleString() || '0'}</p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">Weekly Active Users</h3>
          <p className="stat-value mt-2">{users?.activeUsersThisWeek?.toLocaleString() || '0'}</p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">Monthly Active Users</h3>
          <p className="stat-value mt-2">{users?.activeUsersThisMonth?.toLocaleString() || '0'}</p>
        </Card>
      </div>

      {/* User Growth Chart */}
      {chartData.length > 0 && (
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
      )}

      {/* Top Users Table */}
      {users?.mostActiveUsers && users.mostActiveUsers.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Most Active Users</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th className="text-right">Messages</th>
                <th className="text-right">Conversations</th>
                <th className="text-right">Documents</th>
              </tr>
            </thead>
            <tbody>
              {users.mostActiveUsers.map((user) => (
                <tr key={user.userId}>
                  <td className="font-medium">{user.email}</td>
                  <td className="text-right">{user.messageCount.toLocaleString()}</td>
                  <td className="text-right">{user.conversationCount.toLocaleString()}</td>
                  <td className="text-right">{user.documentCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Inactive Users Table */}
      {users?.inactiveUsers && users.inactiveUsers.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Inactive Users (30+ days)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Last Active</th>
                <th className="text-right">Days Inactive</th>
              </tr>
            </thead>
            <tbody>
              {users.inactiveUsers.map((user) => (
                <tr key={user.userId}>
                  <td className="font-medium">{user.email}</td>
                  <td className="text-muted-foreground">
                    {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="text-right">{user.daysSinceActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
