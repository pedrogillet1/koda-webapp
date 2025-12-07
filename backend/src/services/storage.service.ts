/**
 * Storage Service - STUB (service removed)
 */

export const hasCapacity = async () => ({ hasCapacity: true, required: 0, available: 10 * 1024 * 1024 * 1024, shortfall: 0 });
export const getStorageInfo = async () => ({ used: 0, total: 10 * 1024 * 1024 * 1024, available: 10 * 1024 * 1024 * 1024 });
export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
export const incrementStorage = async (_userId: string, _bytes: number) => {};
export const decrementStorage = async (_userId: string, _bytes: number) => {};

export default {
  hasCapacity,
  getStorageInfo,
  formatBytes,
  incrementStorage,
  decrementStorage,
};
