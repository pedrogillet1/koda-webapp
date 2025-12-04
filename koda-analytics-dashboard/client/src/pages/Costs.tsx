import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { useCostAnalytics } from "@/hooks/useAnalytics";
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
  const { data, loading, error } = useCostAnalytics();

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load cost analytics</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
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

  const dailyCostData = data?.costsByDay?.map(item => ({
    date: formatDate(item.date),
    cost: item.cost
  })) || [];

  const modelCostData = data?.costsByModel?.map(item => ({
    model: item.model.split('-').slice(-2).join('-'),
    cost: item.cost,
    tokens: item.tokens
  })) || [];

  return (
    <DashboardLayout>
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
            value={formatCurrency(data?.totalCostThisMonth || 0)}
            icon={<DollarSign className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Cost Today"
            value={formatCurrency(data?.costToday || 0)}
            icon={<TrendingUp className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Avg Daily Cost"
            value={formatCurrency(data?.avgDailyCost || 0)}
            icon={<BarChart3 className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Cost Change"
            value={`${data?.costChangePercent?.toFixed(1) || 0}%`}
            trend={data?.costChangePercent > 0 ? 'up' : 'down'}
            icon={data?.costChangePercent > 0 ?
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
            <p className="stat-value mt-2">{data?.totalInputTokens?.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(data?.inputTokenCost || 0)} total
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">Output Tokens</h3>
            <p className="stat-value mt-2">{data?.totalOutputTokens?.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(data?.outputTokenCost || 0)} total
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">Cost per Message</h3>
            <p className="stat-value mt-2">{formatCurrency(data?.avgCostPerMessage || 0)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              average
            </p>
          </Card>
        </div>

        {/* Cost Over Time Chart */}
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
                  {data?.costsByModel?.map((item) => (
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
        {data?.topUsersByCost && data.topUsersByCost.length > 0 && (
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
                {data.topUsersByCost.map((user) => (
                  <tr key={user.userId}>
                    <td className="font-medium">{user.email}</td>
                    <td className="text-right">{user.messages.toLocaleString()}</td>
                    <td className="text-right">{user.tokens.toLocaleString()}</td>
                    <td className="text-right">{formatCurrency(user.cost)}</td>
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
