/** Audit Log Service - Minimal Stub (Non-MVP) */

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  SHARE = 'SHARE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PENDING = 'PENDING',
}

class AuditLogService {
  async logAction(userId: string, action: string, details: any) { return true; }
  async getAuditLogs(userId?: string, limit = 100) { return []; }
  async searchLogs(criteria: any) { return []; }
  async log(userId: string, action: AuditAction, resource: string, details?: any) { return true; }
  async logFromRequest(req: any, action: AuditAction, resource: string, status: AuditStatus, details?: any) { return true; }
}
export default new AuditLogService();
