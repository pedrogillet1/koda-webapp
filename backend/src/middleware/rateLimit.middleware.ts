import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth endpoints rate limiter (stricter)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs (increased for development)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * 2FA verification rate limiter (very strict)
 */
export const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 attempts per windowMs
  message: 'Too many 2FA attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI/Chat endpoints rate limiter
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many AI requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * File upload endpoints rate limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // 200 uploads per hour (increased to support batch folder uploads)
  message: 'Upload limit reached, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Document download endpoints rate limiter
 */
export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 downloads per minute
  message: 'Too many downloads, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Document search endpoints rate limiter
 * Prevents brute-force document discovery attacks
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 searches per minute
  message: 'Too many search requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Suspicious activity rate limiter (VERY STRICT)
 * Applied when suspicious patterns are detected
 */
export const suspiciousActivityLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Only 10 requests per hour when flagged as suspicious
  message: 'Your account has been temporarily restricted due to suspicious activity. Please contact support.',
  standardHeaders: true,
  legacyHeaders: false,
});
