import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const storedUser = authService.getCurrentUser();
      const authenticated = authService.isAuthenticated();

      if (storedUser && authenticated) {
        setUser(storedUser);
        setIsAuthenticated(true);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Register a new user (creates pending user, requires verification)
   */
  const register = async (userData) => {
    try {
      const response = await authService.register(userData);

      // New flow: no tokens returned, user must verify email and phone first
      // Don't set user or auth state yet
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify email code for pending user (now completes registration and logs user in)
   */
  const verifyPendingEmail = async (data) => {
    try {
      const response = await authService.verifyPendingEmail(data);

      // Email verification now completes registration and returns tokens
      if (response.user && response.tokens) {
        setUser(response.user);
        setIsAuthenticated(true);
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Resend email verification code for pending user
   */
  const resendPendingEmail = async (data) => {
    try {
      const response = await authService.resendPendingEmail(data);
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Add phone number to pending user
   */
  const addPendingPhone = async (data) => {
    try {
      const response = await authService.addPendingPhone(data);
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify phone code and complete registration
   */
  const verifyPendingPhone = async (data) => {
    try {
      const response = await authService.verifyPendingPhone(data);

      // Registration complete, set user and auth state
      if (response.user && response.accessToken) {
        setUser(response.user);
        setIsAuthenticated(true);
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Login user
   */
  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);

      // If 2FA is required, don't set user yet
      if (response.requires2FA) {
        return response;
      }

      // Otherwise, set user and auth state
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify 2FA during login
   */
  const verify2FALogin = async (data) => {
    try {
      const response = await authService.verify2FALogin(data);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  /**
   * Enable 2FA
   */
  const enable2FA = async () => {
    try {
      const response = await authService.enable2FA();
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify 2FA setup
   */
  const verify2FA = async (data) => {
    try {
      const response = await authService.verify2FA(data);

      // Update user state
      setUser((prevUser) => ({
        ...prevUser,
        twoFactorEnabled: true,
      }));

      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Disable 2FA
   */
  const disable2FA = async (data) => {
    try {
      const response = await authService.disable2FA(data);

      // Update user state
      setUser((prevUser) => ({
        ...prevUser,
        twoFactorEnabled: false,
      }));

      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Get backup codes
   */
  const getBackupCodes = async () => {
    try {
      const response = await authService.getBackupCodes();
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Login with Google
   */
  const loginWithGoogle = () => {
    authService.loginWithGoogle();
  };

  /**
   * Update user data in state
   */
  const updateUser = (userData) => {
    setUser((prevUser) => ({
      ...prevUser,
      ...userData,
    }));

    // Also update localStorage
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...userData }));
    }
  };

  /**
   * Set authentication state (for OAuth callback)
   */
  const setAuthState = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    register,
    verifyPendingEmail,
    resendPendingEmail,
    addPendingPhone,
    verifyPendingPhone,
    login,
    logout,
    verify2FALogin,
    enable2FA,
    verify2FA,
    disable2FA,
    getBackupCodes,
    loginWithGoogle,
    updateUser,
    setAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
