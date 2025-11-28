import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook to fetch and manage user storage information
 * Returns storage usage, limits, and utility functions
 */
export function useStorage() {
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch storage info from API
  const fetchStorage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/storage');
      setStorageInfo(response.data);
    } catch (err) {
      console.error('Failed to fetch storage info:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch storage info');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user has capacity for a file
  const checkCapacity = useCallback(async (fileSize) => {
    try {
      const response = await api.post('/storage/check-capacity', { fileSize });
      return response.data;
    } catch (err) {
      console.error('Failed to check capacity:', err);
      throw err;
    }
  }, []);

  // Refresh storage info
  const refresh = useCallback(() => {
    fetchStorage();
  }, [fetchStorage]);

  // Fetch on mount
  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  return {
    storageInfo,
    loading,
    error,
    refresh,
    checkCapacity,
    // Convenience getters
    used: storageInfo?.used || 0,
    limit: storageInfo?.limit || 0,
    available: storageInfo?.available || 0,
    usedPercentage: storageInfo?.usedPercentage || 0,
    usedFormatted: storageInfo?.usedFormatted || '0 B',
    limitFormatted: storageInfo?.limitFormatted || '0 B',
    availableFormatted: storageInfo?.availableFormatted || '0 B'
  };
}

export default useStorage;
