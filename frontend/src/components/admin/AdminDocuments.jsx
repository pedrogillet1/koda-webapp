/**
 * AdminDocuments Component
 *
 * PURPOSE: Document and storage analytics
 */

import React from 'react';
import {
  FileText,
  HardDrive,
  Upload,
  TrendingUp,
  Database,
  AlertCircle,
  File
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
import { useDocumentAnalytics } from '../../hooks/useAnalytics';
import './AdminStyles.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const AdminDocuments = () => {
  const { data: documents, loading, error } = useDocumentAnalytics();

  // Format date for charts
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Prepare chart data
  const uploadTrendData = documents?.uploadTrend?.map(item => ({
    date: formatDate(item.date),
    uploads: item.count
  })) || [];

  const documentTypesData = documents?.documentsByType?.slice(0, 8).map(item => {
    const type = item.type.split('/').pop() || 'Unknown';
    return {
      name: type.length > 10 ? type.substring(0, 10) + '...' : type,
      value: item.count,
      fullName: item.type
    };
  }) || [];

  const documentStatusData = documents?.documentsByStatus?.map(item => ({
    name: item.status,
    value: item.count
  })) || [];

  // Largest documents table columns
  const largestDocumentsColumns = [
    { key: 'filename', label: 'Filename' },
    { key: 'userEmail', label: 'Owner' },
    {
      key: 'sizeMB',
      label: 'Size',
      align: 'right',
      render: (val) => `${val.toFixed(2)} MB`
    }
  ];

  // Recent uploads table columns
  const recentUploadsColumns = [
    { key: 'filename', label: 'Filename' },
    { key: 'userEmail', label: 'Uploaded By' },
    { key: 'uploadedAt', label: 'Date', format: 'datetime' }
  ];

  if (error) {
    return (
      <AdminLayout title="Documents" subtitle="Document and storage analytics">
        <div className="admin-error">
          <div className="admin-error-icon">
            <AlertCircle size={24} />
          </div>
          <h3>Failed to load document analytics</h3>
          <p>{error}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Documents" subtitle="Document and storage analytics">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Documents"
          value={documents?.totalDocuments}
          icon={FileText}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="Uploaded Today"
          value={documents?.documentsUploadedToday}
          icon={Upload}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Uploaded This Week"
          value={documents?.documentsUploadedThisWeek}
          icon={Upload}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Uploaded This Month"
          value={documents?.documentsUploadedThisMonth}
          icon={Upload}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Storage Metrics */}
      <div className="admin-section">
        <h2 className="admin-section-title">Storage Metrics</h2>
        <div className="metrics-grid">
          <MetricCard
            title="Total Storage"
            value={documents?.totalStorageGB?.toFixed(2)}
            icon={HardDrive}
            color="blue"
            loading={loading}
            subtitle="GB used"
          />
          <MetricCard
            title="Avg Document Size"
            value={formatBytes(documents?.avgDocumentSizeBytes || 0)}
            icon={File}
            color="purple"
            loading={loading}
          />
          <MetricCard
            title="Total Embeddings"
            value={documents?.embeddingStats?.totalEmbeddings}
            icon={Database}
            color="green"
            loading={loading}
            subtitle="vector chunks"
          />
          <MetricCard
            title="Avg Chunks/Doc"
            value={documents?.embeddingStats?.avgChunksPerDocument}
            icon={TrendingUp}
            color="yellow"
            loading={loading}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="admin-grid-2">
        {/* Upload Trend */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Upload Trend</h3>
              <p className="chart-subtitle">Documents uploaded per day (last 30 days)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={uploadTrendData}>
              <defs>
                <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="uploads"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorUploads)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Document Types */}
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Document Types</h3>
              <p className="chart-subtitle">Distribution by file type</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={documentTypesData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
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
                formatter={(value, name, props) => [value, props.payload.fullName]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Document Status */}
      {documentStatusData.length > 0 && (
        <div className="chart-container">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Document Status</h3>
              <p className="chart-subtitle">Processing status distribution</p>
            </div>
          </div>
          <div className="metrics-grid" style={{ marginBottom: 0 }}>
            {documentStatusData.map((status, index) => (
              <MetricCard
                key={status.name}
                title={status.name}
                value={status.value}
                color={
                  status.name === 'completed' ? 'green' :
                  status.name === 'processing' ? 'yellow' :
                  status.name === 'failed' ? 'red' : 'blue'
                }
                size="small"
              />
            ))}
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="admin-grid-2">
        <DataTable
          title="Largest Documents"
          columns={largestDocumentsColumns}
          data={documents?.largestDocuments || []}
          loading={loading}
          pageSize={10}
        />

        <DataTable
          title="Recent Uploads"
          columns={recentUploadsColumns}
          data={documents?.recentUploads?.slice(0, 10) || []}
          loading={loading}
          pagination={false}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminDocuments;
