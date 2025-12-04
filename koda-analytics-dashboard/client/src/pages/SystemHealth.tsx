import { DashboardLayout } from "@/components/DashboardLayout";
import { useSystemHealth } from "@/hooks/useAnalytics";
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
  const { data, loading, error, refetch } = useSystemHealth(true);

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load system health</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
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
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
            <p className="text-muted-foreground mt-1">
              Real-time system monitoring and status
            </p>
          </div>
          <Button onClick={refetch} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Overall Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getStatusIcon(data?.status || 'unknown')}
              <div>
                <h3 className="text-lg font-semibold">Overall System Status</h3>
                <p className={`capitalize font-medium ${getStatusColor(data?.status || 'unknown')}`}>
                  {data?.status || 'Checking...'}
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
              {getStatusIcon(data?.services?.api || 'unknown')}
            </div>
            <h3 className="stat-label">API Server</h3>
            <p className={`text-lg font-semibold capitalize ${getStatusColor(data?.services?.api || 'unknown')}`}>
              {data?.services?.api || 'Unknown'}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Database className="w-6 h-6 text-primary" />
              {getStatusIcon(data?.services?.database || 'unknown')}
            </div>
            <h3 className="stat-label">Database</h3>
            <p className={`text-lg font-semibold capitalize ${getStatusColor(data?.services?.database || 'unknown')}`}>
              {data?.services?.database || 'Unknown'}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <HardDrive className="w-6 h-6 text-primary" />
              {getStatusIcon(data?.services?.storage || 'unknown')}
            </div>
            <h3 className="stat-label">Storage</h3>
            <p className={`text-lg font-semibold capitalize ${getStatusColor(data?.services?.storage || 'unknown')}`}>
              {data?.services?.storage || 'Unknown'}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Cpu className="w-6 h-6 text-primary" />
              {getStatusIcon(data?.services?.ai || 'unknown')}
            </div>
            <h3 className="stat-label">AI Service</h3>
            <p className={`text-lg font-semibold capitalize ${getStatusColor(data?.services?.ai || 'unknown')}`}>
              {data?.services?.ai || 'Unknown'}
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
                <span className="font-medium">{formatUptime(data?.uptime || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Memory Usage</span>
                <span className="font-medium">{formatBytes(data?.memory?.used || 0)} / {formatBytes(data?.memory?.total || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">CPU Usage</span>
                <span className="font-medium">{data?.cpu?.toFixed(1) || 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Connections</span>
                <span className="font-medium">{data?.activeConnections || 0}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Database Metrics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connection Pool</span>
                <span className="font-medium">{data?.database?.poolSize || 0} connections</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Queries</span>
                <span className="font-medium">{data?.database?.activeQueries || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Avg Query Time</span>
                <span className="font-medium">{data?.database?.avgQueryTime?.toFixed(2) || 0}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database Size</span>
                <span className="font-medium">{formatBytes(data?.database?.size || 0)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Errors */}
        {data?.recentErrors && data.recentErrors.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Errors</h3>
            <div className="space-y-3">
              {data.recentErrors.map((error, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{error.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(error.timestamp).toLocaleString()} • {error.count} occurrences
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
