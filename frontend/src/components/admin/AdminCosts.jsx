/**
 * AdminCosts Component
 *
 * PURPOSE: AI API costs and token usage analytics
 */

import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  MessageSquare,
  AlertCircle,
  PieChart as PieIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import AdminLayout from './AdminLayout';
import MetricCard from './MetricCard';
import DataTable from './DataTable';
import { useCostAnalytics } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const AdminCosts = () => {
  const { data: costs, loading, error } = useCostAnalytics();

  // Format currency
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.00';
    return `$${value.toFixed(2)}`;
  };

  // Format date for charts
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Prepare chart data
  const costTrendData = costs?.dailyCosts?.map(item => ({
    date: formatDate(item.date),
    cost: item.totalCost,
    tokens: item.totalTokens
  })) || [];

  const modelCostsData = costs?.costsByModel?.map(item => ({
    name: item.model.replace('gemini-', '').replace('-latest', ''),
    value: item.cost,
    tokens: item.tokens,
    fullName: item.model
  })) || [];

  const featureCostsData = costs?.costsByFeature?.map(item => ({
    name: item.feature,
    cost: item.cost,
    percentage: item.percentage
  })) || [];

  // Top users by cost columns
  const topUsersColumns = [
    { key: 'email', label: 'User Email' },
    { key: 'tokens', label: 'Tokens Used', format: 'number', align: 'right' },
    {
      key: 'cost',
      label: 'Cost',
      align: 'right',
      render: (val) => formatCurrency(val)
    }
  ];

  // Calculate month-over-month change
  const getMoMChange = () => {
    if (!costs?.monthOverMonthChange) return null;
    const change = costs.monthOverMonthChange;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0,
      icon: change >= 0 ? TrendingUp : TrendingDown
    };
  };

  const momChange = getMoMChange();

  if (error) {
    return (
      <AdminLayout title="Cost Analytics" subtitle="AI API costs and token usage tracking">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load cost analytics</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cost Analytics" subtitle="AI API costs and token usage tracking">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Cost (MTD)"
          value={formatCurrency(costs?.totalCostMTD)}
          icon={DollarSign}
          color="blue"
          loading={loading}
          subtitle="this month"
        />
        <MetricCard
          title="Cost Today"
          value={formatCurrency(costs?.costToday)}
          icon={DollarSign}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Avg Daily Cost"
          value={formatCurrency(costs?.avgDailyCost)}
          icon={TrendingUp}
          color="purple"
          loading={loading}
          subtitle="last 30 days"
        />
        <MetricCard
          title="Projected Monthly"
          value={formatCurrency(costs?.projectedMonthlyCost)}
          icon={DollarSign}
          color={costs?.projectedMonthlyCost > 100 ? 'red' : 'yellow'}
          loading={loading}
          subtitle="estimated"
        />
      </div>

      {/* Token Usage Metrics */}
      <div className="admin-section">
        <h2 className="admin-section-title">Token Usage</h2>
        <div className="metrics-grid">
          <MetricCard
            title="Total Tokens (MTD)"
            value={costs?.totalTokensMTD}
            format="number"
            icon={Zap}
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="Input Tokens"
            value={costs?.inputTokensMTD}
            format="number"
            icon={MessageSquare}
            color="green"
            loading={loading}
          />
          <MetricCard
            title="Output Tokens"
            value={costs?.outputTokensMTD}
            format="number"
            icon={MessageSquare}
            color="purple"
            loading={loading}
          />
          <MetricCard
            title="Avg Cost/Message"
            value={formatCurrency(costs?.avgCostPerMessage)}
            icon={DollarSign}
            color="yellow"
            loading={loading}
          />
        </div>
      </div>

      {/* Month over Month Change */}
      {momChange && (
        <div className="chart-container" style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: momChange.isPositive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <momChange.icon
                  size={28}
                  color={momChange.isPositive ? '#EF4444' : '#10B981'}
                />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Month-over-Month Change</h3>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                  Compared to last month
                </p>
              </div>
            </div>
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: momChange.isPositive ? '#EF4444' : '#10B981'
            }}>
              {momChange.isPositive ? '+' : '-'}{momChange.value}%
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="admin-grid-2">
        {/* Cost Trend */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Daily Cost Trend</h3>
              <p className="chart-subtitle">API costs over the last 30 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={costTrendData}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white'
                }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCost)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Model */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Cost by Model</h3>
              <p className="chart-subtitle">Distribution across AI models</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={modelCostsData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {modelCostsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white'
                }}
                formatter={(value, name, props) => [
                  `$${value.toFixed(2)}`,
                  props.payload.fullName
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost by Feature */}
      <div className="chart-container">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Cost by Feature</h3>
            <p className="chart-subtitle">Which features consume the most resources</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={featureCostsData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={120} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: 8,
                color: 'white'
              }}
              formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']}
            />
            <Bar dataKey="cost" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Users by Cost */}
      <DataTable
        title="Top Users by Cost"
        columns={topUsersColumns}
        data={costs?.topUsersByCost || []}
        loading={loading}
        pageSize={10}
        emptyMessage="No cost data available"
      />

      {/* Cost Alerts */}
      {costs?.costAlerts && costs.costAlerts.length > 0 && (
        <div className="chart-container" style={{ marginTop: 24 }}>
          <div className="chart-header">
            <h3 className="chart-title">Cost Alerts</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {costs.costAlerts.map((alert, index) => (
              <div
                key={index}
                style={{
                  padding: 16,
                  background: alert.severity === 'high' ? 'rgba(239, 68, 68, 0.1)' :
                             alert.severity === 'medium' ? 'rgba(245, 158, 11, 0.1)' :
                             'rgba(59, 130, 246, 0.1)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${
                    alert.severity === 'high' ? '#EF4444' :
                    alert.severity === 'medium' ? '#F59E0B' : '#3B82F6'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <AlertCircle
                  size={20}
                  color={
                    alert.severity === 'high' ? '#EF4444' :
                    alert.severity === 'medium' ? '#F59E0B' : '#3B82F6'
                  }
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{alert.title}</div>
                  <div style={{ fontSize: 14, color: '#64748b' }}>{alert.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminCosts;
