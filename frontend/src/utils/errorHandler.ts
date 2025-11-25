export interface AppError {
  title: string;
  message: string;
  type: 'network' | 'api' | 'timeout' | 'auth' | 'unknown';
  retryable: boolean;
  originalError?: any;
}

/**
 * Convert various error types to user-friendly AppError
 */
export function handleError(error: any): AppError {

  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      type: 'network',
      retryable: true,
      originalError: error
    };
  }

  // Timeout errors
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long to complete. Please try again.',
      type: 'timeout',
      retryable: true,
      originalError: error
    };
  }

  // API errors with response object
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return {
          title: 'Invalid Request',
          message: data?.error || 'The request was invalid. Please try again.',
          type: 'api',
          retryable: false,
          originalError: error
        };

      case 401:
        return {
          title: 'Authentication Required',
          message: 'Your session has expired. Please log in again.',
          type: 'auth',
          retryable: false,
          originalError: error
        };

      case 403:
        return {
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          type: 'auth',
          retryable: false,
          originalError: error
        };

      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource was not found.',
          type: 'api',
          retryable: false,
          originalError: error
        };

      case 429:
        return {
          title: 'Too Many Requests',
          message: 'You are sending requests too quickly. Please wait a moment and try again.',
          type: 'api',
          retryable: true,
          originalError: error
        };

      case 500:
      case 502:
      case 503:
        return {
          title: 'Server Error',
          message: 'The server encountered an error. Please try again in a moment.',
          type: 'api',
          retryable: true,
          originalError: error
        };

      default:
        return {
          title: 'Error',
          message: data?.error || error.message || 'An unexpected error occurred.',
          type: 'unknown',
          retryable: true,
          originalError: error
        };
    }
  }

  // API errors with status property (axios-like)
  if (error.status) {
    switch (error.status) {
      case 400:
        return {
          title: 'Invalid Request',
          message: error.message || 'The request was invalid. Please try again.',
          type: 'api',
          retryable: false,
          originalError: error
        };

      case 401:
        return {
          title: 'Authentication Required',
          message: 'Your session has expired. Please log in again.',
          type: 'auth',
          retryable: false,
          originalError: error
        };

      case 403:
        return {
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          type: 'auth',
          retryable: false,
          originalError: error
        };

      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource was not found.',
          type: 'api',
          retryable: false,
          originalError: error
        };

      case 429:
        return {
          title: 'Too Many Requests',
          message: 'You are sending requests too quickly. Please wait a moment and try again.',
          type: 'api',
          retryable: true,
          originalError: error
        };

      case 500:
      case 502:
      case 503:
        return {
          title: 'Server Error',
          message: 'The server encountered an error. Please try again in a moment.',
          type: 'api',
          retryable: true,
          originalError: error
        };

      default:
        return {
          title: 'Error',
          message: error.message || 'An unexpected error occurred.',
          type: 'unknown',
          retryable: true,
          originalError: error
        };
    }
  }

  // Generic errors
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred. Please try again.',
    type: 'unknown',
    retryable: true,
    originalError: error
  };
}
