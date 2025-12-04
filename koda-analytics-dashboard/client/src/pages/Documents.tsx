import { useEffect } from 'react';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from "@/components/MetricCard";
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
  const { documents, loading, fetchDocuments } = useAnalytics();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (loading && !documents) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!documents) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No document data available</p>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const typeChartData = documents?.documentsByType?.map(item => ({
    name: item.type.toUpperCase(),
    value: item.count
  })) || [];

  return (
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
          value={documents?.totalDocuments?.toLocaleString() || '0'}
          icon={<FileText className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Uploaded Today"
          value={documents?.documentsUploadedToday?.toLocaleString() || '0'}
          icon={<Upload className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Total Storage"
          value={`${documents?.totalStorageGB?.toFixed(2) || 0} GB`}
          icon={<HardDrive className="w-6 h-6" />}
          loading={loading}
        />
        <MetricCard
          title="Avg File Size"
          value={formatBytes(documents?.avgDocumentSizeBytes || 0)}
          icon={<FileType className="w-6 h-6" />}
          loading={loading}
        />
      </div>

      {/* Upload Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="stat-label">This Week</h3>
          <p className="stat-value mt-2">{documents?.documentsUploadedThisWeek?.toLocaleString() || '0'}</p>
          <p className="text-sm text-muted-foreground mt-1">documents uploaded</p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">This Month</h3>
          <p className="stat-value mt-2">{documents?.documentsUploadedThisMonth?.toLocaleString() || '0'}</p>
          <p className="text-sm text-muted-foreground mt-1">documents uploaded</p>
        </Card>
        <Card className="p-6">
          <h3 className="stat-label">Total Embeddings</h3>
          <p className="stat-value mt-2">{documents?.embeddingStats?.totalEmbeddings?.toLocaleString() || '0'}</p>
          <p className="text-sm text-muted-foreground mt-1">vector chunks</p>
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
                {documents?.documentsByType?.map((item, index) => (
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
                      {formatBytes((item as any).totalSize || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Recent Uploads Table */}
      {documents?.recentUploads && documents.recentUploads.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Uploads</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Uploaded By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {documents.recentUploads.map((doc) => (
                <tr key={doc.documentId}>
                  <td className="font-medium max-w-[200px] truncate">{doc.filename}</td>
                  <td className="text-muted-foreground">{doc.userEmail || '-'}</td>
                  <td className="text-muted-foreground">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Largest Documents Table */}
      {documents?.largestDocuments && documents.largestDocuments.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Largest Documents</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th className="text-right">Size</th>
                <th>Uploaded By</th>
              </tr>
            </thead>
            <tbody>
              {documents.largestDocuments.map((doc) => (
                <tr key={doc.documentId}>
                  <td className="font-medium max-w-[200px] truncate">{doc.filename}</td>
                  <td className="text-right">{doc.sizeMB.toFixed(2)} MB</td>
                  <td className="text-muted-foreground">{doc.userEmail || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
