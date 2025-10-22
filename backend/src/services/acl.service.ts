/**
 * Access Control List (ACL) Service
 * Enterprise-grade document security with fine-grained permissions
 * Prevents unauthorized access to sensitive documents
 * Supports workspace isolation, role-based access, and document-level permissions
 */

import prisma from '../config/database';

interface ACLPermission {
  userId: string;
  documentId: string;
  permission: 'read' | 'write' | 'admin';
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

interface ACLCheck {
  allowed: boolean;
  reason: string;
  permission?: 'read' | 'write' | 'admin';
}

interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
}

interface DocumentACL {
  documentId: string;
  ownerId: string;
  workspaceId?: string;
  visibility: 'private' | 'workspace' | 'public';
  allowedUsers: string[];
  allowedRoles: string[];
  deniedUsers: string[]; // Explicit deny (overrides all)
}

class ACLService {
  /**
   * Check if user can access document
   * Enforces: workspace isolation + document-level permissions + explicit denies
   */
  async canAccessDocument(
    userId: string,
    documentId: string,
    requiredPermission: 'read' | 'write' | 'admin' = 'read'
  ): Promise<ACLCheck> {
    console.log(`🔒 ACL Check: User ${userId} → Document ${documentId} (${requiredPermission})`);

    try {
      // Step 1: Get document ACL
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          user: true,
          workspace: true
        }
      });

      if (!document) {
        return {
          allowed: false,
          reason: 'Document not found'
        };
      }

      // Step 2: Check explicit deny (highest priority)
      const acl = await this.getDocumentACL(documentId);
      if (acl.deniedUsers.includes(userId)) {
        console.log('   ❌ Denied: User explicitly denied');
        return {
          allowed: false,
          reason: 'Access explicitly denied for this user'
        };
      }

      // Step 3: Check ownership
      if (document.userId === userId) {
        console.log('   ✅ Allowed: User is document owner');
        return {
          allowed: true,
          reason: 'User is document owner',
          permission: 'admin'
        };
      }

      // Step 4: Check workspace access
      if (document.workspaceId) {
        const workspaceAccess = await this.checkWorkspaceAccess(
          userId,
          document.workspaceId
        );

        if (workspaceAccess.allowed) {
          // Check if workspace role satisfies required permission
          const hasPermission = this.checkRolePermission(
            workspaceAccess.permission!,
            requiredPermission
          );

          if (hasPermission) {
            console.log(`   ✅ Allowed: Workspace ${workspaceAccess.permission} access`);
            return {
              allowed: true,
              reason: `User has ${workspaceAccess.permission} access via workspace`,
              permission: workspaceAccess.permission
            };
          }
        }
      }

      // Step 5: Check document-level permissions
      const docPermission = await this.getDocumentPermission(userId, documentId);

      if (docPermission) {
        const hasPermission = this.checkRolePermission(
          docPermission,
          requiredPermission
        );

        if (hasPermission) {
          console.log(`   ✅ Allowed: Document ${docPermission} permission`);
          return {
            allowed: true,
            reason: `User has ${docPermission} permission on document`,
            permission: docPermission
          };
        }
      }

      // Step 6: Check visibility
      if (acl.visibility === 'public' && requiredPermission === 'read') {
        console.log('   ✅ Allowed: Document is public');
        return {
          allowed: true,
          reason: 'Document is publicly accessible',
          permission: 'read'
        };
      }

      // Default: Deny access
      console.log('   ❌ Denied: No matching permissions');
      return {
        allowed: false,
        reason: 'User does not have required permissions'
      };
    } catch (error) {
      console.error('❌ Error in ACL check:', error);
      return {
        allowed: false,
        reason: 'ACL check failed'
      };
    }
  }

  /**
   * Filter documents user can access
   * Critical for retrieval - only return documents user is authorized to see
   */
  async filterAccessibleDocuments(
    userId: string,
    documentIds: string[],
    requiredPermission: 'read' | 'write' | 'admin' = 'read'
  ): Promise<string[]> {
    console.log(`🔒 Filtering ${documentIds.length} documents for user ${userId}...`);

    const accessChecks = await Promise.all(
      documentIds.map(async docId => {
        const check = await this.canAccessDocument(userId, docId, requiredPermission);
        return { docId, allowed: check.allowed };
      })
    );

    const accessible = accessChecks
      .filter(check => check.allowed)
      .map(check => check.docId);

    const filtered = documentIds.length - accessible.length;

    console.log(`   Accessible: ${accessible.length}/${documentIds.length}`);
    if (filtered > 0) {
      console.log(`   ⚠️ Filtered out ${filtered} unauthorized documents`);
    }

    return accessible;
  }

  /**
   * Get documents user can access in workspace
   */
  async getAccessibleDocumentsInWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<string[]> {
    try {
      // Check if user has workspace access
      const workspaceAccess = await this.checkWorkspaceAccess(userId, workspaceId);

      if (!workspaceAccess.allowed) {
        return [];
      }

      // Get all documents in workspace
      const documents = await prisma.document.findMany({
        where: { workspaceId },
        select: { id: true }
      });

      const documentIds = documents.map(doc => doc.id);

      // Filter by document-level permissions
      return await this.filterAccessibleDocuments(userId, documentIds, 'read');
    } catch (error) {
      console.error('❌ Error getting accessible documents:', error);
      return [];
    }
  }

  /**
   * Check workspace access
   */
  private async checkWorkspaceAccess(
    userId: string,
    workspaceId: string
  ): Promise<ACLCheck> {
    try {
      // Check if workspace exists and user is a member
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId
          }
        }
      });

      if (!membership) {
        return {
          allowed: false,
          reason: 'User is not a workspace member'
        };
      }

      // Map role to permission level
      const permissionLevel = this.roleToPermission(membership.role);

      return {
        allowed: true,
        reason: `User is workspace ${membership.role}`,
        permission: permissionLevel
      };
    } catch (error) {
      console.error('❌ Error checking workspace access:', error);
      return {
        allowed: false,
        reason: 'Workspace access check failed'
      };
    }
  }

  /**
   * Get document-level permission for user
   */
  private async getDocumentPermission(
    userId: string,
    documentId: string
  ): Promise<'read' | 'write' | 'admin' | null> {
    try {
      // Check document_permissions table
      const permission = await prisma.documentPermission.findUnique({
        where: {
          documentId_userId: {
            documentId,
            userId
          }
        }
      });

      if (!permission) {
        return null;
      }

      // Check if permission has expired
      if (permission.expiresAt && permission.expiresAt < new Date()) {
        console.log('   ⚠️ Permission expired');
        return null;
      }

      return permission.permission as 'read' | 'write' | 'admin';
    } catch (error) {
      console.error('❌ Error getting document permission:', error);
      return null;
    }
  }

  /**
   * Get document ACL configuration
   */
  private async getDocumentACL(documentId: string): Promise<DocumentACL> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          permissions: {
            select: { userId: true }
          }
        }
      });

      if (!document) {
        return {
          documentId,
          ownerId: '',
          visibility: 'private',
          allowedUsers: [],
          allowedRoles: [],
          deniedUsers: []
        };
      }

      // Get ACL from metadata (if stored there)
      const metadata = document.metadata as any;
      const acl = metadata?.acl || {};

      return {
        documentId,
        ownerId: document.userId,
        workspaceId: document.workspaceId || undefined,
        visibility: acl.visibility || 'workspace',
        allowedUsers: document.permissions?.map(p => p.userId) || [],
        allowedRoles: acl.allowedRoles || [],
        deniedUsers: acl.deniedUsers || []
      };
    } catch (error) {
      console.error('❌ Error getting document ACL:', error);
      return {
        documentId,
        ownerId: '',
        visibility: 'private',
        allowedUsers: [],
        allowedRoles: [],
        deniedUsers: []
      };
    }
  }

  /**
   * Grant document permission to user
   */
  async grantDocumentPermission(
    documentId: string,
    userId: string,
    permission: 'read' | 'write' | 'admin',
    grantedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      // Verify grantor has admin permission
      const grantorCheck = await this.canAccessDocument(grantedBy, documentId, 'admin');

      if (!grantorCheck.allowed) {
        throw new Error('Grantor does not have admin permission on document');
      }

      // Create or update permission
      await prisma.documentPermission.upsert({
        where: {
          documentId_userId: {
            documentId,
            userId
          }
        },
        create: {
          documentId,
          userId,
          permission,
          grantedBy,
          expiresAt
        },
        update: {
          permission,
          grantedBy,
          expiresAt
        }
      });

      console.log(`✅ Granted ${permission} permission to user ${userId} on document ${documentId}`);
    } catch (error) {
      console.error('❌ Error granting permission:', error);
      throw error;
    }
  }

  /**
   * Revoke document permission from user
   */
  async revokeDocumentPermission(
    documentId: string,
    userId: string,
    revokedBy: string
  ): Promise<void> {
    try {
      // Verify revoker has admin permission
      const revokerCheck = await this.canAccessDocument(revokedBy, documentId, 'admin');

      if (!revokerCheck.allowed) {
        throw new Error('Revoker does not have admin permission on document');
      }

      await prisma.documentPermission.delete({
        where: {
          documentId_userId: {
            documentId,
            userId
          }
        }
      });

      console.log(`✅ Revoked permission from user ${userId} on document ${documentId}`);
    } catch (error) {
      console.error('❌ Error revoking permission:', error);
      throw error;
    }
  }

  /**
   * Check if role has required permission
   * Permission hierarchy: admin > write > read
   */
  private checkRolePermission(
    userPermission: 'read' | 'write' | 'admin',
    requiredPermission: 'read' | 'write' | 'admin'
  ): boolean {
    const permissionLevels = {
      read: 1,
      write: 2,
      admin: 3
    };

    return permissionLevels[userPermission] >= permissionLevels[requiredPermission];
  }

  /**
   * Map workspace role to permission level
   */
  private roleToPermission(role: string): 'read' | 'write' | 'admin' {
    switch (role) {
      case 'owner':
      case 'admin':
        return 'admin';
      case 'member':
        return 'write';
      case 'viewer':
        return 'read';
      default:
        return 'read';
    }
  }

  /**
   * Bulk grant permissions (for workspace invites)
   */
  async bulkGrantPermissions(
    documentIds: string[],
    userId: string,
    permission: 'read' | 'write' | 'admin',
    grantedBy: string
  ): Promise<{ granted: number; failed: number }> {
    console.log(`🔓 Bulk granting ${permission} to user ${userId} on ${documentIds.length} documents...`);

    let granted = 0;
    let failed = 0;

    for (const documentId of documentIds) {
      try {
        await this.grantDocumentPermission(documentId, userId, permission, grantedBy);
        granted++;
      } catch (error) {
        console.error(`   ❌ Failed to grant permission on ${documentId}:`, error);
        failed++;
      }
    }

    console.log(`   ✅ Granted: ${granted}, ❌ Failed: ${failed}`);

    return { granted, failed };
  }

  /**
   * Audit log for access attempts
   */
  async logAccessAttempt(
    userId: string,
    documentId: string,
    action: 'read' | 'write' | 'delete',
    allowed: boolean,
    reason: string
  ): Promise<void> {
    try {
      // In production, log to database or audit service
      console.log(`📋 Access Log: User ${userId} → Document ${documentId} (${action}) - ${allowed ? '✅' : '❌'} ${reason}`);

      /*
      await prisma.auditLog.create({
        data: {
          userId,
          resourceType: 'document',
          resourceId: documentId,
          action,
          allowed,
          reason,
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
      */
    } catch (error) {
      console.error('❌ Error logging access attempt:', error);
    }
  }

  /**
   * Generate ACL report for document
   */
  async generateACLReport(documentId: string): Promise<string> {
    const acl = await this.getDocumentACL(documentId);

    const permissions = await prisma.documentPermission.findMany({
      where: { documentId },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    let report = `
═══════════════════════════════════════════════════════
ACL REPORT: Document ${documentId}
═══════════════════════════════════════════════════════
Owner: ${acl.ownerId}
Workspace: ${acl.workspaceId || 'None'}
Visibility: ${acl.visibility}

Permissions (${permissions.length}):
`;

    for (const perm of permissions) {
      const expiry = perm.expiresAt ? ` (expires ${perm.expiresAt.toISOString()})` : '';
      report += `  - ${perm.user.email}: ${perm.permission}${expiry}\n`;
    }

    report += `\nDenied Users (${acl.deniedUsers.length}): ${acl.deniedUsers.join(', ')}\n`;
    report += `═══════════════════════════════════════════════════════`;

    return report.trim();
  }
}

export default new ACLService();
export { ACLService, ACLCheck, ACLPermission, DocumentACL };
