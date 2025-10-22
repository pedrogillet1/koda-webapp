import { PrismaClient } from '@prisma/client';
import { io } from '../server';
import auditLogService, { AuditStatus } from './auditLog.service';
import { SecurityEventType, ThreatLevel } from '../types/security.types';

const prisma = new PrismaClient();

/**
 * Security Alerting Service
 *
 * Real-time security alerting and notification system:
 * - Threat-based alert routing
 * - Multi-channel notifications (WebSocket, Email, SMS)
 * - Alert prioritization and deduplication
 * - Alert escalation workflows
 * - Alert acknowledgment and tracking
 */

export enum AlertChannel {
  WEBSOCKET = 'websocket',
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
}

export enum AlertPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}

interface SecurityAlert {
  id: string;
  eventType: SecurityEventType;
  threatLevel: ThreatLevel;
  priority: AlertPriority;
  title: string;
  description: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: any;
  channels: AlertChannel[];
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

interface AlertRule {
  id: string;
  name: string;
  eventType: SecurityEventType;
  condition: (event: any) => boolean;
  priority: AlertPriority;
  channels: AlertChannel[];
  enabled: boolean;
  cooldownMinutes: number; // Prevent alert spam
}

interface AlertNotification {
  alertId: string;
  channel: AlertChannel;
  recipient: string;
  sent: boolean;
  sentAt?: Date;
  error?: string;
}

class SecurityAlertingService {
  private alertRules: AlertRule[] = [];
  private recentAlerts: Map<string, Date> = new Map(); // For deduplication
  private alertCooldowns: Map<string, Date> = new Map(); // For rate limiting

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    this.alertRules = [
      {
        id: 'rule_brute_force',
        name: 'Brute Force Attack Detection',
        eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        condition: (event) => event.metadata?.attemptCount >= 5,
        priority: AlertPriority.CRITICAL,
        channels: [AlertChannel.WEBSOCKET, AlertChannel.EMAIL],
        enabled: true,
        cooldownMinutes: 15,
      },
      {
        id: 'rule_account_takeover',
        name: 'Potential Account Takeover',
        eventType: SecurityEventType.SUSPICIOUS_LOGIN,
        condition: (event) => event.threatLevel === ThreatLevel.CRITICAL,
        priority: AlertPriority.CRITICAL,
        channels: [AlertChannel.WEBSOCKET, AlertChannel.EMAIL, AlertChannel.SMS],
        enabled: true,
        cooldownMinutes: 5,
      },
      {
        id: 'rule_unauthorized_access',
        name: 'Unauthorized Access Attempt',
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        condition: (event) => true,
        priority: AlertPriority.HIGH,
        channels: [AlertChannel.WEBSOCKET],
        enabled: true,
        cooldownMinutes: 10,
      },
      {
        id: 'rule_api_abuse',
        name: 'API Abuse Detection',
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        condition: (event) => event.metadata?.violationCount >= 3,
        priority: AlertPriority.HIGH,
        channels: [AlertChannel.WEBSOCKET, AlertChannel.EMAIL],
        enabled: true,
        cooldownMinutes: 30,
      },
      {
        id: 'rule_data_exfiltration',
        name: 'Potential Data Exfiltration',
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        condition: (event) =>
          event.metadata?.activityType === 'bulk_download' ||
          event.metadata?.activityType === 'rapid_access',
        priority: AlertPriority.CRITICAL,
        channels: [AlertChannel.WEBSOCKET, AlertChannel.EMAIL],
        enabled: true,
        cooldownMinutes: 10,
      },
      {
        id: 'rule_privilege_escalation',
        name: 'Privilege Escalation Attempt',
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        condition: (event) =>
          event.metadata?.resource === 'admin' || event.metadata?.action === 'elevate',
        priority: AlertPriority.CRITICAL,
        channels: [AlertChannel.WEBSOCKET, AlertChannel.EMAIL],
        enabled: true,
        cooldownMinutes: 5,
      },
    ];

    console.log(`🚨 Initialized ${this.alertRules.length} alert rules`);
  }

  /**
   * Process security event and generate alerts
   */
  async processSecurityEvent(event: any): Promise<void> {
    try {
      // Find matching rules
      const matchingRules = this.alertRules.filter(
        (rule) =>
          rule.enabled &&
          rule.eventType === event.eventType &&
          rule.condition(event)
      );

      if (matchingRules.length === 0) {
        return; // No rules matched
      }

      // Process each matching rule
      for (const rule of matchingRules) {
        await this.createAlert(event, rule);
      }
    } catch (error) {
      console.error('Error processing security event for alerting:', error);
    }
  }

  /**
   * Create and send alert
   */
  private async createAlert(event: any, rule: AlertRule): Promise<void> {
    try {
      // Check cooldown
      const cooldownKey = `${rule.id}:${event.userId || event.ipAddress}`;
      if (this.isInCooldown(cooldownKey, rule.cooldownMinutes)) {
        console.log(`⏳ Alert cooldown active for ${rule.name}`);
        return;
      }

      // Create alert
      const alert: SecurityAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: event.eventType,
        threatLevel: event.threatLevel,
        priority: rule.priority,
        title: this.generateAlertTitle(event, rule),
        description: this.generateAlertDescription(event, rule),
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
        channels: rule.channels,
        status: AlertStatus.OPEN,
        createdAt: new Date(),
      };

      console.log(`🚨 SECURITY ALERT [${alert.priority.toUpperCase()}]: ${alert.title}`);

      // Send alert through configured channels
      await this.sendAlert(alert);

      // Set cooldown
      this.alertCooldowns.set(cooldownKey, new Date());

      // Audit log
      await auditLogService.log({
        userId: event.userId || 'system',
        action: 'security_alert_created' as any,
        status: AuditStatus.SUCCESS,
        details: {
          alertId: alert.id,
          priority: alert.priority,
          title: alert.title,
          rule: rule.name,
        },
      });
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }

  /**
   * Generate alert title
   */
  private generateAlertTitle(event: any, rule: AlertRule): string {
    const titles: Record<SecurityEventType, string> = {
      [SecurityEventType.BRUTE_FORCE_ATTEMPT]: `Brute Force Attack Detected${
        event.metadata?.attemptCount ? ` (${event.metadata.attemptCount} attempts)` : ''
      }`,
      [SecurityEventType.SUSPICIOUS_LOGIN]: `Suspicious Login from ${event.ipAddress}`,
      [SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT]: `Unauthorized Access to ${
        event.metadata?.resource || 'Protected Resource'
      }`,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: `API Rate Limit Exceeded`,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: `Suspicious Activity Detected`,
      [SecurityEventType.MALWARE_DETECTED]: `Malware Detected`,
      [SecurityEventType.ACCOUNT_LOCKOUT]: `Account Locked Due to Security Policy`,
      [SecurityEventType.PASSWORD_RESET_ABUSE]: `Password Reset Abuse Detected`,
      [SecurityEventType.DATA_BREACH_ATTEMPT]: `Potential Data Breach Detected`,
      [SecurityEventType.SQL_INJECTION_ATTEMPT]: `SQL Injection Attempt Blocked`,
      [SecurityEventType.XSS_ATTEMPT]: `XSS Attack Attempt Blocked`,
      [SecurityEventType.CSRF_DETECTED]: `CSRF Attack Detected`,
      [SecurityEventType.IP_BLACKLISTED]: `Request from Blacklisted IP`,
      [SecurityEventType.GEO_ANOMALY]: `Login from Unusual Location`,
      [SecurityEventType.SESSION_HIJACKING]: `Potential Session Hijacking`,
      [SecurityEventType.PRIVILEGE_ESCALATION]: `Privilege Escalation Attempt`,
      [SecurityEventType.CREDENTIAL_STUFFING]: `Credential Stuffing Attack Detected`,
      [SecurityEventType.ACCOUNT_TAKEOVER_ATTEMPT]: `Account Takeover Attempt`,
      [SecurityEventType.SUSPICIOUS_LOGIN_LOCATION]: `Suspicious Login Location`,
      [SecurityEventType.IMPOSSIBLE_TRAVEL]: `Impossible Travel Detected`,
      [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT]: `Privilege Escalation Attempt`,
      [SecurityEventType.CROSS_USER_ACCESS_ATTEMPT]: `Cross-User Access Attempt`,
      [SecurityEventType.MASS_DATA_EXFILTRATION]: `Mass Data Exfiltration Detected`,
      [SecurityEventType.RAPID_REQUESTS]: `Rapid Requests Detected`,
      [SecurityEventType.ABNORMAL_ACTIVITY_PATTERN]: `Abnormal Activity Pattern`,
      [SecurityEventType.SUSPICIOUS_IP_BEHAVIOR]: `Suspicious IP Behavior`,
      [SecurityEventType.BOT_DETECTED]: `Bot Activity Detected`,
      [SecurityEventType.PATH_TRAVERSAL_ATTEMPT]: `Path Traversal Attempt`,
      [SecurityEventType.CONCURRENT_SESSION_VIOLATION]: `Concurrent Session Violation`,
      [SecurityEventType.DOWNLOAD_LIMIT_EXCEEDED]: `Download Limit Exceeded`,
      [SecurityEventType.STORAGE_QUOTA_ABUSE]: `Storage Quota Abuse`,
    };

    const eventType = event.eventType as SecurityEventType;
    const title = titles[eventType];
    return title !== undefined ? title : `Security Event: ${event.eventType}`;
  }

  /**
   * Generate alert description
   */
  private generateAlertDescription(event: any, rule: AlertRule): string {
    let desc = `Security event detected matching rule: ${rule.name}\n\n`;
    desc += `Event Type: ${event.eventType}\n`;
    desc += `Threat Level: ${event.threatLevel}\n`;
    desc += `User: ${event.userId || 'Unknown'}\n`;
    desc += `IP Address: ${event.ipAddress || 'Unknown'}\n`;
    desc += `Time: ${new Date().toISOString()}\n`;

    if (event.description) {
      desc += `\nDetails: ${event.description}`;
    }

    return desc;
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: SecurityAlert): Promise<void> {
    const notifications: Promise<void>[] = [];

    for (const channel of alert.channels) {
      switch (channel) {
        case AlertChannel.WEBSOCKET:
          notifications.push(this.sendWebSocketAlert(alert));
          break;
        case AlertChannel.EMAIL:
          notifications.push(this.sendEmailAlert(alert));
          break;
        case AlertChannel.SMS:
          notifications.push(this.sendSMSAlert(alert));
          break;
        case AlertChannel.SLACK:
          notifications.push(this.sendSlackAlert(alert));
          break;
        case AlertChannel.PAGERDUTY:
          notifications.push(this.sendPagerDutyAlert(alert));
          break;
      }
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Send WebSocket alert (real-time)
   */
  private async sendWebSocketAlert(alert: SecurityAlert): Promise<void> {
    try {
      // Send to all admin users
      io.to('role:admin').emit('security-alert', {
        id: alert.id,
        priority: alert.priority,
        title: alert.title,
        description: alert.description,
        eventType: alert.eventType,
        threatLevel: alert.threatLevel,
        timestamp: alert.createdAt,
      });

      // Send to affected user if applicable
      if (alert.userId) {
        io.to(`user:${alert.userId}`).emit('security-alert', {
          id: alert.id,
          priority: alert.priority,
          title: alert.title,
          description: 'A security event has been detected on your account.',
          timestamp: alert.createdAt,
        });
      }

      console.log(`📡 WebSocket alert sent: ${alert.id}`);
    } catch (error) {
      console.error('Error sending WebSocket alert:', error);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: SecurityAlert): Promise<void> {
    try {
      // In production, integrate with email service (SendGrid, SES, etc.)
      console.log(`📧 Email alert would be sent: ${alert.title}`);
      // TODO: Implement email sending
    } catch (error) {
      console.error('Error sending email alert:', error);
    }
  }

  /**
   * Send SMS alert
   */
  private async sendSMSAlert(alert: SecurityAlert): Promise<void> {
    try {
      // In production, integrate with SMS service (Twilio, SNS, etc.)
      console.log(`📱 SMS alert would be sent: ${alert.title}`);
      // TODO: Implement SMS sending
    } catch (error) {
      console.error('Error sending SMS alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: SecurityAlert): Promise<void> {
    try {
      // In production, integrate with Slack API
      console.log(`💬 Slack alert would be sent: ${alert.title}`);
      // TODO: Implement Slack integration
    } catch (error) {
      console.error('Error sending Slack alert:', error);
    }
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: SecurityAlert): Promise<void> {
    try {
      // In production, integrate with PagerDuty API
      console.log(`📟 PagerDuty alert would be sent: ${alert.title}`);
      // TODO: Implement PagerDuty integration
    } catch (error) {
      console.error('Error sending PagerDuty alert:', error);
    }
  }

  /**
   * Check if alert is in cooldown period
   */
  private isInCooldown(key: string, cooldownMinutes: number): boolean {
    const lastAlert = this.alertCooldowns.get(key);
    if (!lastAlert) return false;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert.getTime() < cooldownMs;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      console.log(`✅ Alert acknowledged: ${alertId} by user ${userId}`);

      await auditLogService.log({
        userId,
        action: 'security_alert_acknowledged' as any,
        status: AuditStatus.SUCCESS,
        resource: alertId,
        details: {
          acknowledgedAt: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(
    alertId: string,
    userId: string,
    resolution: string
  ): Promise<boolean> {
    try {
      console.log(`✅ Alert resolved: ${alertId} by user ${userId}`);

      await auditLogService.log({
        userId,
        action: 'security_alert_resolved' as any,
        status: AuditStatus.SUCCESS,
        resource: alertId,
        details: {
          resolution,
          resolvedAt: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Mark alert as false positive
   */
  async markFalsePositive(alertId: string, userId: string, reason: string): Promise<boolean> {
    try {
      console.log(`⚠️  Alert marked as false positive: ${alertId}`);

      await auditLogService.log({
        userId,
        action: 'security_alert_false_positive' as any,
        status: AuditStatus.SUCCESS,
        resource: alertId,
        details: {
          reason,
          markedAt: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error marking alert as false positive:', error);
      return false;
    }
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.alertRules;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules[ruleIndex] = {
      ...this.alertRules[ruleIndex],
      ...updates,
    };

    console.log(`✅ Alert rule updated: ${ruleId}`);
    return true;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    console.log(`✅ Alert rule added: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const initialLength = this.alertRules.length;
    this.alertRules = this.alertRules.filter((r) => r.id !== ruleId);
    return this.alertRules.length < initialLength;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): any {
    return {
      totalRules: this.alertRules.length,
      enabledRules: this.alertRules.filter((r) => r.enabled).length,
      activeCooldowns: this.alertCooldowns.size,
    };
  }
}

export default new SecurityAlertingService();
export { SecurityAlert, AlertRule, AlertNotification };
