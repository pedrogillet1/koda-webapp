import api from './api';

const authService = {
  /**
   * Register a new user (creates pending user, requires verification)
   * @param {Object} userData - { name, email, password }
   * @returns {Promise<Object>} - { message, email, requiresVerification }
   */
  async register(userData) {
    try {
      const response = await api.post('/api/auth/register', userData);

      // New flow: no tokens returned, user must verify email and phone first
      // Store email temporarily for verification flow
      if (response.data.requiresVerification) {
        localStorage.setItem('pendingEmail', response.data.email);
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Verify email code for pending user (now completes registration)
   * @param {Object} data - { email, code }
   * @returns {Promise<Object>} - User data with tokens
   */
  async verifyPendingEmail(data) {
    try {
      const response = await api.post('/api/auth/pending/verify-email', data);

      // Email verification now completes registration and returns tokens
      if (response.data.tokens && response.data.tokens.accessToken) {
        localStorage.setItem('accessToken', response.data.tokens.accessToken);
        localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.removeItem('pendingEmail'); // Clean up
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Resend email verification code for pending user
   * @param {Object} data - { email }
   * @returns {Promise<Object>} - Success response
   */
  async resendPendingEmail(data) {
    try {
      const response = await api.post('/api/auth/pending/resend-email', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Add phone number to pending user
   * @param {Object} data - { email, phoneNumber }
   * @returns {Promise<Object>} - Success response
   */
  async addPendingPhone(data) {
    try {
      const response = await api.post('/api/auth/pending/add-phone', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Verify phone code and complete registration
   * @param {Object} data - { email, code }
   * @returns {Promise<Object>} - User data with tokens
   */
  async verifyPendingPhone(data) {
    try {
      const response = await api.post('/api/auth/pending/verify-phone', data);

      // Registration complete, store tokens and user data
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.removeItem('pendingEmail'); // Clean up
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Login user
   * @param {Object} credentials - { email, password }
   * @returns {Promise<Object>} - User data or 2FA requirement
   */
  async login(credentials) {
    try {
      const response = await api.post('/api/auth/login', credentials);

      // If 2FA is required, return that status
      if (response.data.requires2FA) {
        return {
          requires2FA: true,
          userId: response.data.userId,
          tempToken: response.data.tempToken,
        };
      }

      // Otherwise, store tokens and user data
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Verify 2FA code during login
   * @param {Object} data - { userId, token, tempToken }
   * @returns {Promise<Object>} - User data with tokens
   */
  async verify2FALogin(data) {
    try {
      const response = await api.post('/api/auth/2fa/verify-login', data);

      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  /**
   * Enable 2FA for the current user
   * @returns {Promise<Object>} - { secret, qrCodeUrl, backupCodes }
   */
  async enable2FA() {
    try {
      const response = await api.post('/api/auth/2fa/enable');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Verify 2FA setup with a token
   * @param {Object} data - { token }
   * @returns {Promise<Object>} - Success confirmation
   */
  async verify2FA(data) {
    try {
      const response = await api.post('/api/auth/2fa/verify', data);

      // Update user data to reflect 2FA is enabled
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.twoFactorEnabled = true;
      localStorage.setItem('user', JSON.stringify(user));

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Disable 2FA
   * @param {Object} data - { token }
   * @returns {Promise<Object>} - Success confirmation
   */
  async disable2FA(data) {
    try {
      const response = await api.post('/api/auth/2fa/disable', data);

      // Update user data to reflect 2FA is disabled
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.twoFactorEnabled = false;
      localStorage.setItem('user', JSON.stringify(user));

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Get 2FA backup codes
   * @returns {Promise<Object>} - { backupCodes }
   */
  async getBackupCodes() {
    try {
      const response = await api.get('/api/auth/2fa/backup-codes');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  /**
   * Login with Google OAuth
   * Redirects to Google OAuth page
   */
  loginWithGoogle() {
    window.location.href = `${process.env.REACT_APP_API_URL}/api/auth/google`;
  },

  /**
   * Get current user from localStorage
   * @returns {Object|null} - User data or null
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    const accessToken = localStorage.getItem('accessToken');
    const user = this.getCurrentUser();
    return !!(accessToken && user);
  },

  /**
   * Handle API errors
   * @param {Error} error - Axios error
   * @returns {Error} - Formatted error
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.message || error.response.data?.error || 'An error occurred';
      const err = new Error(message);
      err.status = error.response.status;
      err.data = error.response.data;
      return err;
    } else if (error.request) {
      // Request made but no response
      return new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      return new Error(error.message || 'An unexpected error occurred');
    }
  },
};

export default authService;
