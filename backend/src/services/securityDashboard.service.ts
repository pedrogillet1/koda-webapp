import { PrismaClient } from '@prisma/client';
import securityMonitoringService from './securityMonitoring.service';
import securityAlertingService from './securityAlerting.service';
import dataRetentionService from './dataRetention.service';
import rbacService from './rbac.service';
import { ThreatLevel } from '../types/security.types';

const prisma = new PrismaClient();

/**
 * Security Dashboard Service
 * Comprehensive security overview and analytics
 *
 * Features:
 * - Real-time security metrics
 * - Threat level overview
 * - Recent security events
 * - Active security alerts
 * - Data retention stats
 * - User activity analytics
 * - Compliance reporting
 */

interface SecurityOverview {
  timestamp: string;
  threatLevel: ThreatLevel;
  summary: {
    activeThreats: number;
    openAlerts: number;
    failedLogins24h: number;
    suspiciousSessions: number;
    dataRetentionPending: number;
  };
  recentEvents: any[];
  activeAlerts: any[];
  topThreats: any[];
  suspiciousIPs: any[];
  userActivityStats: any;
  complianceStatus: any;
}

interface SecurityTrends {
  period: string;
  metrics: {
    date: string;
    failedLogins: number;
    successfulLogins: number;
    securityEvents: number;
    alerts: number;
  }[];
}

class SecurityDashboardService {
  /**
   * Get comprehensive security overview
   */
  async getSecurityOverview(hours: number = 24): Promise<SecurityOverview> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      failedLogins,
      suspiciousSessions,
      recentSecurityEvents,
      activeAlerts,
      securityMetrics,
      retentionStats,
      userActivity,
    ] = await Promise.all([
      // Failed login attempts in the last 24h
      prisma.auditLog.count({
        where: {
          action: 'login_failed',
          createdAt: { gte: since },
        },
      }),

      // Suspicious sessions
      prisma.session.count({
        where: {
          isSuspicious: true,
          isActive: true,
        },
      }),

      // Recent security events (last 50)
      securityMonitoringService.getRecentSecurityEvents(50),

      // Active security alerts
      Promise.resolve([]), // TODO: Implement getActiveAlerts method

      // Security metrics from monitoring service
      securityMonitoringService.getSecurityMetrics(hours),

      // Data retention stats
      dataRetentionService.getRetentionStats(),

      // User activity stats
      this.getUserActivityStats(since),
    ]);

    // Calculate overall threat level based on active threats and alerts
    const threatLevel = this.calculateOverallThreatLevel(
      activeAlerts,
      failedLogins,
      suspiciousSessions
    );

    return {
      timestamp: new Date().toISOString(),
      threatLevel,
      summary: {
        activeThreats: securityMetrics.summary.unauthorizedAccess,
        openAlerts: activeAlerts.length,
        failedLogins24h: failedLogins,
        suspiciousSessions,
        dataRetentionPending: retentionStats.totalPendingCleanup || 0,
      },
      recentEvents: recentSecurityEvents.slice(0, 20),
      activeAlerts: activeAlerts.slice(0, 10),
      topThreats: securityMetrics.topThreats,
      suspiciousIPs: securityMetrics.suspiciousIPs,
      userActivityStats: userActivity,
      complianceStatus: {
        dataRetention: retentionStats,
        rbacPolicies: await rbacService.getAllRoles(),
      },
    };
  }

  /**
   * Get security trends over time
   */
  async getSecurityTrends(days: number = 7): Promise<SecurityTrends> {
    const trends: SecurityTrends = {
      period: `${days} days`,
      metrics: [],
    };

    for (let i = days - 1; i >= 0; i--) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - i);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);

      const [failedLogins, successfulLogins, securityEvents, alerts] = await Promise.all([
        prisma.auditLog.count({
          where: {
            action: 'login_failed',
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        prisma.auditLog.count({
          where: {
            action: 'login_success',
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        prisma.auditLog.count({
          where: {
            status: 'failure',
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        // Count alerts created on this day (assuming you have a SecurityAlert table)
        // For now, we'll estimate based on security events
        prisma.auditLog.count({
          where: {
            status: 'failure',
            createdAt: { gte: startDate, lte: endDate },
            // Filter for high-threat failed logins
          },
        }),
      ]);

      trends.metrics.push({
        date: startDate.toISOString().split('T')[0],
        failedLogins,
        successfulLogins,
        securityEvents,
        alerts,
      });
    }

    return trends;
  }

  /**
   * Get user activity statistics
   */
  private async getUserActivityStats(since: Date): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      newUsers,
      suspendedUsers,
      activeSessions,
    ] = await Promise.all([
      prisma.user.count(),
      // Active users count (users created in this period as proxy)
      prisma.user.count({
        where: {
          createdAt: { lte: since },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: since },
        },
      }),
      // Suspended users - using a placeholder
      Promise.resolve(0),
      prisma.session.count({
        where: {
          isActive: true,
          lastActivityAt: { gte: since },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsers,
      suspendedUsers,
      activeSessions,
      activityRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) + '%' : '0%',
    };
  }

  /**
   * Calculate overall threat level based on current security state
   */
  private calculateOverallThreatLevel(
    activeAlerts: any[],
    failedLogins: number,
    suspiciousSessions: number
  ): ThreatLevel {
    // Check for critical alerts
    const criticalAlerts = activeAlerts.filter(
      (alert) => alert.priority === 'critical'
    );
    if (criticalAlerts.length > 0) {
      return ThreatLevel.CRITICAL;
    }

    // Check for high-priority alerts or high failed login count
    const highAlerts = activeAlerts.filter((alert) => alert.priority === 'high');
    if (highAlerts.length > 2 || failedLogins > 50) {
      return ThreatLevel.HIGH;
    }

    // Check for medium threats
    if (activeAlerts.length > 5 || failedLogins > 20 || suspiciousSessions > 5) {
      return ThreatLevel.MEDIUM;
    }

    return ThreatLevel.LOW;
  }

  /**
   * Get security compliance report
   */
  async getComplianceReport(): Promise<any> {
    const [
      rbacRoles,
      retentionPolicies,
      auditLogCount,
      encryptedDocuments,
      totalDocuments,
    ] = await Promise.all([
      rbacService.getAllRoles(),
      dataRetentionService.getAllPolicies(),
      prisma.auditLog.count(),
      prisma.document.count({ where: { isEncrypted: true } }),
      prisma.document.count(),
    ]);

    const encryptionRate =
      totalDocuments > 0 ? ((encryptedDocuments / totalDocuments) * 100).toFixed(2) : '0';

    return {
      timestamp: new Date().toISOString(),
      rbac: {
        rolesConfigured: rbacRoles.length,
        systemRoles: rbacRoles.filter((r) => r.isSystem).length,
        customRoles: rbacRoles.filter((r) => !r.isSystem).length,
      },
      dataRetention: {
        policiesActive: retentionPolicies.length,
        auditLogsTracked: auditLogCount,
      },
      encryption: {
        encryptedDocuments,
        totalDocuments,
        encryptionRate: encryptionRate + '%',
      },
      auditTrail: {
        totalLogs: auditLogCount,
        coveragePeriod: '90 days (configurable)',
      },
    };
  }

  /**
   * Get top security concerns (actionable insights)
   */
  async getSecurityInsights(): Promise<any[]> {
    const insights: any[] = [];
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Check for repeated failed logins from same IPs
    const suspiciousIPs = await prisma.auditLog.groupBy({
      by: ['ipAddress'],
      where: {
        action: 'login_failed',
        createdAt: { gte: last24h },
        ipAddress: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          ipAddress: 'desc',
        },
      },
      take: 5,
    });

    if (suspiciousIPs.length > 0 && suspiciousIPs[0]._count >= 5) {
      insights.push({
        severity: 'high',
        category: 'authentication',
        title: 'Repeated Failed Login Attempts',
        description: `${suspiciousIPs.length} IP addresses with 5+ failed logins in 24h`,
        recommendation: 'Consider implementing IP-based rate limiting or blocking',
        affectedIPs: suspiciousIPs.map((ip) => ip.ipAddress),
      });
    }

    // Check for users with no MFA enabled
    const totalUsers = await prisma.user.count();
    const usersWithMFA = await prisma.twoFactorAuth.count({
      where: {
        isEnabled: true,
      },
    });
    const usersWithoutMFA = totalUsers - usersWithMFA;

    if (usersWithoutMFA > totalUsers * 0.5) {
      insights.push({
        severity: 'medium',
        category: 'authentication',
        title: 'Low MFA Adoption',
        description: `${usersWithoutMFA} of ${totalUsers} users have not enabled MFA`,
        recommendation: 'Encourage or enforce MFA for all user accounts',
      });
    }

    // Check for inactive sessions
    const inactiveSessions = await prisma.session.count({
      where: {
        isActive: true,
        lastActivityAt: { lt: last7d },
      },
    });

    if (inactiveSessions > 10) {
      insights.push({
        severity: 'low',
        category: 'session_management',
        title: 'Inactive Sessions Not Cleaned Up',
        description: `${inactiveSessions} sessions have been inactive for 7+ days`,
        recommendation: 'Run data retention cleanup to remove stale sessions',
      });
    }

    // Check for unencrypted documents
    const unencryptedDocs = await prisma.document.count({
      where: {
        isEncrypted: false,
        status: 'ready',
      },
    });

    if (unencryptedDocs > 0) {
      insights.push({
        severity: 'medium',
        category: 'data_protection',
        title: 'Unencrypted Documents',
        description: `${unencryptedDocs} documents are not encrypted at rest`,
        recommendation: 'Enable encryption for all new documents and consider migrating existing ones',
      });
    }

    return insights;
  }

  /**
   * Get real-time security status (for monitoring dashboards)
   */
  async getRealtimeStatus(): Promise<any> {
    const [activeAlerts, activeSessions, recentEvents] = await Promise.all([
      Promise.resolve([]), // TODO: Implement getActiveAlerts method
      prisma.session.count({ where: { isActive: true } }),
      securityMonitoringService.getRecentSecurityEvents(10),
    ]);

    return {
      timestamp: new Date().toISOString(),
      status:
        activeAlerts.filter((a: any) => a.priority === 'critical').length > 0
          ? 'critical'
          : activeAlerts.filter((a: any) => a.priority === 'high').length > 0
          ? 'warning'
          : 'normal',
      activeSessions,
      activeAlerts: activeAlerts.length,
      recentEvents: recentEvents.slice(0, 5),
    };
  }
}

export default new SecurityDashboardService();
