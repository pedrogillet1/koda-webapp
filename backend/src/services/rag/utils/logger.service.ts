/**
 * Logger Service - A+ Implementation
 * Structured logging with Pino (replaces all console.log statements)
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON output
 * - PII redaction
 * - Performance optimized (async)
 * - Environment-aware (pretty print in dev)
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pino = require('pino');

// Create logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Pretty print in development
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Redact PII
  redact: {
    paths: ['userId', 'email', 'user.email', 'query'],
    censor: '[REDACTED]',
  },

  // Base context
  base: {
    service: 'koda-rag',
    environment: process.env.NODE_ENV || 'development',
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, any>
) {
  logger.info({
    operation,
    durationMs,
    ...metadata,
  }, `${operation} completed in ${durationMs}ms`);
}

/**
 * Log error with context
 */
export function logError(
  error: Error,
  context: Record<string, any>,
  message?: string
) {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  }, message || error.message);
}

export default logger;
