// Centralized error messages for consistent user feedback
export const ERROR_MESSAGES = {
  // Document operations
  DOWNLOAD_FAILED: 'Failed to download document. Please try again.',
  DELETE_FAILED: 'Failed to delete item. Please try again.',
  RENAME_FAILED: 'Failed to rename item. Please try again.',
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',
  MOVE_FAILED: 'Failed to move item. Please try again.',

  // Folder operations
  CREATE_FOLDER_FAILED: 'Failed to create folder. Please try again.',
  DELETE_FOLDER_FAILED: 'Failed to delete folder. Please try again.',

  // Category operations
  CREATE_CATEGORY_FAILED: 'Failed to create category. Please try again.',
  DELETE_CATEGORY_FAILED: 'Failed to delete category. Please try again.',

  // Network errors
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',

  // Auth errors
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',

  // Generic
  NOT_FOUND: 'Item not found.',
  GENERIC_ERROR: 'An error occurred. Please try again.'
};

export default ERROR_MESSAGES;
