/**
 * AdminRoute Component
 *
 * PURPOSE: Protected route wrapper that checks for admin access
 */

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Loader } from 'lucide-react';
import './AdminStyles.css';

// Admin emails list (should match backend)
const ADMIN_EMAILS = [
  'admin@koda.com',
  'pedro@koda.com',
  'pedro@getkoda.ai'
];

const AdminRoute = ({ children }) => {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (authLoading) return;

      if (!user || !accessToken) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Quick client-side check first
      const isAdminByEmail = ADMIN_EMAILS.includes(user.email?.toLowerCase());
      const isAdminByRole = user.role === 'admin' || user.role === 'super_admin';

      if (!isAdminByEmail && !isAdminByRole) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Verify with backend by trying to access analytics
      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/analytics/quick-stats`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (response.ok) {
          setIsAdmin(true);
        } else if (response.status === 403) {
          setIsAdmin(false);
          setError('You do not have admin access');
        } else {
          setIsAdmin(false);
          setError('Failed to verify admin access');
        }
      } catch (err) {
        console.error('Admin check error:', err);
        // If network error, fallback to client-side check
        setIsAdmin(isAdminByEmail || isAdminByRole);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [user, accessToken, authLoading]);

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="admin-loading" style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Loader className="admin-spinner" size={40} />
        <p>Verifying admin access...</p>
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  // Not admin - show access denied
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: 20
      }}>
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          maxWidth: 400,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <ShieldAlert size={32} color="#EF4444" />
          </div>

          <h2 style={{ margin: '0 0 12px', color: '#1e293b' }}>
            Admin Access Required
          </h2>

          <p style={{ margin: '0 0 24px', color: '#64748b', lineHeight: 1.6 }}>
            {error || 'You need admin privileges to access this page. Please contact your administrator if you believe this is an error.'}
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => window.history.back()}
              style={{
                padding: '10px 20px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: 8,
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '10px 20px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin verified - render children
  return children;
};

export default AdminRoute;
