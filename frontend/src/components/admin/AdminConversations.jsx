/**
 * AdminConversations Component
 *
 * PURPOSE: Detailed conversation and message analytics
 */

import React from 'react';
import {
  MessageSquare,
  MessageCircle,
  TrendingUp,
  Clock,
  Users,
  AlertCircle,
  Activity
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
import { useConversationAnalytics } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const AdminConversations = () => {
  const { data: conversations, loading, error } = useConversationAnalytics();

  // Format date for charts
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Prepare chart data
  const messagesTrendData = conversations?.messagesTrend?.map(item => ({
    date: formatDate(item.date),
    messages: item.count
  })) || [];

  const peakHoursData = conversations?.peakUsageHours?.map(item => ({
    hour: `${String(item.hour).padStart(2, '0')}:00`,
    messages: item.messageCount
  })) || [];

  // Longest conversations table columns
  const longestConversationsColumns = [
    { key: 'title', label: 'Title', render: (val) => val || 'Untitled' },
    { key: 'userEmail', label: 'User' },
    { key: 'messageCount', label: 'Messages', format: 'number', align: 'right' }
  ];

  if (error) {
    return (
      <AdminLayout title="Conversations" subtitle="Conversation and message analytics">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load conversation analytics</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Conversations" subtitle="Conversation and message analytics">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Conversations"
          value={conversations?.totalConversations}
          icon={MessageSquare}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="New Today"
          value={conversations?.newConversationsToday}
          icon={MessageSquare}
          color="green"
          loading={loading}
          subtitle="created today"
        />
        <MetricCard
          title="New This Week"
          value={conversations?.newConversationsThisWeek}
          icon={MessageSquare}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Active Conversations"
          value={conversations?.activeConversations}
          icon={Activity}
          color="purple"
          loading={loading}
          subtitle="last 7 days"
        />
      </div>

      {/* Message Metrics */}
      <div className="admin-section">
        <h2 className="admin-section-title">Message Metrics</h2>
        <div className="metrics-grid">
          <MetricCard
            title="Total Messages"
            value={conversations?.totalMessages}
            icon={MessageCircle}
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="Messages Today"
            value={conversations?.messagesToday}
            icon={MessageCircle}
            color="green"
            loading={loading}
          />
          <MetricCard
            title="Messages This Week"
            value={conversations?.messagesThisWeek}
            icon={MessageCircle}
            color="green"
            loading={loading}
          />
          <MetricCard
            title="Messages This Month"
            value={conversations?.messagesThisMonth}
            icon={MessageCircle}
            color="purple"
            loading={loading}
          />
          <MetricCard
            title="Avg per Conversation"
            value={conversations?.avgMessagesPerConversation}
            icon={TrendingUp}
            color="yellow"
            loading={loading}
            subtitle="messages"
          />
          <MetricCard
            title="User Messages"
            value={conversations?.userMessagesCount}
            icon={Users}
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="Assistant Messages"
            value={conversations?.assistantMessagesCount}
            icon={MessageCircle}
            color="purple"
            loading={loading}
          />
          <MetricCard
            title="Response Ratio"
            value={conversations?.userMessagesCount > 0
              ? (conversations?.assistantMessagesCount / conversations?.userMessagesCount).toFixed(2)
              : 0}
            icon={Activity}
            color="green"
            loading={loading}
            subtitle="assistant/user"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="admin-grid-2">
        {/* Message Volume Trend */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Message Volume</h3>
              <p className="chart-subtitle">Messages per day (last 30 days)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={messagesTrendData}>
              <defs>
                <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
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
                dataKey="messages"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMessages)"
              />
            </AreaChart>
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} interval={2} />
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

      {/* Longest Conversations Table */}
      <DataTable
        title="Longest Conversations"
        columns={longestConversationsColumns}
        data={conversations?.longestConversations || []}
        loading={loading}
        pageSize={10}
      />
    </AdminLayout>
  );
};

export default AdminConversations;
