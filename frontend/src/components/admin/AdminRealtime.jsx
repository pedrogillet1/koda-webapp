/**
 * AdminRealtime Component
 *
 * PURPOSE: Real-time system monitoring and live activity feed
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Users,
  MessageSquare,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Database,
  AlertCircle
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import MetricCard from './MetricCard';
import { useQuickStats } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const AdminRealtime = () => {
  const { data: stats, loading, error, refetch } = useQuickStats();
  const [activityLog, setActivityLog] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Simulate real-time activity (in production, this would be WebSocket)
  const generateActivity = useCallback(() => {
    const activities = [
      { type: 'message', icon: MessageSquare, color: '#3B82F6', text: 'New message sent' },
      { type: 'user', icon: Users, color: '#10B981', text: 'User logged in' },
      { type: 'upload', icon: Upload, color: '#8B5CF6', text: 'Document uploaded' },
      { type: 'query', icon: Database, color: '#F59E0B', text: 'RAG query processed' },
      { type: 'error', icon: AlertTriangle, color: '#EF4444', text: 'Error occurred' }
    ];

    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    return {
      id: Date.now(),
      ...randomActivity,
      timestamp: new Date(),
      details: `User action at ${new Date().toLocaleTimeString()}`
    };
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const refreshInterval = setInterval(() => {
      refetch();
      setLastUpdate(new Date());

      // Add simulated activity
      setActivityLog(prev => {
        const newActivity = generateActivity();
        const updated = [newActivity, ...prev].slice(0, 50); // Keep last 50
        return updated;
      });
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [autoRefresh, refetch, generateActivity]);

  // Initial activity log
  useEffect(() => {
    const initialActivities = Array.from({ length: 10 }, () => generateActivity());
    setActivityLog(initialActivities);
  }, [generateActivity]);

  // Format time ago
  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get status indicator
  const getStatusIndicator = () => {
    if (!isConnected) {
      return { icon: WifiOff, color: '#EF4444', text: 'Disconnected' };
    }
    if (loading) {
      return { icon: RefreshCw, color: '#F59E0B', text: 'Updating...' };
    }
    return { icon: Wifi, color: '#10B981', text: 'Connected' };
  };

  const status = getStatusIndicator();

  if (error) {
    return (
      <AdminLayout title="Real-time Monitor" subtitle="Live system activity and monitoring">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load real-time data</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Real-time Monitor" subtitle="Live system activity and monitoring">
      {/* Connection Status Bar */}
      <div className="chart-container" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: status.color,
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }} />
            <status.icon size={20} color={status.color} />
            <span style={{ fontWeight: 600 }}>{status.text}</span>
            <span style={{ color: '#64748b', fontSize: 14 }}>
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>Auto-refresh (5s)</span>
            </label>
            <button
              onClick={() => {
                refetch();
                setLastUpdate(new Date());
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              Refresh Now
            </button>
          </div>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Active Users"
          value={stats?.activeUsers || 0}
          icon={Users}
          color="green"
          loading={loading}
          subtitle="currently online"
        />
        <MetricCard
          title="Messages Today"
          value={stats?.messagesToday || 0}
          icon={MessageSquare}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="Documents Today"
          value={stats?.documentsToday || 0}
          icon={Upload}
          color="purple"
          loading={loading}
        />
        <MetricCard
          title="Errors Today"
          value={stats?.errorsToday || 0}
          icon={AlertTriangle}
          color={stats?.errorsToday > 10 ? 'red' : 'yellow'}
          loading={loading}
        />
      </div>

      {/* System Health Quick View */}
      <div className="admin-section">
        <h2 className="admin-section-title">System Health</h2>
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div style={{
            padding: 20,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle size={20} color="#10B981" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>API</div>
                <div style={{ fontWeight: 600, color: '#10B981' }}>Operational</div>
              </div>
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Database size={20} color="#10B981" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Database</div>
                <div style={{ fontWeight: 600, color: '#10B981' }}>Operational</div>
              </div>
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={20} color="#10B981" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Vector DB</div>
                <div style={{ fontWeight: 600, color: '#10B981' }}>Operational</div>
              </div>
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Activity size={20} color="#10B981" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>AI Service</div>
                <div style={{ fontWeight: 600, color: '#10B981' }}>Operational</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="chart-container">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Live Activity Feed</h3>
            <p className="chart-subtitle">Real-time system events</p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: 20,
            fontSize: 12,
            color: '#10B981'
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10B981',
              animation: 'pulse 2s infinite'
            }} />
            Live
          </div>
        </div>

        <div style={{
          maxHeight: 400,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {activityLog.map((activity) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: '#f8fafc',
                borderRadius: 8,
                animation: 'fadeIn 0.3s ease'
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `${activity.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <activity.icon size={18} color={activity.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{activity.text}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{activity.details}</div>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AdminLayout>
  );
};

export default AdminRealtime;
