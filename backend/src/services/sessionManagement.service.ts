import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import crypto from 'crypto';
import securityMonitoringService, { SecurityEventType, ThreatLevel } from './securityMonitoring.service';

const prisma = new PrismaClient();

/**
 * Advanced Session Management Service
 *
 * Features:
 * - IP binding and validation
 * - Device fingerprinting and tracking
 * - Geolocation tracking
 * - Concurrent session management
 * - Suspicious activity detection
 * - Session hijacking prevention
 */

interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  country?: string;
  city?: string;
}

interface DeviceInfo {
  deviceId: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  deviceName: string;
  browser: string;
  os: string;
}

class SessionManagementService {
  /**
   * Extract request metadata for session tracking
   */
  private extractRequestMetadata(req: Request): SessionMetadata {
    const ipAddress = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress ||
      'unknown'
    );

    const userAgent = req.headers['user-agent'] || 'unknown';

    return {
      ipAddress,
      userAgent,
    };
  }

  /**
   * Parse device information from user agent
   */
  private parseDeviceInfo(userAgent: string): DeviceInfo {
    // Simple device detection without UAParser to avoid TypeScript issues
    const isMobile = /mobile/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const deviceType: 'mobile' | 'desktop' | 'tablet' = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Extract browser and OS from user agent using simple regex
    let browser = 'Unknown Browser';
    if (/chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    let os = 'Unknown OS';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/mac/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/ios|iphone|ipad/i.test(userAgent)) os = 'iOS';

    const deviceName = `${browser} on ${os}`;

    // Generate device ID from user agent components
    const deviceId = this.generateDeviceId(userAgent, os, browser);

    return {
      deviceId,
      deviceType,
      deviceName,
      browser,
      os,
    };
  }

  /**
   * Generate a unique device identifier
   */
  private generateDeviceId(userAgent: string, os: string, browser: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${userAgent}${os}${browser}`)
      .digest('hex');
    return hash.substring(0, 32);
  }

  /**
   * Create a new session with IP binding and device tracking
   */
  async createSession(
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    req: Request
  ): Promise<any> {
    const metadata = this.extractRequestMetadata(req);
    const deviceInfo = this.parseDeviceInfo(metadata.userAgent);

    // Check for existing sessions from this device
    const existingSessions = await this.getUserSessions(userId);
    const sameDeviceSessions = existingSessions.filter(
      s => s.deviceId === deviceInfo.deviceId && s.isActive
    );

    // Create the session
    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        ipAddress: metadata.ipAddress,
        lastIpAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        isActive: true,
      },
    });

    console.log(`✅ Session created for user ${userId} on ${deviceInfo.deviceName}`);
    console.log(`   Device ID: ${deviceInfo.deviceId}`);
    console.log(`   IP: ${metadata.ipAddress}`);

    // If there are too many active sessions from the same device, flag as suspicious
    if (sameDeviceSessions.length >= 3) {
      await securityMonitoringService.recordSecurityEvent({
        eventType: SecurityEventType.CONCURRENT_SESSION_VIOLATION,
        threatLevel: ThreatLevel.MEDIUM,
        userId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        description: `Multiple concurrent sessions from same device (${sameDeviceSessions.length + 1} sessions)`,
        metadata: {
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          activeSessionCount: sameDeviceSessions.length + 1,
        },
      });
    }

    return session;
  }

  /**
   * Validate session against IP binding and device tracking
   */
  async validateSession(
    sessionId: string,
    req: Request
  ): Promise<{ valid: boolean; reason?: string; session?: any }> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (!session.isActive) {
      return { valid: false, reason: 'Session inactive' };
    }

    if (session.expiresAt < new Date()) {
      await this.invalidateSession(sessionId, 'expired');
      return { valid: false, reason: 'Session expired' };
    }

    // Extract current request metadata
    const metadata = this.extractRequestMetadata(req);
    const deviceInfo = this.parseDeviceInfo(metadata.userAgent);

    // Check IP binding (allow IP changes but log them)
    const ipChanged = session.lastIpAddress !== metadata.ipAddress;
    if (ipChanged) {
      console.log(`⚠️  IP address changed for session ${sessionId}`);
      console.log(`   Old: ${session.lastIpAddress}, New: ${metadata.ipAddress}`);

      // Check for impossible travel (IP from different countries within short time)
      const timeSinceLastActivity = Date.now() - session.lastActivityAt.getTime();
      const minutesSinceLastActivity = timeSinceLastActivity / (1000 * 60);

      // If IP changed within 5 minutes, this could be suspicious
      if (minutesSinceLastActivity < 5) {
        await securityMonitoringService.recordSecurityEvent({
          eventType: SecurityEventType.SUSPICIOUS_LOGIN_LOCATION,
          threatLevel: ThreatLevel.HIGH,
          userId: session.userId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          description: 'Rapid IP address change detected (possible session hijacking)',
          metadata: {
            sessionId,
            oldIp: session.lastIpAddress,
            newIp: metadata.ipAddress,
            minutesSinceLastActivity,
          },
        });

        // Mark session as suspicious but don't invalidate immediately
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            isSuspicious: true,
            suspicionReason: 'Rapid IP change',
          },
        });
      }

      // Update last IP
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          lastIpAddress: metadata.ipAddress,
        },
      });
    }

    // Check device binding (strict check - device should not change)
    const deviceChanged = session.deviceId !== deviceInfo.deviceId;
    if (deviceChanged) {
      console.log(`🚨 Device changed for session ${sessionId}`);
      console.log(`   Old: ${session.deviceId}, New: ${deviceInfo.deviceId}`);

      await securityMonitoringService.recordSecurityEvent({
        eventType: SecurityEventType.ACCOUNT_TAKEOVER_ATTEMPT,
        threatLevel: ThreatLevel.CRITICAL,
        userId: session.userId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        description: 'Device fingerprint mismatch - possible session hijacking',
        metadata: {
          sessionId,
          oldDeviceId: session.deviceId,
          newDeviceId: deviceInfo.deviceId,
          oldDeviceName: session.deviceName,
          newDeviceName: deviceInfo.deviceName,
        },
      });

      // Invalidate session immediately - device should NEVER change
      await this.invalidateSession(sessionId, 'device_mismatch');
      return {
        valid: false,
        reason: 'Device mismatch - session invalidated for security',
      };
    }

    // Update last activity timestamp
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: new Date(),
      },
    });

    return { valid: true, session };
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string, reason: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        suspicionReason: reason,
      },
    });

    console.log(`❌ Session ${sessionId} invalidated: ${reason}`);
  }

  /**
   * Invalidate all sessions for a user (e.g., on password change)
   */
  async invalidateAllUserSessions(userId: string, except?: string): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        ...(except && { id: { not: except } }),
      },
      data: {
        isActive: false,
        suspicionReason: 'All sessions invalidated by user',
      },
    });

    console.log(`❌ Invalidated ${result.count} sessions for user ${userId}`);
    return result.count;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<any[]> {
    return prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gte: new Date() },
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
    });
  }

  /**
   * Get session details for security dashboard
   */
  async getSessionDetails(sessionId: string): Promise<any> {
    return prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Revoke a specific session (user-initiated)
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      return false;
    }

    await this.invalidateSession(sessionId, 'User revoked session');
    return true;
  }

  /**
   * Clean up expired sessions (cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    console.log(`🧹 Cleaned up ${result.count} expired sessions`);
    return result.count;
  }

  /**
   * Get security summary for user's sessions
   */
  async getUserSessionSummary(userId: string) {
    const sessions = await this.getUserSessions(userId);

    const suspiciousSessions = sessions.filter(s => s.isSuspicious);
    const uniqueDevices = new Set(sessions.map(s => s.deviceId));
    const uniqueIPs = new Set(sessions.map(s => s.lastIpAddress));

    return {
      totalActiveSessions: sessions.length,
      suspiciousSessionCount: suspiciousSessions.length,
      uniqueDevices: uniqueDevices.size,
      uniqueIPs: uniqueIPs.size,
      sessions: sessions.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        ipAddress: s.lastIpAddress,
        lastActivityAt: s.lastActivityAt,
        isSuspicious: s.isSuspicious,
        suspicionReason: s.suspicionReason,
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * Detect and handle suspicious session patterns
   */
  async detectSuspiciousSessionPatterns(userId: string): Promise<any> {
    const sessions = await this.getUserSessions(userId);

    const indicators: string[] = [];
    let threatLevel = ThreatLevel.LOW;

    // Check for too many concurrent sessions
    if (sessions.length > 10) {
      indicators.push(`Excessive concurrent sessions: ${sessions.length}`);
      threatLevel = ThreatLevel.HIGH;
    }

    // Check for sessions from too many different IPs
    const uniqueIPs = new Set(sessions.map(s => s.lastIpAddress));
    if (uniqueIPs.size > 5) {
      indicators.push(`Sessions from ${uniqueIPs.size} different IP addresses`);
      if (threatLevel === ThreatLevel.LOW) {
        threatLevel = ThreatLevel.MEDIUM;
      }
    }

    // Check for sessions with multiple suspicious flags
    const suspiciousSessions = sessions.filter(s => s.isSuspicious);
    if (suspiciousSessions.length >= 2) {
      indicators.push(`${suspiciousSessions.length} sessions flagged as suspicious`);
      threatLevel = ThreatLevel.HIGH;
    }

    if (indicators.length > 0) {
      await securityMonitoringService.recordSecurityEvent({
        eventType: SecurityEventType.ABNORMAL_ACTIVITY_PATTERN,
        threatLevel,
        userId,
        description: `Suspicious session pattern detected`,
        metadata: {
          indicators,
          totalSessions: sessions.length,
          uniqueIPs: uniqueIPs.size,
          suspiciousSessions: suspiciousSessions.length,
        },
      });
    }

    return {
      threatLevel,
      indicators,
      suspiciousSessionCount: suspiciousSessions.length,
      recommendedAction:
        threatLevel === ThreatLevel.HIGH
          ? 'Review and revoke suspicious sessions immediately'
          : threatLevel === ThreatLevel.MEDIUM
          ? 'Monitor closely for further suspicious activity'
          : 'No action required',
    };
  }
}

export default new SessionManagementService();
