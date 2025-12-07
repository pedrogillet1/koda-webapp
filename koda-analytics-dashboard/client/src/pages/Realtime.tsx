import { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Users,
  MessageSquare,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";

interface RealtimeData {
  activeUsers: number;
  activeSessions: number;
  messagesLastMinute: number;
  avgResponseTime: number;
  currentLoad: number;
}

export default function RealtimePage() {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Simulated realtime updates - in production this would use WebSocket
  useEffect(() => {
    const fetchRealtimeData = () => {
      // Simulate realtime data
      setData({
        activeUsers: Math.floor(Math.random() * 50) + 10,
        activeSessions: Math.floor(Math.random() * 30) + 5,
        messagesLastMinute: Math.floor(Math.random() * 100) + 20,
        avgResponseTime: Math.random() * 2000 + 500,
        currentLoad: Math.random() * 100
      });
      setLastUpdate(new Date());
      setConnected(true);
    };

    fetchRealtimeData();
    const interval = setInterval(fetchRealtimeData, 5000);

    return () => clearInterval(interval);
  }, []);

  const getLoadColor = (load: number) => {
    if (load < 50) return 'text-green-500';
    if (load < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getLoadBgColor = (load: number) => {
    if (load < 50) return 'bg-green-500';
    if (load < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Realtime</h2>
            <p className="text-muted-foreground mt-1">
              Live system activity monitoring
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm ${connected ? 'text-green-500' : 'text-red-500'}`}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {lastUpdate && (
              <span className="text-sm text-muted-foreground">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Live Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{data?.activeUsers || 0}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{data?.activeSessions || 0}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Messages/min</p>
                <p className="text-2xl font-bold">{data?.messagesLastMinute || 0}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{(data?.avgResponseTime || 0).toFixed(0)}ms</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </Card>
        </div>

        {/* System Load */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Current System Load</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Server Load</span>
              <span className={`font-bold ${getLoadColor(data?.currentLoad || 0)}`}>
                {(data?.currentLoad || 0).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getLoadBgColor(data?.currentLoad || 0)}`}
                style={{ width: `${data?.currentLoad || 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-500">Low (0-50%)</span>
              <span className="text-yellow-500">Medium (50-80%)</span>
              <span className="text-red-500">High (80-100%)</span>
            </div>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Live Activity Feed</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${i < 3 ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                <div className="flex-1">
                  <p className="text-sm">
                    {i % 3 === 0 && 'New user session started'}
                    {i % 3 === 1 && 'Message sent in conversation'}
                    {i % 3 === 2 && 'Document uploaded'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i < 3 ? 'Just now' : `${(i * 2)}s ago`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Info Note */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Data refreshes automatically every 5 seconds.
            In production, this would use WebSocket for true real-time updates.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
