import { PrismaClient } from '@prisma/client';
import auditLogService, { AuditAction, AuditStatus } from './auditLog.service';

const prisma = new PrismaClient();

/**
 * RBAC Service - Role-Based Access Control
 *
 * Features:
 * - Fine-grained permissions (resource + action)
 * - Role hierarchy with inheritance
 * - Multi-role support per user
 * - Permission caching for performance
 * - Audit trail for all RBAC changes
 */

// Permission cache (5 minute TTL)
const permissionCache = new Map<string, { permissions: Set<string>; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface RoleDefinition {
  name: string;
  description: string;
  priority: number;
  permissions: Array<{ resource: string; action: string }>;
  isSystem?: boolean;
}

interface PermissionCheck {
  resource: string;
  action: string;
}

class RBACService {
  /**
   * Initialize system roles and permissions
   */
  async initializeSystemRoles(): Promise<void> {
    console.log('🔐 Initializing RBAC system roles...');

    const systemRoles: RoleDefinition[] = [
      {
        name: 'owner',
        description: 'Full system access - cannot be revoked',
        priority: 1000,
        isSystem: true,
        permissions: [
          // All permissions
          { resource: '*', action: '*' },
        ],
      },
      {
        name: 'admin',
        description: 'Administrator with full access except system management',
        priority: 900,
        isSystem: true,
        permissions: [
          // User management
          { resource: 'users', action: 'create' },
          { resource: 'users', action: 'read' },
          { resource: 'users', action: 'update' },
          { resource: 'users', action: 'delete' },
          // Document management
          { resource: 'documents', action: 'create' },
          { resource: 'documents', action: 'read' },
          { resource: 'documents', action: 'update' },
          { resource: 'documents', action: 'delete' },
          { resource: 'documents', action: 'share' },
          { resource: 'documents', action: 'download' },
          // Folder management
          { resource: 'folders', action: 'create' },
          { resource: 'folders', action: 'read' },
          { resource: 'folders', action: 'update' },
          { resource: 'folders', action: 'delete' },
          // Chat/Conversation management
          { resource: 'chat', action: 'create' },
          { resource: 'chat', action: 'read' },
          { resource: 'chat', action: 'update' },
          { resource: 'chat', action: 'delete' },
          // Tag management
          { resource: 'tags', action: 'create' },
          { resource: 'tags', action: 'read' },
          { resource: 'tags', action: 'update' },
          { resource: 'tags', action: 'delete' },
          // Notification management
          { resource: 'notifications', action: 'read' },
          { resource: 'notifications', action: 'update' },
          { resource: 'notifications', action: 'delete' },
          // Security
          { resource: 'security', action: 'read' },
          { resource: 'security', action: 'manage' },
          // Settings
          { resource: 'settings', action: 'read' },
          { resource: 'settings', action: 'update' },
        ],
      },
      {
        name: 'editor',
        description: 'Can create, edit, and share documents',
        priority: 500,
        isSystem: true,
        permissions: [
          { resource: 'documents', action: 'create' },
          { resource: 'documents', action: 'read' },
          { resource: 'documents', action: 'update' },
          { resource: 'documents', action: 'share' },
          { resource: 'documents', action: 'download' },
          { resource: 'folders', action: 'create' },
          { resource: 'folders', action: 'read' },
          { resource: 'folders', action: 'update' },
          { resource: 'chat', action: 'create' },
          { resource: 'chat', action: 'read' },
          { resource: 'tags', action: 'create' },
          { resource: 'tags', action: 'read' },
          { resource: 'notifications', action: 'read' },
          { resource: 'notifications', action: 'update' },
          { resource: 'settings', action: 'read' },
        ],
      },
      {
        name: 'viewer',
        description: 'Read-only access to documents',
        priority: 100,
        isSystem: true,
        permissions: [
          { resource: 'documents', action: 'read' },
          { resource: 'documents', action: 'download' },
          { resource: 'folders', action: 'read' },
          { resource: 'chat', action: 'read' },
          { resource: 'tags', action: 'read' },
          { resource: 'notifications', action: 'read' },
          { resource: 'settings', action: 'read' },
        ],
      },
      {
        name: 'guest',
        description: 'Minimal access - read shared documents only',
        priority: 10,
        isSystem: true,
        permissions: [
          { resource: 'documents', action: 'read' },
        ],
      },
    ];

    for (const roleDef of systemRoles) {
      await this.createOrUpdateRole(roleDef);
    }

    console.log('✅ System roles initialized');
  }

  /**
   * Create or update a role with permissions
   */
  private async createOrUpdateRole(roleDef: RoleDefinition): Promise<void> {
    // Create or update role
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        description: roleDef.description,
        priority: roleDef.priority,
      },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        priority: roleDef.priority,
        isSystem: roleDef.isSystem || false,
      },
    });

    // Create permissions and assign to role
    for (const perm of roleDef.permissions) {
      const permission = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: perm.resource,
            action: perm.action,
          },
        },
        update: {},
        create: {
          resource: perm.resource,
          action: perm.action,
          description: `${perm.action} permission for ${perm.resource}`,
        },
      });

      // Link permission to role
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    roleName: string,
    grantedBy?: string,
    expiresAt?: Date
  ): Promise<boolean> {
    try {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        console.error(`Role ${roleName} not found`);
        return false;
      }

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id,
          },
        },
        update: {
          expiresAt,
          grantedBy,
        },
        create: {
          userId,
          roleId: role.id,
          grantedBy,
          expiresAt,
        },
      });

      // Clear permission cache for this user
      this.clearUserCache(userId);

      // Audit log
      await auditLogService.log({
        userId: grantedBy,
        action: 'role_assigned' as any,
        status: AuditStatus.SUCCESS,
        resource: userId,
        details: {
          role: roleName,
          expiresAt: expiresAt?.toISOString(),
        },
      });

      console.log(`✅ Assigned role ${roleName} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(userId: string, roleName: string, revokedBy?: string): Promise<boolean> {
    try {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        return false;
      }

      await prisma.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id,
          },
        },
      });

      // Clear permission cache
      this.clearUserCache(userId);

      // Audit log
      await auditLogService.log({
        userId: revokedBy,
        action: 'role_revoked' as any,
        status: AuditStatus.SUCCESS,
        resource: userId,
        details: { role: roleName },
      });

      console.log(`✅ Revoked role ${roleName} from user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error revoking role:', error);
      return false;
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: PermissionCheck): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    // Check for wildcard permissions
    if (permissions.has('*:*')) return true;
    if (permissions.has(`${permission.resource}:*`)) return true;
    if (permissions.has(`*:${permission.action}`)) return true;

    // Check exact permission
    return permissions.has(`${permission.resource}:${permission.action}`);
  }

  /**
   * Check multiple permissions (AND logic)
   */
  async hasAllPermissions(userId: string, permissions: PermissionCheck[]): Promise<boolean> {
    for (const perm of permissions) {
      if (!(await this.hasPermission(userId, perm))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check multiple permissions (OR logic)
   */
  async hasAnyPermission(userId: string, permissions: PermissionCheck[]): Promise<boolean> {
    for (const perm of permissions) {
      if (await this.hasPermission(userId, perm)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all permissions for a user (with caching)
   */
  async getUserPermissions(userId: string): Promise<Set<string>> {
    // Check cache
    const cached = permissionCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return cached.permissions;
    }

    // Get user roles (excluding expired)
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePerm of userRole.role.permissions) {
        const perm = rolePerm.permission;
        permissions.add(`${perm.resource}:${perm.action}`);
      }

      // Get inherited permissions from parent roles
      const inheritedPerms = await this.getInheritedPermissions(userRole.role.id);
      inheritedPerms.forEach(p => permissions.add(p));
    }

    // Cache permissions
    permissionCache.set(userId, {
      permissions,
      expiry: Date.now() + CACHE_TTL,
    });

    return permissions;
  }

  /**
   * Get inherited permissions from parent roles
   */
  private async getInheritedPermissions(roleId: string): Promise<Set<string>> {
    const permissions = new Set<string>();

    const parentRoles = await prisma.roleHierarchy.findMany({
      where: { childRoleId: roleId },
      include: {
        parentRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    for (const parent of parentRoles) {
      for (const rolePerm of parent.parentRole.permissions) {
        const perm = rolePerm.permission;
        permissions.add(`${perm.resource}:${perm.action}`);
      }

      // Recursively get parent permissions
      const ancestorPerms = await this.getInheritedPermissions(parent.parentRole.id);
      ancestorPerms.forEach(p => permissions.add(p));
    }

    return permissions;
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string): Promise<any[]> {
    return prisma.userRole.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            priority: true,
            isSystem: true,
          },
        },
      },
      orderBy: {
        role: {
          priority: 'desc',
        },
      },
    });
  }

  /**
   * Create a custom role
   */
  async createRole(
    name: string,
    description: string,
    permissions: PermissionCheck[],
    createdBy: string
  ): Promise<any> {
    try {
      const role = await prisma.role.create({
        data: {
          name,
          description,
          priority: 50, // Custom roles have medium priority
          isSystem: false,
        },
      });

      // Assign permissions
      for (const perm of permissions) {
        const permission = await prisma.permission.upsert({
          where: {
            resource_action: {
              resource: perm.resource,
              action: perm.action,
            },
          },
          update: {},
          create: {
            resource: perm.resource,
            action: perm.action,
          },
        });

        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }

      // Audit log
      await auditLogService.log({
        userId: createdBy,
        action: 'role_created' as any,
        status: AuditStatus.SUCCESS,
        resource: role.id,
        details: {
          roleName: name,
          permissionCount: permissions.length,
        },
      });

      return role;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * Delete a custom role
   */
  async deleteRole(roleId: string, deletedBy: string): Promise<boolean> {
    try {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) return false;

      // Cannot delete system roles
      if (role.isSystem) {
        throw new Error('Cannot delete system roles');
      }

      await prisma.role.delete({ where: { id: roleId } });

      // Audit log
      await auditLogService.log({
        userId: deletedBy,
        action: 'role_deleted' as any,
        status: AuditStatus.SUCCESS,
        resource: roleId,
        details: { roleName: role.name },
      });

      return true;
    } catch (error) {
      console.error('Error deleting role:', error);
      return false;
    }
  }

  /**
   * Set up role hierarchy (parent inherits all child permissions)
   */
  async setRoleHierarchy(parentRoleName: string, childRoleName: string): Promise<boolean> {
    try {
      const parentRole = await prisma.role.findUnique({ where: { name: parentRoleName } });
      const childRole = await prisma.role.findUnique({ where: { name: childRoleName } });

      if (!parentRole || !childRole) {
        return false;
      }

      await prisma.roleHierarchy.upsert({
        where: {
          parentRoleId_childRoleId: {
            parentRoleId: parentRole.id,
            childRoleId: childRole.id,
          },
        },
        update: {},
        create: {
          parentRoleId: parentRole.id,
          childRoleId: childRole.id,
        },
      });

      // Clear all permission caches
      permissionCache.clear();

      console.log(`✅ Set hierarchy: ${parentRoleName} inherits from ${childRoleName}`);
      return true;
    } catch (error) {
      console.error('Error setting role hierarchy:', error);
      return false;
    }
  }

  /**
   * Clear permission cache for a user
   */
  private clearUserCache(userId: string): void {
    permissionCache.delete(userId);
  }

  /**
   * Clear all permission caches
   */
  clearAllCaches(): void {
    permissionCache.clear();
    console.log('✅ Cleared all permission caches');
  }

  /**
   * Get all available roles
   */
  async getAllRoles(): Promise<any[]> {
    return prisma.role.findMany({
      orderBy: { priority: 'desc' },
      include: {
        _count: {
          select: {
            permissions: true,
            userRoles: true,
          },
        },
      },
    });
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<any[]> {
    return prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }
}

export default new RBACService();
