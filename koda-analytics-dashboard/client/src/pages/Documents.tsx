import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { useDocumentAnalytics } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { FileText, Upload, HardDrive, FileType } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function DocumentsPage() {
  const { data, loading, error } = useDocumentAnalytics();

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load document analytics</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const typeChartData = data?.documentsByType?.map(item => ({
    name: item.type.toUpperCase(),
    value: item.count
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Documents</h2>
          <p className="text-muted-foreground mt-1">
            Document storage and usage analytics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Documents"
            value={data?.totalDocuments?.toLocaleString() || '0'}
            icon={<FileText className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Uploaded Today"
            value={data?.documentsToday?.toLocaleString() || '0'}
            icon={<Upload className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Total Storage"
            value={`${data?.totalStorageGB?.toFixed(2) || 0} GB`}
            icon={<HardDrive className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="Avg File Size"
            value={formatBytes(data?.avgDocumentSize || 0)}
            icon={<FileType className="w-6 h-6" />}
            loading={loading}
          />
        </div>

        {/* Upload Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="stat-label">This Week</h3>
            <p className="stat-value mt-2">{data?.documentsThisWeek?.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground mt-1">documents uploaded</p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">This Month</h3>
            <p className="stat-value mt-2">{data?.documentsThisMonth?.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground mt-1">documents uploaded</p>
          </Card>
          <Card className="p-6">
            <h3 className="stat-label">Processing</h3>
            <p className="stat-value mt-2">{data?.processingDocuments?.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground mt-1">in queue</p>
          </Card>
        </div>

        {/* Documents by Type Chart */}
        {typeChartData.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Documents by Type</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {typeChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Type Breakdown Table */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Type Breakdown</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="text-right">Count</th>
                    <th className="text-right">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.documentsByType?.map((item, index) => (
                    <tr key={item.type}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{item.type.toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="text-right">{item.count.toLocaleString()}</td>
                      <td className="text-right text-muted-foreground">
                        {formatBytes(item.totalSize || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* Recent Documents Table */}
        {data?.recentDocuments && data.recentDocuments.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Documents</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th className="text-right">Size</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-medium max-w-[200px] truncate">{doc.name}</td>
                    <td>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                        {doc.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">{formatBytes(doc.size)}</td>
                    <td className="text-muted-foreground">{doc.uploadedBy || '-'}</td>
                    <td className="text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
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
