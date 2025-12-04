import { useEffect } from 'react';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
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

export default function CostsPage() {
  const { costs, loading, fetchCosts } = useAnalytics();

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  if (loading && !costs) {
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

  if (!costs) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No cost data available</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const dailyCostData = (costs as any)?.costsByDay?.map((item: any) => ({
    date: formatDate(item.date),
    cost: item.cost
  })) || [];

  const modelCostData = costs?.costsByModel?.map(item => ({
    model: item.model.split('-').slice(-2).join('-'),
    cost: item.cost,
    tokens: item.tokens
  })) || [];

  const costChangePercent = (costs as any)?.costChangePercent || 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Costs</h2>
        <p className="text-muted-foreground mt-1">
          AI usage costs and token consumption
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Cost (Month)"
          value={formatCurrency((costs as any)?.totalCostThisMonth || costs?.totalCostMTD || 0)}
          icon={<DollarSign className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Cost Today"
          value={formatCurrency(costs?.costToday || 0)}
          icon={<TrendingUp className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Avg Daily Cost"
          value={formatCurrency(costs?.avgDailyCost || 0)}
          icon={<BarChart3 className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Cost Change"
          value={`${costChangePercent.toFixed(1)}%`}
          trend={costChangePercent > 0 ? 'up' : 'down'}
          icon={costChangePercent > 0 ?
            <TrendingUp className="w-6 h-6" /> :
            <TrendingDown className="w-6 h-6" />
          }
          loading={loading}
        />
      </div>

      {/* Token Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="stat-label">Input Tokens</h3>
          <p className="stat-value mt-2">{(costs?.inputTokensMTD || (costs as any)?.totalInputTokens || 0).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency((costs as any)?.inputTokenCost || 0)} total
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">Output Tokens</h3>
          <p className="stat-value mt-2">{(costs?.outputTokensMTD || (costs as any)?.totalOutputTokens || 0).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency((costs as any)?.outputTokenCost || 0)} total
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">Cost per Message</h3>
          <p className="stat-value mt-2">{formatCurrency(costs?.avgCostPerMessage || 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            average
          </p>
        </Card>
      </div>

      {/* Cost Over Time Chart */}
      {dailyCostData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Costs</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyCostData}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Cost']}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#F59E0B"
                  fillOpacity={1}
                  fill="url(#colorCost)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Cost by Model */}
      {modelCostData.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Cost by Model</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelCostData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    className="text-xs"
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <YAxis type="category" dataKey="model" className="text-xs" width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Model Breakdown Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Model Breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="text-right">Tokens</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {costs?.costsByModel?.map((item) => (
                  <tr key={item.model}>
                    <td className="font-medium">{item.model}</td>
                    <td className="text-right">{item.tokens.toLocaleString()}</td>
                    <td className="text-right">{formatCurrency(item.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Top Users by Cost */}
      {costs?.topUsersByCost && costs.topUsersByCost.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Users by Cost</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th className="text-right">Messages</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {costs.topUsersByCost.map((user) => (
                <tr key={(user as any).userId || user.email}>
                  <td className="font-medium">{user.email}</td>
                  <td className="text-right">{((user as any).messages || 0).toLocaleString()}</td>
                  <td className="text-right">{user.tokens.toLocaleString()}</td>
                  <td className="text-right">{formatCurrency(user.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
