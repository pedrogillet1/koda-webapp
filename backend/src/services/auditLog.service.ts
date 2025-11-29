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
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
  DOCUMENT_VIEW = 'DOCUMENT_VIEW',
  DOCUMENT_DOWNLOAD = 'DOCUMENT_DOWNLOAD',
  DOCUMENT_DELETE = 'DOCUMENT_DELETE',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PENDING = 'PENDING',
}

class AuditLogService {
  async logAction(_userId: string, _action: string, _details: any) { return true; }
  async getAuditLogs(_userId?: string, _limit = 100) { return []; }
  async searchLogs(_criteria: any) { return []; }
  async log(_params: any) { return true; }
  async logFromRequest(_req: any, _action: AuditAction, _status: AuditStatus, _resource?: string, _details?: any) { return true; }
}
export default new AuditLogService();
