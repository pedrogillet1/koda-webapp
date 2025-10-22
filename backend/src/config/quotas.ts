export const QUOTA_TIERS = {
  free: {
    storageLimit: 1073741824,
    documentLimit: 50,
    maxFileSize: 10485760,
    aiRequestsPerDay: 50,
    features: ['basic_ocr', 'folders', 'search', 'chat']
  },
  personal: {
    storageLimit: 10737418240,
    documentLimit: 500,
    maxFileSize: 26214400,
    aiRequestsPerDay: 200,
    features: ['basic_ocr', 'folders', 'search', 'chat', 'voice', 'tags', 'summaries']
  },
  premium: {
    storageLimit: 53687091200,
    documentLimit: null,
    maxFileSize: 52428800,
    aiRequestsPerDay: 1000,
    features: ['basic_ocr', 'folders', 'search', 'chat', 'voice', 'tags', 'summaries', 'comparison', 'cloud_import']
  },
  business: {
    storageLimit: 536870912000,
    documentLimit: null,
    maxFileSize: 104857600,
    aiRequestsPerDay: null,
    features: ['all']
  }
};

export const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return size.toFixed(2) + ' ' + units[unitIndex];
};
