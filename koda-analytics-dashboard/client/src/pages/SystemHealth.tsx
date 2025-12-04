import { useEffect } from 'react';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Server,
  Database,
  Cpu,
  HardDrive,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

export default function SystemHealthPage() {
  const { systemHealth, loading, fetchSystemHealth } = useAnalytics();

  useEffect(() => {
    fetchSystemHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSystemHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemHealth]);

  if (loading && !systemHealth) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!systemHealth) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No system health data available</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground mt-1">
            Real-time system monitoring and status
          </p>
        </div>
        <Button onClick={fetchSystemHealth} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon((systemHealth as any)?.status || 'unknown')}
            <div>
              <h3 className="text-lg font-semibold">Overall System Status</h3>
              <p className={`capitalize font-medium ${getStatusColor((systemHealth as any)?.status || 'unknown')}`}>
                {(systemHealth as any)?.status || 'Checking...'}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Last checked</p>
            <p className="font-medium">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </Card>

      {/* Service Status */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Server className="w-6 h-6 text-primary" />
            {getStatusIcon((systemHealth as any)?.services?.api || 'unknown')}
          </div>
          <h3 className="stat-label">API Server</h3>
          <p className={`text-lg font-semibold capitalize ${getStatusColor((systemHealth as any)?.services?.api || 'unknown')}`}>
            {(systemHealth as any)?.services?.api || 'Unknown'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Database className="w-6 h-6 text-primary" />
            {getStatusIcon((systemHealth as any)?.services?.database || 'unknown')}
          </div>
          <h3 className="stat-label">Database</h3>
          <p className={`text-lg font-semibold capitalize ${getStatusColor((systemHealth as any)?.services?.database || 'unknown')}`}>
            {(systemHealth as any)?.services?.database || 'Unknown'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <HardDrive className="w-6 h-6 text-primary" />
            {getStatusIcon((systemHealth as any)?.services?.storage || 'unknown')}
          </div>
          <h3 className="stat-label">Storage</h3>
          <p className={`text-lg font-semibold capitalize ${getStatusColor((systemHealth as any)?.services?.storage || 'unknown')}`}>
            {(systemHealth as any)?.services?.storage || 'Unknown'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Cpu className="w-6 h-6 text-primary" />
            {getStatusIcon((systemHealth as any)?.services?.ai || 'unknown')}
          </div>
          <h3 className="stat-label">AI Service</h3>
          <p className={`text-lg font-semibold capitalize ${getStatusColor((systemHealth as any)?.services?.ai || 'unknown')}`}>
            {(systemHealth as any)?.services?.ai || 'Unknown'}
          </p>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Server Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-medium">{formatUptime(systemHealth?.uptime || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Memory Usage</span>
              <span className="font-medium">
                {formatBytes((systemHealth as any)?.memory?.used || 0)} / {formatBytes((systemHealth as any)?.memory?.total || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CPU Usage</span>
              <span className="font-medium">{((systemHealth as any)?.cpu || 0).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Connections</span>
              <span className="font-medium">{(systemHealth as any)?.activeConnections || 0}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Database Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Connection Pool</span>
              <span className="font-medium">{(systemHealth as any)?.database?.poolSize || 0} connections</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Queries</span>
              <span className="font-medium">{(systemHealth as any)?.database?.activeQueries || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Query Time</span>
              <span className="font-medium">{((systemHealth as any)?.database?.avgQueryTime || 0).toFixed(2)}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database Size</span>
              <span className="font-medium">{formatBytes((systemHealth as any)?.database?.size || 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Errors */}
      {systemHealth?.recentErrors && systemHealth.recentErrors.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Errors</h3>
          <div className="space-y-3">
            {systemHealth.recentErrors.map((error, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{error.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date((error as any).timestamp || error.lastOccurred).toLocaleString()} • {error.count} occurrences
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
