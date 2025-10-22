import prisma from '../config/database';
import { Request } from 'express';

interface AuditLogData {
  userId?: string;
  action: string;
  resource?: string;
  status: 'success' | 'failure';
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        resource: data.resource || null,
        status: data.status,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};

export const logAuthAttempt = async (
  req: Request,
  userId: string | null,
  action: 'login' | 'logout' | 'register' | '2fa_verify',
  status: 'success' | 'failure',
  details?: any
): Promise<void> => {
  await createAuditLog({
    userId: userId || undefined,
    action,
    status,
    details,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });
};

export const logDocumentOperation = async (
  req: Request,
  userId: string,
  action: 'document_upload' | 'document_download' | 'document_delete' | 'document_view',
  documentId: string,
  status: 'success' | 'failure',
  details?: any
): Promise<void> => {
  await createAuditLog({
    userId,
    action,
    resource: documentId,
    status,
    details,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });
};
