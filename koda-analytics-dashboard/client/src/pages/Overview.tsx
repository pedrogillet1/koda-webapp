import { useEffect } from 'react';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, FileText, Activity, DollarSign } from 'lucide-react';

export default function Overview() {
  const { overview, loading, fetchOverview } = useAnalytics();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Overview</h2>

      {/* User Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Users</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={overview.users.total.toLocaleString()}
            icon={Users}
            color="text-blue-600"
          />
          <StatCard
            title="New Today"
            value={overview.users.newToday}
            subtitle={`${overview.users.newThisWeek} this week`}
            icon={Users}
            color="text-green-600"
          />
          <StatCard
            title="Active Today"
            value={overview.users.activeToday}
            subtitle={`${overview.users.activeThisMonth} this month`}
            icon={Users}
            color="text-purple-600"
          />
          <StatCard
            title="Growth Rate"
            value={`${overview.users.growthRate.toFixed(1)}%`}
            subtitle="Month over month"
            icon={Users}
            trend={{
              value: overview.users.growthRate,
              label: 'vs last month'
            }}
          />
        </div>
      </div>

      {/* Conversation Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Conversations</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Conversations"
            value={overview.conversations.total.toLocaleString()}
            icon={MessageSquare}
            color="text-blue-600"
          />
          <StatCard
            title="Total Messages"
            value={overview.conversations.totalMessages.toLocaleString()}
            icon={MessageSquare}
            color="text-green-600"
          />
          <StatCard
            title="Avg Messages/Conv"
            value={overview.conversations.avgMessagesPerConversation.toFixed(1)}
            icon={MessageSquare}
            color="text-purple-600"
          />
          <StatCard
            title="New Today"
            value={overview.conversations.newToday}
            subtitle={`${overview.conversations.newThisWeek} this week`}
            icon={MessageSquare}
          />
        </div>
      </div>

      {/* Document Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Documents</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Documents"
            value={overview.documents.total.toLocaleString()}
            icon={FileText}
            color="text-blue-600"
          />
          <StatCard
            title="Total Storage"
            value={`${overview.documents.totalStorageGB.toFixed(2)} GB`}
            icon={FileText}
            color="text-green-600"
          />
          <StatCard
            title="Uploaded Today"
            value={overview.documents.uploadedToday}
            subtitle={`${overview.documents.uploadedThisWeek} this week`}
            icon={FileText}
          />
          <StatCard
            title="Storage Used"
            value={`${overview.documents.totalStorageGB.toFixed(2)} GB`}
            icon={FileText}
            color="text-purple-600"
          />
        </div>
      </div>

      {/* System Health */}
      <div>
        <h3 className="text-lg font-semibold mb-3">System Health</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Status"
            value={overview.system.health.toUpperCase()}
            icon={Activity}
            color={
              overview.system.health === 'healthy'
                ? 'text-green-600'
                : overview.system.health === 'warning'
                ? 'text-yellow-600'
                : 'text-red-600'
            }
          />
          <StatCard
            title="Uptime"
            value={`${(overview.system.uptime / 3600).toFixed(1)}h`}
            subtitle="Hours online"
            icon={Activity}
          />
          <StatCard
            title="Avg Response Time"
            value={`${overview.system.avgResponseTime.toFixed(0)}ms`}
            icon={Activity}
            color="text-blue-600"
          />
          <StatCard
            title="Error Rate"
            value={`${overview.system.errorRate.toFixed(2)}%`}
            icon={Activity}
            color="text-red-600"
          />
        </div>
      </div>

      {/* Costs */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Costs</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Monthly Cost"
            value={`$${overview.costs.totalMonthly.toFixed(2)}`}
            icon={DollarSign}
            color="text-green-600"
          />
          <StatCard
            title="Cost Per User"
            value={`$${overview.costs.costPerUser.toFixed(4)}`}
            icon={DollarSign}
          />
        </div>
      </div>

      {/* Cost Efficiency Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Cost Per User</p>
              <p className="text-2xl font-bold">
                ${overview.costs.costPerUser.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Monthly</p>
              <p className="text-2xl font-bold">
                ${overview.costs.totalMonthly.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
