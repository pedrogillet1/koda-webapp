import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

/**
 * Audit Log Service
 * Tracks all user actions for compliance and security
 * CRITICAL for legal/banking customers (GDPR, SOC 2, ISO 27001)
 */

export enum AuditAction {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR_ENABLED = '2fa_enabled',
  TWO_FACTOR_DISABLED = '2fa_disabled',

  // Document Operations
  DOCUMENT_UPLOAD = 'document_upload',
  DOCUMENT_VIEW = 'document_view',
  DOCUMENT_DOWNLOAD = 'document_download',
  DOCUMENT_DELETE = 'document_delete',
  DOCUMENT_SHARE = 'document_share',
  DOCUMENT_UNSHARE = 'document_unshare',
  DOCUMENT_UPDATE = 'document_update',

  // Folder Operations
  FOLDER_CREATE = 'folder_create',
  FOLDER_DELETE = 'folder_delete',
  FOLDER_MOVE = 'folder_move',

  // AI/Chat Operations
  AI_QUERY = 'ai_query',
  AI_QUERY_FAILED = 'ai_query_failed',

  // Settings
  SETTINGS_UPDATE = 'settings_update',
  ACCOUNT_DELETE = 'account_delete',

  // Chat/Analysis Operations
  CHAT_DOCUMENT_ANALYSIS = 'chat_document_analysis',
  CHAT_ATTACHMENT_EDITED = 'chat_attachment_edited',
  CHAT_ATTACHMENT_EXPORTED = 'chat_attachment_exported',

  // Admin Actions
  USER_ROLE_CHANGE = 'user_role_change',
  PERMISSION_GRANT = 'permission_grant',
  PERMISSION_REVOKE = 'permission_revoke',
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resource?: string; // Document ID, Folder ID, etc.
  status: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>; // Additional context
}

class AuditLogService {
  /**
   * Create an audit log entry
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId || null,
          action: data.action,
          resource: data.resource,
          status: data.status,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          details: data.details ? JSON.stringify(data.details) : null,
        },
      });

      console.log(`📝 Audit Log: ${data.action} - ${data.status} (User: ${data.userId || 'anonymous'})`);
    } catch (error) {
      // Don't throw - logging should never break the app
      console.error('❌ Failed to create audit log:', error);
    }
  }

  /**
   * Helper to extract IP and User Agent from Express request
   */
  private getRequestMetadata(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.headers['x-real-ip'] as string
        || req.socket.remoteAddress
        || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  }

  /**
   * Log from Express request (convenience method)
   */
  async logFromRequest(
    req: Request,
    action: AuditAction,
    status: AuditStatus,
    resource?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const metadata = this.getRequestMetadata(req);
    const userId = (req as any).user?.id; // Assumes req.user is set by auth middleware

    await this.log({
      userId,
      action,
      status,
      resource,
      ...metadata,
      details,
    });
  }

  /**
   * Get audit logs for a user (for compliance reporting)
   */
  async getUserLogs(userId: string, limit: number = 100) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific document
   */
  async getDocumentLogs(documentId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: { resource: documentId },
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
   * Get failed login attempts (security monitoring)
   */
  async getFailedLogins(hoursAgo: number = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hoursAgo);

    return prisma.auditLog.findMany({
      where: {
        action: AuditAction.LOGIN_FAILED,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all actions by IP address (detect suspicious activity)
   */
  async getActionsByIP(ipAddress: string, limit: number = 100) {
    return prisma.auditLog.findMany({
      where: { ipAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Export audit logs for compliance (CSV format)
   */
  async exportLogsCSV(userId?: string, startDate?: Date, endDate?: Date): Promise<string> {
    const where: any = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    // Generate CSV
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'IP Address', 'User Agent', 'Details'];
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.user?.email || 'N/A',
      log.action,
      log.resource || 'N/A',
      log.status,
      log.ipAddress || 'N/A',
      log.userAgent || 'N/A',
      log.details || 'N/A',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    return csv;
  }

  /**
   * Get activity summary for dashboard
   */
  async getActivitySummary(userId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
    });

    // Group by action
    const summary: Record<string, number> = {};
    logs.forEach(log => {
      summary[log.action] = (summary[log.action] || 0) + 1;
    });

    return {
      totalActions: logs.length,
      actionBreakdown: summary,
      period: `${days} days`,
    };
  }
}

export default new AuditLogService();
