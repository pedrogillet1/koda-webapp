/**
 * AdminSystemHealth Component
 *
 * PURPOSE: System health monitoring and metrics
 */

import React from 'react';
import {
  Activity,
  Database,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  Cpu,
  AlertCircle
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import MetricCard from './MetricCard';
import DataTable from './DataTable';
import { useSystemHealth } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const AdminSystemHealth = () => {
  const { data: health, loading, error, lastFetched } = useSystemHealth({ autoRefresh: true });

  // Table sizes columns
  const tableSizesColumns = [
    { key: 'table', label: 'Table Name' },
    { key: 'size', label: 'Size', align: 'right' },
    { key: 'rowCount', label: 'Rows', format: 'number', align: 'right' }
  ];

  // Recent errors columns
  const errorsColumns = [
    { key: 'message', label: 'Error Action' },
    { key: 'count', label: 'Count', format: 'number', align: 'right' },
    { key: 'lastOccurred', label: 'Last Occurred', format: 'datetime' }
  ];

  // Get health status
  const getHealthStatus = () => {
    if (!health) return { status: 'unknown', color: 'gray' };

    const errorRate = health.errorRate || 0;
    const memoryUsage = health.memoryUsage?.percentage || 0;

    if (errorRate > 10 || memoryUsage > 90) {
      return { status: 'Critical', color: 'red', icon: XCircle };
    }
    if (errorRate > 5 || memoryUsage > 75) {
      return { status: 'Warning', color: 'yellow', icon: AlertTriangle };
    }
    return { status: 'Healthy', color: 'green', icon: CheckCircle };
  };

  const healthStatus = getHealthStatus();

  // Format uptime
  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (error) {
    return (
      <AdminLayout title="System Health" subtitle="System monitoring and performance metrics">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load system health</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="System Health" subtitle="System monitoring and performance metrics">
      {/* Overall Status */}
      <div className="chart-container" style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: healthStatus.color === 'green' ? 'rgba(16, 185, 129, 0.1)' :
                         healthStatus.color === 'yellow' ? 'rgba(245, 158, 11, 0.1)' :
                         'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {healthStatus.icon && (
                <healthStatus.icon
                  size={32}
                  color={healthStatus.color === 'green' ? '#10B981' :
                         healthStatus.color === 'yellow' ? '#F59E0B' : '#EF4444'}
                />
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>System Status: {healthStatus.status}</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: '#64748b' }}>Uptime</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatUptime(health?.uptime)}</div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Database Size"
          value={health?.databaseSize || 'N/A'}
          icon={Database}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="DB Connections"
          value={health?.databaseConnections}
          icon={Server}
          color={health?.databaseConnections > 80 ? 'red' : 'green'}
          loading={loading}
          subtitle="active connections"
        />
        <MetricCard
          title="Memory Usage"
          value={health?.memoryUsage?.percentage}
          format="percent"
          icon={Cpu}
          color={health?.memoryUsage?.percentage > 80 ? 'red' :
                 health?.memoryUsage?.percentage > 60 ? 'yellow' : 'green'}
          loading={loading}
          subtitle={`${health?.memoryUsage?.used || 0} MB used`}
        />
        <MetricCard
          title="Uptime"
          value={formatUptime(health?.uptime)}
          icon={Clock}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Error Metrics */}
      <div className="admin-section">
        <h2 className="admin-section-title">Error Metrics (Last 24 Hours)</h2>
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <MetricCard
            title="Error Count"
            value={health?.errorCount24h}
            icon={AlertTriangle}
            color={health?.errorCount24h > 100 ? 'red' :
                   health?.errorCount24h > 50 ? 'yellow' : 'green'}
            loading={loading}
            subtitle="in last 24h"
          />
          <MetricCard
            title="Error Rate"
            value={health?.errorRate}
            format="percent"
            icon={Activity}
            color={health?.errorRate > 5 ? 'red' :
                   health?.errorRate > 2 ? 'yellow' : 'green'}
            loading={loading}
            subtitle="of all requests"
          />
          <MetricCard
            title="Avg Response Time"
            value={health?.avgResponseTime || 0}
            icon={Clock}
            color={health?.avgResponseTime > 1000 ? 'red' :
                   health?.avgResponseTime > 500 ? 'yellow' : 'green'}
            loading={loading}
            subtitle="ms"
          />
        </div>
      </div>

      {/* Tables */}
      <div className="admin-grid-2">
        <DataTable
          title="Database Table Sizes"
          columns={tableSizesColumns}
          data={health?.tableSizes || []}
          loading={loading}
          pageSize={10}
          emptyMessage="No table size data available"
        />

        <DataTable
          title="Recent Errors by Type"
          columns={errorsColumns}
          data={health?.recentErrors || []}
          loading={loading}
          pagination={false}
          emptyMessage="No errors in the last 24 hours"
        />
      </div>

      {/* System Info */}
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">System Information</h3>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Node.js Memory</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {health?.memoryUsage?.used || 0} MB / {Math.round((health?.memoryUsage?.total || 0))} MB
            </div>
          </div>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Database</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>PostgreSQL</div>
          </div>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Cache</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>In-Memory</div>
          </div>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Vector DB</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Pinecone</div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemHealth;
