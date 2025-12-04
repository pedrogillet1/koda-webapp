import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Use relative path to go through Vite proxy
const API_URL = '/api';

const ADMIN_EMAILS = [
  'admin@koda.com',
  'pedro@koda.com',
  'pedro@getkoda.ai',
  'localhost@koda.com'
];

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: (email?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('analytics_token')
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useCallback((email?: string) => {
    const checkEmail = email || user?.email;
    return ADMIN_EMAILS.includes(checkEmail?.toLowerCase() || '');
  }, [user]);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('analytics_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.user && isAdmin(response.data.user.email)) {
          setUser(response.data.user);
          setAccessToken(token);
        } else {
          localStorage.removeItem('analytics_token');
          setError('Not an admin account');
        }
      } catch (err) {
        console.error('Auth verify error:', err);
        localStorage.removeItem('analytics_token');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [isAdmin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);

    if (!isAdmin(email)) {
      setError('This account does not have admin access');
      return false;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      });

      if (response.data.accessToken) {
        localStorage.setItem('analytics_token', response.data.accessToken);
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        return true;
      } else {
        setError(response.data.message || 'Login failed');
        return false;
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Network error. Please try again.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('analytics_token');
    setUser(null);
    setAccessToken(null);
  };

  const isAuthenticated = !!user && !!accessToken;

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      loading,
      error,
      isAuthenticated,
      login,
      logout,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
