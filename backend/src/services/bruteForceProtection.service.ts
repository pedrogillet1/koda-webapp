import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import securityMonitoringService, { SecurityEventType, ThreatLevel } from './securityMonitoring.service';
import { blacklistIP } from '../middleware/ipFilter.middleware';

const prisma = new PrismaClient();

/**
 * Brute Force Protection Service
 *
 * Features:
 * - Progressive delays (exponential backoff)
 * - Account lockout after threshold
 * - IP-based rate limiting
 * - User-based rate limiting
 * - Automatic IP blacklisting
 * - CAPTCHA trigger
 * - Distributed attack detection
 */

interface AttemptRecord {
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
  locked: boolean;
  lockUntil?: Date;
}

// In-memory storage for attempt tracking (use Redis in production)
const ipAttempts = new Map<string, AttemptRecord>();
const userAttempts = new Map<string, AttemptRecord>();

interface BruteForceConfig {
  maxAttemptsPerIP: number;
  maxAttemptsPerUser: number;
  windowMinutes: number;
  lockoutDurationMinutes: number;
  progressiveDelayEnabled: boolean;
  autoBlacklistEnabled: boolean;
  autoBlacklistThreshold: number;
  captchaThreshold: number;
}

const config: BruteForceConfig = {
  maxAttemptsPerIP: 10,
  maxAttemptsPerUser: 5,
  windowMinutes: 15,
  lockoutDurationMinutes: 30,
  progressiveDelayEnabled: true,
  autoBlacklistEnabled: true,
  autoBlacklistThreshold: 20,
  captchaThreshold: 3,
};

/**
 * Extract IP from request
 */
const getIPAddress = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] as string ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Calculate progressive delay based on attempt count
 * Exponential backoff: 2^attempts seconds
 */
const calculateDelay = (attempts: number): number => {
  if (!config.progressiveDelayEnabled) return 0;

  // Max delay of 60 seconds
  return Math.min(Math.pow(2, attempts) * 1000, 60000);
};

/**
 * Clean up expired records
 */
const cleanupExpired = (attempts: Map<string, AttemptRecord>) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.windowMinutes * 60 * 1000);

  for (const [key, record] of attempts.entries()) {
    // Remove if window expired and not locked
    if (record.firstAttempt < cutoff && !record.locked) {
      attempts.delete(key);
    }

    // Remove if lock expired
    if (record.locked && record.lockUntil && record.lockUntil < now) {
      attempts.delete(key);
    }
  }
};

/**
 * Record a failed login attempt
 */
export const recordFailedAttempt = async (
  identifier: string,
  type: 'ip' | 'user',
  req: Request
): Promise<{ blocked: boolean; reason?: string; delayMs?: number; requiresCaptcha?: boolean }> => {
  const attempts = type === 'ip' ? ipAttempts : userAttempts;
  const maxAttempts = type === 'ip' ? config.maxAttemptsPerIP : config.maxAttemptsPerUser;

  // Cleanup expired records
  cleanupExpired(attempts);

  const now = new Date();
  const record = attempts.get(identifier);

  if (!record) {
    // First attempt
    attempts.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
      locked: false,
    });

    return { blocked: false };
  }

  // Check if currently locked
  if (record.locked && record.lockUntil && record.lockUntil > now) {
    const remainingMinutes = Math.ceil((record.lockUntil.getTime() - now.getTime()) / (60 * 1000));

    await securityMonitoringService.recordSecurityEvent({
      eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      threatLevel: ThreatLevel.HIGH,
      ipAddress: type === 'ip' ? identifier : getIPAddress(req),
      userId: type === 'user' ? identifier : undefined,
      userAgent: req.headers['user-agent'],
      description: `Attempt while locked out (${record.count} previous attempts)`,
      metadata: {
        attemptCount: record.count,
        remainingLockoutMinutes: remainingMinutes,
      },
    });

    return {
      blocked: true,
      reason: `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`,
    };
  }

  // Increment attempt count
  record.count++;
  record.lastAttempt = now;

  // Check if CAPTCHA should be required
  const requiresCaptcha = record.count >= config.captchaThreshold;

  // Check if threshold exceeded
  if (record.count >= maxAttempts) {
    // Lock the account/IP
    record.locked = true;
    record.lockUntil = new Date(now.getTime() + config.lockoutDurationMinutes * 60 * 1000);

    await securityMonitoringService.recordSecurityEvent({
      eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      threatLevel: ThreatLevel.CRITICAL,
      ipAddress: type === 'ip' ? identifier : getIPAddress(req),
      userId: type === 'user' ? identifier : undefined,
      userAgent: req.headers['user-agent'],
      description: `Brute force threshold exceeded - ${type} locked`,
      metadata: {
        attemptCount: record.count,
        lockoutDurationMinutes: config.lockoutDurationMinutes,
        type,
      },
    });

    // Auto-blacklist IP if configured
    if (config.autoBlacklistEnabled && type === 'ip' && record.count >= config.autoBlacklistThreshold) {
      blacklistIP(identifier, `Brute force: ${record.count} failed attempts`, 24 * 60 * 60 * 1000); // 24 hours
    }

    return {
      blocked: true,
      reason: `Too many failed attempts. ${type === 'user' ? 'Account' : 'IP'} locked for ${config.lockoutDurationMinutes} minutes.`,
    };
  }

  // Calculate progressive delay
  const delayMs = calculateDelay(record.count);

  // Log warning if approaching threshold
  if (record.count >= maxAttempts - 2) {
    await securityMonitoringService.recordSecurityEvent({
      eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      threatLevel: ThreatLevel.MEDIUM,
      ipAddress: type === 'ip' ? identifier : getIPAddress(req),
      userId: type === 'user' ? identifier : undefined,
      userAgent: req.headers['user-agent'],
      description: `Approaching brute force threshold (${record.count}/${maxAttempts} attempts)`,
      metadata: {
        attemptCount: record.count,
        maxAttempts,
        remainingAttempts: maxAttempts - record.count,
      },
    });
  }

  return {
    blocked: false,
    delayMs,
    requiresCaptcha,
  };
};

/**
 * Record a successful login (reset counters)
 */
export const recordSuccessfulAttempt = (identifier: string, type: 'ip' | 'user'): void => {
  const attempts = type === 'ip' ? ipAttempts : userAttempts;
  attempts.delete(identifier);

  console.log(`✅ ${type} ${identifier} - failed attempts reset after successful login`);
};

/**
 * Check if IP or user is locked
 */
export const isLocked = (identifier: string, type: 'ip' | 'user'): boolean => {
  const attempts = type === 'ip' ? ipAttempts : userAttempts;
  const record = attempts.get(identifier);

  if (!record || !record.locked) return false;

  // Check if lock expired
  if (record.lockUntil && record.lockUntil < new Date()) {
    attempts.delete(identifier);
    return false;
  }

  return true;
};

/**
 * Manually unlock an IP or user (admin action)
 */
export const unlock = (identifier: string, type: 'ip' | 'user'): boolean => {
  const attempts = type === 'ip' ? ipAttempts : userAttempts;
  const record = attempts.get(identifier);

  if (record) {
    attempts.delete(identifier);
    console.log(`✅ ${type} ${identifier} manually unlocked`);
    return true;
  }

  return false;
};

/**
 * Get attempt status for monitoring
 */
export const getAttemptStatus = (identifier: string, type: 'ip' | 'user') => {
  const attempts = type === 'ip' ? ipAttempts : userAttempts;
  const record = attempts.get(identifier);

  if (!record) {
    return {
      attempts: 0,
      locked: false,
      requiresCaptcha: false,
    };
  }

  return {
    attempts: record.count,
    locked: record.locked,
    lockUntil: record.lockUntil,
    requiresCaptcha: record.count >= config.captchaThreshold,
    remainingAttempts: Math.max(0, config.maxAttemptsPerUser - record.count),
  };
};

/**
 * Detect distributed brute force attacks (multiple IPs targeting same user)
 */
export const detectDistributedAttack = async (userId: string): Promise<boolean> => {
  const since = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  // Get failed login attempts for this user
  const attempts = await prisma.auditLog.findMany({
    where: {
      userId,
      action: 'login_failed',
      createdAt: { gte: since },
    },
    select: {
      ipAddress: true,
    },
  });

  // Count unique IPs
  const uniqueIPs = new Set(attempts.map(a => a.ipAddress).filter(Boolean));

  // If attempts from 5+ different IPs, likely distributed attack
  if (uniqueIPs.size >= 5 && attempts.length >= 10) {
    await securityMonitoringService.recordSecurityEvent({
      eventType: SecurityEventType.CREDENTIAL_STUFFING,
      threatLevel: ThreatLevel.CRITICAL,
      userId,
      description: `Distributed brute force attack detected: ${attempts.length} attempts from ${uniqueIPs.size} IPs`,
      metadata: {
        attemptCount: attempts.length,
        uniqueIPCount: uniqueIPs.size,
        timeWindowMinutes: config.windowMinutes,
      },
    });

    return true;
  }

  return false;
};

/**
 * Get brute force protection statistics
 */
export const getStatistics = () => {
  cleanupExpired(ipAttempts);
  cleanupExpired(userAttempts);

  const lockedIPs = Array.from(ipAttempts.values()).filter(r => r.locked).length;
  const lockedUsers = Array.from(userAttempts.values()).filter(r => r.locked).length;

  return {
    config,
    stats: {
      trackedIPs: ipAttempts.size,
      trackedUsers: userAttempts.size,
      lockedIPs,
      lockedUsers,
      totalAttempts: {
        ip: Array.from(ipAttempts.values()).reduce((sum, r) => sum + r.count, 0),
        user: Array.from(userAttempts.values()).reduce((sum, r) => sum + r.count, 0),
      },
    },
  };
};

/**
 * Configure brute force protection
 */
export const configure = (newConfig: Partial<BruteForceConfig>) => {
  Object.assign(config, newConfig);
  console.log('✅ Brute force protection configured:', config);
};

/**
 * Reset all tracking (use with caution)
 */
export const resetAll = () => {
  ipAttempts.clear();
  userAttempts.clear();
  console.log('✅ All brute force tracking data cleared');
};

/**
 * Apply progressive delay
 */
export const applyDelay = (delayMs: number): Promise<void> => {
  if (delayMs === 0) return Promise.resolve();

  return new Promise(resolve => setTimeout(resolve, delayMs));
};

export default {
  recordFailedAttempt,
  recordSuccessfulAttempt,
  isLocked,
  unlock,
  getAttemptStatus,
  detectDistributedAttack,
  getStatistics,
  configure,
  resetAll,
  applyDelay,
};
