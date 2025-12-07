/**
 * AdminOverview Component
 *
 * PURPOSE: Main overview dashboard showing key metrics
 */

import React from 'react';
import {
  Users,
  MessageSquare,
  FileText,
  HardDrive,
  DollarSign,
  Activity,
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
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
import { useOverviewAnalytics, useQuickStats } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const AdminOverview = () => {
  const { data: overview, loading: overviewLoading, error: overviewError } = useOverviewAnalytics();
  const { data: quickStats, loading: quickLoading } = useQuickStats({ autoRefresh: true });

  const loading = overviewLoading || quickLoading;
  const error = overviewError;

  // Format date for charts
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Prepare chart data
  const userGrowthData = overview?.users?.userGrowthTrend?.map(item => ({
    date: formatDate(item.date),
    users: item.count
  })) || [];

  const messagesTrendData = overview?.conversations?.messagesTrend?.map(item => ({
    date: formatDate(item.date),
    messages: item.count
  })) || [];

  const documentTypesData = overview?.documents?.documentsByType?.slice(0, 6).map(item => ({
    name: item.type.split('/').pop() || 'Unknown',
    value: item.count
  })) || [];

  const peakHoursData = overview?.conversations?.peakUsageHours?.map(item => ({
    hour: `${item.hour}:00`,
    messages: item.messageCount
  })) || [];

  const costTrendData = overview?.costs?.costTrend?.map(item => ({
    date: formatDate(item.date),
    cost: item.cost
  })) || [];

  // Most active users table columns
  const activeUsersColumns = [
    { key: 'email', label: 'Email' },
    { key: 'messageCount', label: 'Messages', format: 'number', align: 'right' },
    { key: 'conversationCount', label: 'Conversations', format: 'number', align: 'right' },
    { key: 'documentCount', label: 'Documents', format: 'number', align: 'right' }
  ];

  // Recent uploads table columns
  const recentUploadsColumns = [
    { key: 'filename', label: 'Filename' },
    { key: 'userEmail', label: 'User' },
    { key: 'uploadedAt', label: 'Uploaded', format: 'datetime' }
  ];

  if (error) {
    return (
      <AdminLayout title="Overview" subtitle="Dashboard overview with key metrics">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load analytics</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Overview" subtitle="Dashboard overview with key metrics">
      {/* Quick Stats Grid */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Users"
          value={quickStats?.totalUsers || overview?.users?.totalUsers}
          changePercent={overview?.users?.userGrowthRate}
          icon={Users}
          color="blue"
          loading={loading}
          subtitle={`${overview?.users?.newUsersToday || 0} new today`}
        />
        <MetricCard
          title="Active Today"
          value={quickStats?.activeUsersToday || overview?.users?.activeUsersToday}
          icon={Activity}
          color="green"
          loading={loading}
          subtitle={`${overview?.users?.activeUsersThisWeek || 0} this week`}
        />
        <MetricCard
          title="Total Conversations"
          value={quickStats?.totalConversations || overview?.conversations?.totalConversations}
          icon={MessageSquare}
          color="purple"
          loading={loading}
          subtitle={`${overview?.conversations?.newConversationsToday || 0} new today`}
        />
        <MetricCard
          title="Messages Today"
          value={quickStats?.messagesToday || overview?.conversations?.messagesToday}
          icon={TrendingUp}
          color="yellow"
          loading={loading}
          subtitle={`${overview?.conversations?.totalMessages?.toLocaleString() || 0} total`}
        />
        <MetricCard
          title="Total Documents"
          value={quickStats?.totalDocuments || overview?.documents?.totalDocuments}
          icon={FileText}
          color="blue"
          loading={loading}
          subtitle={`${overview?.documents?.documentsUploadedToday || 0} new today`}
        />
        <MetricCard
          title="Storage Used"
          value={quickStats?.storageUsedGB || overview?.documents?.totalStorageGB}
          format="number"
          icon={HardDrive}
          color="purple"
          loading={loading}
          subtitle="GB total"
        />
        <MetricCard
          title="Error Rate"
          value={quickStats?.errorRate || overview?.systemHealth?.errorRate}
          format="percent"
          icon={AlertCircle}
          color={quickStats?.errorRate > 5 ? 'red' : 'green'}
          loading={loading}
          subtitle="Last 24 hours"
        />
        <MetricCard
          title="Est. Cost (Month)"
          value={quickStats?.estimatedCostThisMonth || overview?.costs?.totalEstimatedCost}
          format="currency"
          icon={DollarSign}
          color="green"
          loading={loading}
          subtitle={`$${overview?.costs?.costPerUser?.toFixed(4) || 0}/user`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="admin-grid-2">
        {/* User Growth Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">User Growth</h3>
              <p className="chart-subtitle">New users per day (last 30 days)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={userGrowthData}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white'
                }}
              />
              <Area
                type="monotone"
                dataKey="users"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorUsers)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Messages Trend Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Message Volume</h3>
              <p className="chart-subtitle">Messages per day (last 30 days)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={messagesTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white'
                }}
              />
              <Line
                type="monotone"
                dataKey="messages"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="admin-grid-2">
        {/* Document Types Pie Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Document Types</h3>
              <p className="chart-subtitle">Distribution by file type</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={documentTypesData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {documentTypesData.map((entry, index) => (
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
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Usage Hours */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Peak Usage Hours</h3>
              <p className="chart-subtitle">Message activity by hour (last 7 days)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white'
                }}
              />
              <Bar dataKey="messages" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="admin-grid-2">
        <DataTable
          title="Most Active Users"
          columns={activeUsersColumns}
          data={overview?.users?.mostActiveUsers || []}
          loading={loading}
          pagination={false}
          searchable={false}
        />

        <DataTable
          title="Recent Uploads"
          columns={recentUploadsColumns}
          data={overview?.documents?.recentUploads?.slice(0, 10) || []}
          loading={loading}
          pagination={false}
          searchable={false}
        />
      </div>

      {/* System Health Summary */}
      <div className="chart-container">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">System Health</h3>
            <p className="chart-subtitle">Current system metrics</p>
          </div>
        </div>
        <div className="metrics-grid" style={{ marginBottom: 0 }}>
          <MetricCard
            title="Database Size"
            value={overview?.systemHealth?.databaseSize || 'N/A'}
            icon={HardDrive}
            size="small"
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="DB Connections"
            value={overview?.systemHealth?.databaseConnections}
            icon={Activity}
            size="small"
            color="green"
            loading={loading}
          />
          <MetricCard
            title="Memory Usage"
            value={overview?.systemHealth?.memoryUsage?.percentage}
            format="percent"
            icon={Clock}
            size="small"
            color={overview?.systemHealth?.memoryUsage?.percentage > 80 ? 'red' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="Uptime"
            value={Math.floor((overview?.systemHealth?.uptime || 0) / 3600)}
            icon={TrendingUp}
            size="small"
            color="purple"
            loading={loading}
            subtitle="hours"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
