/**
 * Admin Components Index
 *
 * Export all admin dashboard components
 */

// Styles (must be imported first)
import './AdminStyles.css';

// Layout and routing
export { default as AdminLayout } from './AdminLayout';
export { default as AdminRoute } from './AdminRoute';

// Reusable components
export { default as MetricCard } from './MetricCard';
export { default as DataTable } from './DataTable';

// Pages
export { default as AdminOverview } from './AdminOverview';
export { default as AdminUsers } from './AdminUsers';
export { default as AdminConversations } from './AdminConversations';
export { default as AdminDocuments } from './AdminDocuments';
export { default as AdminSystemHealth } from './AdminSystemHealth';
export { default as AdminCosts } from './AdminCosts';
export { default as AdminRealtime } from './AdminRealtime';
