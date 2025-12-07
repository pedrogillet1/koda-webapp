/**
 * AdminUsers Component
 *
 * PURPOSE: Detailed user analytics page
 */

import React from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import AdminLayout from './AdminLayout';
import MetricCard from './MetricCard';
import DataTable from './DataTable';
import { useUserAnalytics } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const AdminUsers = () => {
  const { data: users, loading, error } = useUserAnalytics();

  // Format date for charts
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Prepare chart data
  const userGrowthData = users?.userGrowthTrend?.map(item => ({
    date: formatDate(item.date),
    users: item.count
  })) || [];

  // Most active users table columns
  const activeUsersColumns = [
    { key: 'email', label: 'Email' },
    { key: 'messageCount', label: 'Messages', format: 'number', align: 'right' },
    { key: 'conversationCount', label: 'Conversations', format: 'number', align: 'right' },
    { key: 'documentCount', label: 'Documents', format: 'number', align: 'right' }
  ];

  // Inactive users table columns
  const inactiveUsersColumns = [
    { key: 'email', label: 'Email' },
    { key: 'lastActive', label: 'Last Active', format: 'datetime' },
    {
      key: 'daysSinceActive',
      label: 'Days Inactive',
      align: 'right',
      render: (value) => (
        <span className={`status-badge ${value > 60 ? 'status-badge-error' : value > 30 ? 'status-badge-warning' : 'status-badge-info'}`}>
          {value} days
        </span>
      )
    }
  ];

  // Subscription tier table columns
  const tierColumns = [
    { key: 'tier', label: 'Subscription Tier' },
    { key: 'count', label: 'Users', format: 'number', align: 'right' }
  ];

  if (error) {
    return (
      <AdminLayout title="Users" subtitle="User analytics and engagement metrics">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load user analytics</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Users" subtitle="User analytics and engagement metrics">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Users"
          value={users?.totalUsers}
          icon={Users}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="New Today"
          value={users?.newUsersToday}
          icon={UserPlus}
          color="green"
          loading={loading}
          subtitle="registered today"
        />
        <MetricCard
          title="New This Week"
          value={users?.newUsersThisWeek}
          icon={UserPlus}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="New This Month"
          value={users?.newUsersThisMonth}
          icon={UserPlus}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Active Today"
          value={users?.activeUsersToday}
          icon={UserCheck}
          color="purple"
          loading={loading}
          subtitle="sent messages"
        />
        <MetricCard
          title="Active This Week"
          value={users?.activeUsersThisWeek}
          icon={UserCheck}
          color="purple"
          loading={loading}
        />
        <MetricCard
          title="Active This Month"
          value={users?.activeUsersThisMonth}
          icon={UserCheck}
          color="purple"
          loading={loading}
        />
        <MetricCard
          title="Growth Rate"
          value={users?.userGrowthRate}
          format="percent"
          icon={TrendingUp}
          color={users?.userGrowthRate > 0 ? 'green' : 'red'}
          loading={loading}
          subtitle="vs last month"
        />
      </div>

      {/* Retention Metrics */}
      <div className="admin-section">
        <h2 className="admin-section-title">Retention Metrics</h2>
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <MetricCard
            title="Retention Rate"
            value={users?.retentionRate}
            format="percent"
            icon={UserCheck}
            color={users?.retentionRate > 50 ? 'green' : 'yellow'}
            loading={loading}
            subtitle="users active both months"
          />
          <MetricCard
            title="Inactive Users (30d)"
            value={users?.inactiveUsers?.length}
            icon={UserX}
            color="red"
            loading={loading}
            subtitle="no activity in 30 days"
          />
        </div>
      </div>

      {/* User Growth Chart */}
      <div className="chart-container">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">User Growth Trend</h3>
            <p className="chart-subtitle">New user registrations per day (last 30 days)</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={userGrowthData}>
            <defs>
              <linearGradient id="colorUsersGrowth" x1="0" y1="0" x2="0" y2="1">
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
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorUsersGrowth)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tables */}
      <div className="admin-grid-2">
        <DataTable
          title="Most Active Users"
          columns={activeUsersColumns}
          data={users?.mostActiveUsers || []}
          loading={loading}
          pageSize={10}
        />

        <DataTable
          title="Subscription Tiers"
          columns={tierColumns}
          data={users?.usersBySubscriptionTier || []}
          loading={loading}
          pagination={false}
          searchable={false}
        />
      </div>

      {/* Inactive Users */}
      <DataTable
        title="Inactive Users (No Activity in 30+ Days)"
        columns={inactiveUsersColumns}
        data={users?.inactiveUsers || []}
        loading={loading}
        pageSize={10}
        emptyMessage="No inactive users found - great engagement!"
      />
    </AdminLayout>
  );
};

export default AdminUsers;
