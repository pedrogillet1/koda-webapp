/**
 * STUB FILE: Provides no-op implementations for deleted security services
 * These services were removed during the cleanup but are still referenced in code.
 * This file prevents TypeScript errors while maintaining runtime compatibility.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Security Monitoring Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export enum SecurityEventType {
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_IP_BEHAVIOR = 'SUSPICIOUS_IP_BEHAVIOR',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',
  MASS_DOWNLOAD_DETECTED = 'MASS_DOWNLOAD_DETECTED',
  DATA_EXFILTRATION_ATTEMPT = 'DATA_EXFILTRATION_ATTEMPT',
}

export enum ThreatLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const securityMonitoringService = {
  recordSecurityEvent: async (_event: any) => {},
  detectBruteForce: async (_userId: string, _ip: string) => ({ threatLevel: ThreatLevel.LOW, detected: false }),
  detectMassDownload: async (_userId: string, _ip: string) => ({ threatLevel: ThreatLevel.LOW, detected: false }),
  detectSuspiciousIP: async (_ip: string) => ({ threatLevel: ThreatLevel.LOW, detected: false }),
  detectUnauthorizedAccess: async (_userId: string) => ({ threatLevel: ThreatLevel.LOW, detected: false }),
  getRecentSecurityEvents: async (_limit: number) => [],
  getSecurityMetrics: async (_hours: number) => ({}),
};

export default securityMonitoringService;

// ═══════════════════════════════════════════════════════════════════════════
// Session Management Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const sessionManagementService = {
  getUserSessionSummary: async (_userId: string) => ({ activeSessions: 0, sessions: [] }),
  revokeSession: async (_sessionId: string, _userId: string) => true,
  invalidateAllUserSessions: async (_userId: string, _exceptSessionId?: string) => 0,
};

// ═══════════════════════════════════════════════════════════════════════════
// Brute Force Protection Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const bruteForceProtection = {
  unlock: (_identifier: string, _type: string) => true,
  getStatistics: () => ({ blockedIPs: 0, blockedUsers: 0 }),
};

// ═══════════════════════════════════════════════════════════════════════════
// Security Dashboard Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const securityDashboardService = {
  getSecurityOverview: async (_hours: number) => ({ status: 'ok', threats: 0 }),
  getSecurityTrends: async (_days: number) => ({ trends: [] }),
  getSecurityInsights: async () => [],
  getComplianceReport: async () => ({ compliant: true, issues: [] }),
  getRealtimeStatus: async () => ({ status: 'healthy' }),
};

// ═══════════════════════════════════════════════════════════════════════════
// Audit Log Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export enum AuditAction {
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
  DOCUMENT_VIEW = 'DOCUMENT_VIEW',
  DOCUMENT_DOWNLOAD = 'DOCUMENT_DOWNLOAD',
  DOCUMENT_DELETE = 'DOCUMENT_DELETE',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export const auditLogService = {
  logFromRequest: async (_req: any, _action: AuditAction, _status: AuditStatus, _resourceId?: string, _metadata?: any) => {},
  log: async (_params: any) => {},
};

// ═══════════════════════════════════════════════════════════════════════════
// RBAC Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const rbacService = {
  hasPermission: async (_userId: string, _permission: { resource: string; action: string }) => true,
  hasAllPermissions: async (_userId: string, _permissions: Array<{ resource: string; action: string }>) => true,
  hasAnyPermission: async (_userId: string, _permissions: Array<{ resource: string; action: string }>) => true,
  getUserRoles: async (_userId: string) => [] as any[],
  getUserPermissions: async (_userId: string) => new Set<string>(),
  getAllRoles: async () => [],
  getAllPermissions: async () => [],
  assignRole: async (_userId: string, _roleName: string, _assignedBy: string, _expiresAt?: Date) => true,
  revokeRole: async (_userId: string, _roleName: string, _revokedBy: string) => true,
  createRole: async (_name: string, _description: string, _permissions: string[], _createdBy: string) => ({}),
  deleteRole: async (_roleId: string, _deletedBy: string) => true,
  initializeSystemRoles: async () => {},
  clearAllCaches: () => {},
};

// ═══════════════════════════════════════════════════════════════════════════
// Two Factor Authentication Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const twoFactorService = {
  enable2FA: async (_userId: string) => ({ secret: '', qrCode: '', backupCodes: [] as string[] }),
  verify2FA: async (_userId: string, _token: string) => ({ success: true }),
  verify2FALogin: async (_userId: string, _token: string) => ({ success: true }),
  disable2FA: async (_userId: string, _password: string) => ({ success: true }),
  getBackupCodes: async (_userId: string) => ({ codes: [] as string[] }),
};

// ═══════════════════════════════════════════════════════════════════════════
// Notification Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const notificationService = {
  getUserNotifications: async (_userId: string, _limit?: number) => ({ notifications: [] as any[], unreadCount: 0 }),
  markNotificationAsRead: async (_notificationId: string, _userId: string) => {},
  markAllNotificationsAsRead: async (_userId: string) => {},
  deleteNotification: async (_notificationId: string, _userId: string) => {},
  triggerReminderNotification: async (_userId: string, _title: string) => {},
};

export const triggerReminderNotification = notificationService.triggerReminderNotification;

// ═══════════════════════════════════════════════════════════════════════════
// GDPR Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const gdprService = {
  exportUserData: async (_params: { userId: string; format?: string; includeDocuments?: boolean }): Promise<{
    success: boolean;
    exportId: string;
    downloadUrl: string;
    error?: string;
  }> => ({
    success: true,
    exportId: 'stub',
    downloadUrl: '',
  }),
  deleteUserData: async (_params: { userId: string; reason?: string; requestedBy: string }): Promise<{
    success: boolean;
    deletedData: any;
    error?: string;
  }> => ({
    success: true,
    deletedData: {},
  }),
  getComplianceReport: async (_userId: string) => ({ compliant: true }),
  recordConsent: async (_userId: string, _consentType: string, _version: string) => true,
};

// ═══════════════════════════════════════════════════════════════════════════
// Data Retention Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const dataRetentionService = {
  getRetentionStats: async () => ({ stats: {} }),
  getAllPolicies: () => [] as any[],
  cleanupDataType: async (_dataType: string) => ({ cleaned: 0 }),
  runAllCleanupTasks: async () => [] as any[],
};

// ═══════════════════════════════════════════════════════════════════════════
// Backup Encryption Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const backupEncryptionService = {
  createBackup: async (_options: any): Promise<{
    success: boolean;
    backupId: string;
    document_metadata: any;
    error?: string;
  }> => ({ success: true, backupId: 'stub', document_metadata: {} }),
  listBackups: async () => [] as any[],
  getBackupStats: async () => ({}),
};

// ═══════════════════════════════════════════════════════════════════════════
// Key Rotation Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const keyRotationService = {
  rotateMasterKey: async (_userId: string): Promise<{ success: boolean; error?: string }> => ({ success: true }),
  getRotationProgress: () => null as any,
  getKeyVersionInfo: async () => ({ version: 1 }),
  getRotationHistory: async () => [] as any[],
  testRotation: async () => true,
};

// ═══════════════════════════════════════════════════════════════════════════
// PII Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const piiService = {
  detectPII: (_text: string) => ({ hasPII: false, types: [] as string[] }),
  maskPII: (text: string, _options?: any) => text,
  getPIIStats: (_text: string) => ({ total: 0, byType: {} }),
};


// ═══════════════════════════════════════════════════════════════════════════
// Excel Cell Reader Service Stub
// ═══════════════════════════════════════════════════════════════════════════
export const excelCellReaderService = {
  readCell: async (_query: string) => ({
    success: false,
    error: 'Excel cell reader service has been disabled',
    value: null as string | number | null,
    message: 'Excel cell reader service has been disabled',
    cellAddress: null as string | null,
    sheetName: null as string | null,
    documentName: null as string | null
  }),
};

// Note: excelCellReaderService is exported as named export above
