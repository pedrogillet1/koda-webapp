import { PrismaClient } from '@prisma/client';
import auditLogService, { AuditAction, AuditStatus } from './auditLog.service';
import securityAlertingService from './securityAlerting.service';
import { ThreatLevel, SecurityEventType } from '../types/security.types';

const prisma = new PrismaClient();

/**
 * Enhanced Security Monitoring Service
 * Real-time threat detection and security event tracking
 * Complements existing audit logging with advanced threat detection
 */

// Re-export types for backwards compatibility
export { ThreatLevel, SecurityEventType };

interface SecurityEvent {
  eventType: SecurityEventType;
  threatLevel: ThreatLevel;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  metadata?: Record<string, any>;
}

interface ThreatAnalysis {
  threatLevel: ThreatLevel;
  confidence: number; // 0-1
  indicators: string[];
  recommendedAction: string;
}

class SecurityMonitoringService {
  /**
   * Record a security event
   */
  async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      console.log(`🚨 Security Event: [${event.threatLevel.toUpperCase()}] ${event.eventType}`);
      console.log(`   Description: ${event.description}`);
      console.log(`   User: ${event.userId || 'anonymous'}, IP: ${event.ipAddress || 'unknown'}`);

      // Store in audit log with special security event marker
      await auditLogService.log({
        userId: event.userId,
        action: event.eventType as any, // Security events are special audit actions
        status: AuditStatus.FAILURE,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: {
          threatLevel: event.threatLevel,
          description: event.description,
          metadata: event.metadata,
          timestamp: new Date().toISOString(),
        },
      });

      // Process event through alerting service
      await securityAlertingService.processSecurityEvent({
        ...event,
        eventType: event.eventType as any,
      });
    } catch (error) {
      console.error('❌ Failed to record security event:', error);
    }
  }

  /**
   * Detect brute force login attempts
   */
  async detectBruteForce(userId: string, ipAddress: string): Promise<ThreatAnalysis> {
    const timeWindow = 15; // minutes
    const since = new Date(Date.now() - timeWindow * 60 * 1000);

    // Get failed login attempts from this IP in the time window
    const failedAttempts = await prisma.auditLog.count({
      where: {
        action: AuditAction.LOGIN_FAILED,
        ipAddress,
        createdAt: { gte: since },
      },
    });

    // Get failed attempts for this user
    const userFailedAttempts = await prisma.auditLog.count({
      where: {
        action: AuditAction.LOGIN_FAILED,
        userId,
        createdAt: { gte: since },
      },
    });

    const indicators: string[] = [];
    let threatLevel = ThreatLevel.LOW;
    let confidence = 0;

    if (failedAttempts >= 10) {
      indicators.push(`${failedAttempts} failed attempts from IP in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.CRITICAL;
      confidence = 0.95;
    } else if (failedAttempts >= 5) {
      indicators.push(`${failedAttempts} failed attempts from IP in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.HIGH;
      confidence = 0.8;
    } else if (userFailedAttempts >= 3) {
      indicators.push(`${userFailedAttempts} failed attempts for user in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.MEDIUM;
      confidence = 0.6;
    }

    // Record security event if threat detected
    if (threatLevel !== ThreatLevel.LOW) {
      await this.recordSecurityEvent({
        eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        threatLevel,
        userId,
        ipAddress,
        description: `Brute force attack detected: ${failedAttempts} attempts from IP`,
        metadata: {
          failedAttemptsFromIP: failedAttempts,
          failedAttemptsForUser: userFailedAttempts,
          timeWindowMinutes: timeWindow,
        },
      });
    }

    return {
      threatLevel,
      confidence,
      indicators,
      recommendedAction:
        threatLevel === ThreatLevel.CRITICAL
          ? 'Block IP immediately and notify user'
          : threatLevel === ThreatLevel.HIGH
          ? 'Temporarily block IP and require CAPTCHA'
          : threatLevel === ThreatLevel.MEDIUM
          ? 'Increase rate limiting and monitor'
          : 'Continue monitoring',
    };
  }

  /**
   * Detect mass data exfiltration
   */
  async detectMassDownload(userId: string, ipAddress: string): Promise<ThreatAnalysis> {
    const timeWindow = 60; // minutes
    const since = new Date(Date.now() - timeWindow * 60 * 1000);

    // Count downloads in time window
    const downloadCount = await prisma.auditLog.count({
      where: {
        userId,
        action: AuditAction.DOCUMENT_DOWNLOAD,
        createdAt: { gte: since },
      },
    });

    const indicators: string[] = [];
    let threatLevel = ThreatLevel.LOW;
    let confidence = 0;

    if (downloadCount >= 50) {
      indicators.push(`${downloadCount} downloads in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.CRITICAL;
      confidence = 0.9;
    } else if (downloadCount >= 25) {
      indicators.push(`${downloadCount} downloads in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.HIGH;
      confidence = 0.75;
    } else if (downloadCount >= 15) {
      indicators.push(`${downloadCount} downloads in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.MEDIUM;
      confidence = 0.6;
    }

    if (threatLevel !== ThreatLevel.LOW) {
      await this.recordSecurityEvent({
        eventType: SecurityEventType.MASS_DATA_EXFILTRATION,
        threatLevel,
        userId,
        ipAddress,
        description: `Mass download detected: ${downloadCount} documents in ${timeWindow} minutes`,
        metadata: {
          downloadCount,
          timeWindowMinutes: timeWindow,
        },
      });
    }

    return {
      threatLevel,
      confidence,
      indicators,
      recommendedAction:
        threatLevel === ThreatLevel.CRITICAL
          ? 'Block user account and notify admin immediately'
          : threatLevel === ThreatLevel.HIGH
          ? 'Suspend downloads and require re-authentication'
          : threatLevel === ThreatLevel.MEDIUM
          ? 'Throttle downloads and monitor closely'
          : 'Continue monitoring',
    };
  }

  /**
   * Detect suspicious IP behavior
   */
  async detectSuspiciousIP(ipAddress: string): Promise<ThreatAnalysis> {
    const timeWindow = 60; // minutes
    const since = new Date(Date.now() - timeWindow * 60 * 1000);

    // Get all actions from this IP
    const actions = await prisma.auditLog.findMany({
      where: {
        ipAddress,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    const indicators: string[] = [];
    let threatLevel = ThreatLevel.LOW;
    let confidence = 0;

    // Count unique users accessed from this IP
    const uniqueUsers = new Set(actions.map(a => a.userId).filter(Boolean));
    if (uniqueUsers.size >= 10) {
      indicators.push(`Multiple accounts (${uniqueUsers.size}) accessed from single IP`);
      threatLevel = ThreatLevel.HIGH;
      confidence = 0.85;
    } else if (uniqueUsers.size >= 5) {
      indicators.push(`${uniqueUsers.size} different accounts from single IP`);
      threatLevel = ThreatLevel.MEDIUM;
      confidence = 0.7;
    }

    // Count failed actions
    const failedActions = actions.filter(a => a.status === 'failure').length;
    const failureRate = failedActions / actions.length;
    if (failureRate > 0.5 && actions.length >= 10) {
      indicators.push(`High failure rate: ${(failureRate * 100).toFixed(0)}%`);
      if (threatLevel === ThreatLevel.LOW || threatLevel === ThreatLevel.MEDIUM) {
        threatLevel = ThreatLevel.HIGH;
      }
      confidence = confidence > 0.8 ? confidence : 0.8;
    }

    // Rapid requests
    if (actions.length >= 100) {
      indicators.push(`Rapid requests: ${actions.length} actions in ${timeWindow} minutes`);
      if (threatLevel === ThreatLevel.LOW) {
        threatLevel = ThreatLevel.MEDIUM;
      }
      confidence = confidence > 0.75 ? confidence : 0.75;
    }

    if (threatLevel !== ThreatLevel.LOW) {
      await this.recordSecurityEvent({
        eventType: SecurityEventType.SUSPICIOUS_IP_BEHAVIOR,
        threatLevel,
        ipAddress,
        description: `Suspicious IP behavior detected`,
        metadata: {
          uniqueUsers: uniqueUsers.size,
          totalActions: actions.length,
          failedActions,
          failureRate: (failureRate * 100).toFixed(2) + '%',
          timeWindowMinutes: timeWindow,
        },
      });
    }

    return {
      threatLevel,
      confidence,
      indicators,
      recommendedAction:
        threatLevel === ThreatLevel.HIGH
          ? 'Block IP and review all actions'
          : threatLevel === ThreatLevel.MEDIUM
          ? 'Increase monitoring and require CAPTCHA'
          : 'Continue monitoring',
    };
  }

  /**
   * Detect impossible travel (login from geographically distant locations in short time)
   */
  async detectImpossibleTravel(
    userId: string,
    currentIpAddress: string,
    currentCountry?: string,
    currentCity?: string
  ): Promise<ThreatAnalysis> {
    const indicators: string[] = [];
    let threatLevel = ThreatLevel.LOW;
    let confidence = 0;

    try {
      // Get the user's most recent active session (excluding current one)
      const lastSession = await prisma.session.findFirst({
        where: {
          userId,
          isActive: true,
          ipAddress: { not: currentIpAddress },
          country: { not: null },
        },
        orderBy: { lastActivityAt: 'desc' },
      });

      if (!lastSession || !lastSession.country || !currentCountry) {
        // No previous location data to compare
        return {
          threatLevel: ThreatLevel.LOW,
          confidence: 0,
          indicators: [],
          recommendedAction: 'Continue monitoring',
        };
      }

      // Calculate time difference in hours
      const timeDiffMs = Date.now() - lastSession.lastActivityAt.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      // If same country, check if different city and time is suspicious
      if (lastSession.country === currentCountry) {
        if (lastSession.city && currentCity && lastSession.city !== currentCity && timeDiffHours < 0.5) {
          indicators.push(`Different city within same country in ${timeDiffHours.toFixed(1)} hours`);
          threatLevel = ThreatLevel.MEDIUM;
          confidence = 0.6;
        }
      } else {
        // Different countries - check if travel time is physically impossible
        // Approximate travel time calculation based on typical flight speeds
        // Maximum reasonable speed: ~800 mph for commercial flights + airport time

        const approximateDistance = this.estimateDistanceBetweenCountries(
          lastSession.country,
          currentCountry
        );

        // If we can estimate distance, check travel feasibility
        if (approximateDistance > 0) {
          const maxRealisticSpeed = 800; // mph (commercial flight + airport time buffer)
          const minimumTravelTime = approximateDistance / maxRealisticSpeed; // hours

          if (timeDiffHours < minimumTravelTime) {
            indicators.push(
              `Impossible travel: ${lastSession.country} to ${currentCountry} in ${timeDiffHours.toFixed(1)} hours (minimum ${minimumTravelTime.toFixed(1)} hours)`
            );
            threatLevel = ThreatLevel.CRITICAL;
            confidence = 0.95;
          } else if (timeDiffHours < minimumTravelTime * 1.5) {
            indicators.push(
              `Suspicious travel: ${lastSession.country} to ${currentCountry} in ${timeDiffHours.toFixed(1)} hours`
            );
            threatLevel = ThreatLevel.HIGH;
            confidence = 0.8;
          } else if (timeDiffHours < 6 && approximateDistance > 500) {
            indicators.push(
              `Rapid international travel: ${lastSession.country} to ${currentCountry}`
            );
            threatLevel = ThreatLevel.MEDIUM;
            confidence = 0.7;
          }
        } else {
          // Can't estimate distance, but different countries in short time is suspicious
          if (timeDiffHours < 2) {
            indicators.push(
              `Different countries in ${timeDiffHours.toFixed(1)} hours: ${lastSession.country} → ${currentCountry}`
            );
            threatLevel = ThreatLevel.HIGH;
            confidence = 0.75;
          } else if (timeDiffHours < 6) {
            indicators.push(
              `International travel detected: ${lastSession.country} → ${currentCountry}`
            );
            threatLevel = ThreatLevel.MEDIUM;
            confidence = 0.65;
          }
        }
      }

      // Record security event if threat detected
      if (threatLevel !== ThreatLevel.LOW) {
        await this.recordSecurityEvent({
          eventType: SecurityEventType.IMPOSSIBLE_TRAVEL,
          threatLevel,
          userId,
          ipAddress: currentIpAddress,
          description: `Impossible travel detected: ${lastSession.country} to ${currentCountry}`,
          metadata: {
            previousLocation: {
              country: lastSession.country,
              city: lastSession.city,
              ipAddress: lastSession.ipAddress,
              timestamp: lastSession.lastActivityAt.toISOString(),
            },
            currentLocation: {
              country: currentCountry,
              city: currentCity,
              ipAddress: currentIpAddress,
              timestamp: new Date().toISOString(),
            },
            timeDifferenceHours: timeDiffHours.toFixed(2),
          },
        });
      }

      return {
        threatLevel,
        confidence,
        indicators,
        recommendedAction:
          threatLevel === ThreatLevel.CRITICAL
            ? 'Block login and require identity verification'
            : threatLevel === ThreatLevel.HIGH
            ? 'Require additional authentication (MFA/email verification)'
            : threatLevel === ThreatLevel.MEDIUM
            ? 'Send security notification to user'
            : 'Continue monitoring',
      };
    } catch (error) {
      console.error('❌ Error detecting impossible travel:', error);
      return {
        threatLevel: ThreatLevel.LOW,
        confidence: 0,
        indicators: [],
        recommendedAction: 'Continue monitoring',
      };
    }
  }

  /**
   * Estimate distance between countries (simplified approximation)
   * Returns approximate distance in miles, or 0 if can't estimate
   */
  private estimateDistanceBetweenCountries(country1: string, country2: string): number {
    // Approximate distances for common country pairs
    // In production, use proper geolocation API with lat/lon coordinates
    const distanceMap: Record<string, Record<string, number>> = {
      US: { UK: 3500, JP: 6300, CN: 6900, IN: 8000, AU: 9500, BR: 4800, MX: 1200 },
      UK: { US: 3500, JP: 5900, CN: 5100, IN: 4500, AU: 9500, BR: 5500 },
      JP: { US: 6300, UK: 5900, CN: 1200, IN: 3600, AU: 4800 },
      CN: { US: 6900, UK: 5100, JP: 1200, IN: 2300, AU: 5600 },
      IN: { US: 8000, UK: 4500, JP: 3600, CN: 2300, AU: 6100 },
      AU: { US: 9500, UK: 9500, JP: 4800, CN: 5600, IN: 6100 },
      BR: { US: 4800, UK: 5500 },
    };

    const c1 = country1.toUpperCase();
    const c2 = country2.toUpperCase();

    return distanceMap[c1]?.[c2] || distanceMap[c2]?.[c1] || 0;
  }

  /**
   * Detect unauthorized access patterns
   */
  async detectUnauthorizedAccess(userId: string): Promise<ThreatAnalysis> {
    const timeWindow = 60; // minutes
    const since = new Date(Date.now() - timeWindow * 60 * 1000);

    // Get failed access attempts (401/403 errors)
    const unauthorizedAttempts = await prisma.auditLog.count({
      where: {
        userId,
        status: 'failure',
        createdAt: { gte: since },
      },
    });

    const indicators: string[] = [];
    let threatLevel = ThreatLevel.LOW;
    let confidence = 0;

    if (unauthorizedAttempts >= 20) {
      indicators.push(`${unauthorizedAttempts} unauthorized access attempts in ${timeWindow} minutes`);
      threatLevel = ThreatLevel.HIGH;
      confidence = 0.85;
    } else if (unauthorizedAttempts >= 10) {
      indicators.push(`${unauthorizedAttempts} unauthorized access attempts`);
      threatLevel = ThreatLevel.MEDIUM;
      confidence = 0.7;
    }

    if (threatLevel !== ThreatLevel.LOW) {
      await this.recordSecurityEvent({
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        threatLevel,
        userId,
        description: `Multiple unauthorized access attempts detected`,
        metadata: {
          attemptCount: unauthorizedAttempts,
          timeWindowMinutes: timeWindow,
        },
      });
    }

    return {
      threatLevel,
      confidence,
      indicators,
      recommendedAction:
        threatLevel === ThreatLevel.HIGH
          ? 'Review account permissions and notify user of suspicious activity'
          : threatLevel === ThreatLevel.MEDIUM
          ? 'Monitor closely and log all actions'
          : 'Continue monitoring',
    };
  }

  /**
   * Get security dashboard metrics
   */
  async getSecurityMetrics(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      failedLogins,
      unauthorizedAccess,
      totalEvents,
      topThreats,
      suspiciousIPs,
    ] = await Promise.all([
      // Failed login attempts
      prisma.auditLog.count({
        where: {
          action: AuditAction.LOGIN_FAILED,
          createdAt: { gte: since },
        },
      }),

      // Unauthorized access attempts
      prisma.auditLog.count({
        where: {
          status: 'failure',
          createdAt: { gte: since },
        },
      }),

      // Total security events
      prisma.auditLog.count({
        where: {
          createdAt: { gte: since },
        },
      }),

      // Top security events
      prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          status: 'failure',
          createdAt: { gte: since },
        },
        _count: true,
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 5,
      }),

      // Suspicious IPs (multiple failed attempts)
      prisma.auditLog.groupBy({
        by: ['ipAddress'],
        where: {
          status: 'failure',
          createdAt: { gte: since },
          ipAddress: { not: null },
        },
        _count: true,
        orderBy: {
          _count: {
            ipAddress: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      period: `${hours} hours`,
      summary: {
        totalEvents,
        failedLogins,
        unauthorizedAccess,
        successRate: ((totalEvents - unauthorizedAccess) / totalEvents * 100).toFixed(2) + '%',
      },
      topThreats: topThreats.map(t => ({
        action: t.action,
        count: t._count,
      })),
      suspiciousIPs: suspiciousIPs
        .filter(ip => ip._count >= 5)
        .map(ip => ({
          ipAddress: ip.ipAddress,
          failedAttempts: ip._count,
        })),
    };
  }

  /**
   * Trigger security alert (can be extended to send emails/Slack notifications)
   */
  private async triggerSecurityAlert(event: SecurityEvent): Promise<void> {
    // In production, this would send alerts via:
    // - Email to security team
    // - Slack webhook
    // - PagerDuty
    // - Security SIEM system

    console.error('🚨🚨🚨 CRITICAL SECURITY ALERT 🚨🚨🚨');
    console.error('Event Type:', event.eventType);
    console.error('Threat Level:', event.threatLevel);
    console.error('Description:', event.description);
    console.error('User:', event.userId || 'anonymous');
    console.error('IP:', event.ipAddress || 'unknown');
    console.error('Time:', new Date().toISOString());
    console.error('Metadata:', JSON.stringify(event.metadata, null, 2));

    // TODO: Integrate with alerting services
    // await emailService.sendSecurityAlert(event);
    // await slackService.postToSecurityChannel(event);
  }

  /**
   * Get recent security events
   */
  async getRecentSecurityEvents(limit: number = 50) {
    return prisma.auditLog.findMany({
      where: {
        status: 'failure',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
   * Get security events for a specific user
   */
  async getUserSecurityEvents(userId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: {
        userId,
        status: 'failure',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export default new SecurityMonitoringService();
