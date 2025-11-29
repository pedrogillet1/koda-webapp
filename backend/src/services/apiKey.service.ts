import prisma from '../config/database';
import crypto from 'crypto';
import auditLogService, { AuditAction, AuditStatus } from './auditLog.service';

/**
 * API Key Management Service
 *
 * Features:
 * - Secure API key generation and hashing
 * - Scope-based access control
 * - Rate limiting per key
 * - IP whitelisting
 * - Key expiration
 * - Usage tracking
 */

interface APIKeyScope {
  resource: string;
  actions: string[];
}

interface CreateAPIKeyOptions {
  userId: string;
  name: string;
  scopes: APIKeyScope[];
  expiresAt?: Date;
  rateLimit?: number; // Requests per hour
  ipWhitelist?: string[];
}

interface ValidateAPIKeyResult {
  valid: boolean;
  userId?: string;
  scopes?: APIKeyScope[];
  rateLimitExceeded?: boolean;
  ipBlocked?: boolean;
  expired?: boolean;
  reason?: string;
}

class APIKeyService {
  /**
   * Generate a secure API key
   */
  private generateAPIKey(): string {
    // Format: koda_live_32randomcharacters
    const randomBytes = crypto.randomBytes(24);
    const key = `koda_live_${randomBytes.toString('base64url')}`;
    return key;
  }

  /**
   * Hash API key for storage
   */
  private hashAPIKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Create a new API key
   */
  async createAPIKey(options: CreateAPIKeyOptions): Promise<{ apiKey: string; keyData: any }> {
    try {
      // Generate API key
      const apiKey = this.generateAPIKey();
      const keyHash = this.hashAPIKey(apiKey);
      const keyPreview = apiKey.slice(-4);

      // Create in database
      const keyData = await prisma.api_keys.create({
        data: {
          userId: options.userId,
          name: options.name,
          keyHash,
          keyPreview,
          scopes: JSON.stringify(options.scopes),
          expiresAt: options.expiresAt,
          rateLimit: options.rateLimit || 1000,
          ipWhitelist: options.ipWhitelist ? JSON.stringify(options.ipWhitelist) : null,
          isActive: true,
        },
      });

      // Audit log
      await auditLogService.log({
        userId: options.userId,
        action: 'api_key_created' as any,
        status: AuditStatus.SUCCESS,
        resource: keyData.id,
        details: {
          keyName: options.name,
          scopes: options.scopes,
          expiresAt: options.expiresAt?.toISOString(),
        },
      });

      console.log(`✅ Created API key ${options.name} for user ${options.userId}`);

      // Return the plaintext key ONCE (never stored)
      return {
        apiKey,
        keyData: {
          id: keyData.id,
          name: keyData.name,
          keyPreview: keyData.keyPreview,
          scopes: options.scopes,
          expiresAt: keyData.expiresAt,
          rateLimit: keyData.rateLimit,
          createdAt: keyData.createdAt,
        },
      };
    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    }
  }

  /**
   * Validate an API key
   */
  async validateAPIKey(apiKey: string, ipAddress?: string): Promise<ValidateAPIKeyResult> {
    try {
      // Hash the provided key
      const keyHash = this.hashAPIKey(apiKey);

      // Find key in database
      const keyData = await prisma.api_keys.findUnique({
        where: { keyHash },
      });

      if (!keyData) {
        return { valid: false, reason: 'Invalid API key' };
      }

      // Check if key is active
      if (!keyData.isActive) {
        return { valid: false, reason: 'API key is inactive' };
      }

      // Check expiration
      if (keyData.expiresAt && keyData.expiresAt < new Date()) {
        return { valid: false, expired: true, reason: 'API key has expired' };
      }

      // Check IP whitelist
      if (keyData.ipWhitelist && ipAddress) {
        const whitelist: string[] = JSON.parse(keyData.ipWhitelist);
        if (!whitelist.includes(ipAddress)) {
          await auditLogService.log({
            userId: keyData.userId,
            action: 'api_key_ip_blocked' as any,
            status: AuditStatus.FAILURE,
            ipAddress,
            details: {
              keyId: keyData.id,
              keyName: keyData.name,
            },
          });
          return { valid: false, ipBlocked: true, reason: 'IP address not whitelisted' };
        }
      }

      // Check rate limit
      const rateLimitExceeded = await this.checkRateLimit(keyData);
      if (rateLimitExceeded) {
        return {
          valid: false,
          rateLimitExceeded: true,
          reason: `Rate limit exceeded (${keyData.rateLimit} requests/hour)`,
        };
      }

      // Update last used timestamp and usage count
      await this.recordUsage(keyData.id);

      // Parse scopes
      const scopes: APIKeyScope[] = JSON.parse(keyData.scopes);

      return {
        valid: true,
        userId: keyData.userId,
        scopes,
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { valid: false, reason: 'Internal error' };
    }
  }

  /**
   * Check if API key has exceeded rate limit
   */
  private async checkRateLimit(keyData: any): Promise<boolean> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Reset window if expired
    if (keyData.windowStart < hourAgo) {
      await prisma.api_keys.update({
        where: { id: keyData.id },
        data: {
          usageCount: 0,
          windowStart: now,
        },
      });
      return false;
    }

    // Check if limit exceeded
    return keyData.usageCount >= keyData.rateLimit;
  }

  /**
   * Record API key usage
   */
  private async recordUsage(keyId: string): Promise<void> {
    await prisma.api_keys.update({
      where: { id: keyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
    try {
      const keyData = await prisma.api_keys.findUnique({ where: { id: keyId } });

      if (!keyData || keyData.userId !== userId) {
        return false;
      }

      await prisma.api_keys.update({
        where: { id: keyId },
        data: { isActive: false },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: 'api_key_revoked' as any,
        status: AuditStatus.SUCCESS,
        resource: keyId,
        details: {
          keyName: keyData.name,
        },
      });

      console.log(`✅ Revoked API key ${keyData.name}`);
      return true;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return false;
    }
  }

  /**
   * Delete an API key
   */
  async deleteAPIKey(keyId: string, userId: string): Promise<boolean> {
    try {
      const keyData = await prisma.api_keys.findUnique({ where: { id: keyId } });

      if (!keyData || keyData.userId !== userId) {
        return false;
      }

      await prisma.api_keys.delete({ where: { id: keyId } });

      // Audit log
      await auditLogService.log({
        userId,
        action: 'api_key_deleted' as any,
        status: AuditStatus.SUCCESS,
        resource: keyId,
        details: {
          keyName: keyData.name,
        },
      });

      console.log(`✅ Deleted API key ${keyData.name}`);
      return true;
    } catch (error) {
      console.error('Error deleting API key:', error);
      return false;
    }
  }

  /**
   * Get all API keys for a user
   */
  async getUserAPIKeys(userId: string): Promise<any[]> {
    const keys = await prisma.api_keys.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPreview: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        rateLimit: true,
        usageCount: true,
        windowStart: true,
        createdAt: true,
      },
    });

    return keys.map(key => ({
      ...key,
      scopes: JSON.parse(key.scopes),
    }));
  }

  /**
   * Check if API key has permission for a resource/action
   */
  hasScope(scopes: APIKeyScope[], resource: string, action: string): boolean {
    for (const scope of scopes) {
      // Check wildcard resource
      if (scope.resource === '*') {
        if (scope.actions.includes('*') || scope.actions.includes(action)) {
          return true;
        }
      }

      // Check exact resource
      if (scope.resource === resource) {
        if (scope.actions.includes('*') || scope.actions.includes(action)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Update API key settings
   */
  async updateAPIKey(
    keyId: string,
    userId: string,
    updates: {
      name?: string;
      rateLimit?: number;
      ipWhitelist?: string[];
      expiresAt?: Date;
    }
  ): Promise<boolean> {
    try {
      const keyData = await prisma.api_keys.findUnique({ where: { id: keyId } });

      if (!keyData || keyData.userId !== userId) {
        return false;
      }

      await prisma.api_keys.update({
        where: { id: keyId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.rateLimit && { rateLimit: updates.rateLimit }),
          ...(updates.ipWhitelist && { ipWhitelist: JSON.stringify(updates.ipWhitelist) }),
          ...(updates.expiresAt !== undefined && { expiresAt: updates.expiresAt }),
        },
      });

      // Audit log
      await auditLogService.log({
        userId,
        action: 'api_key_updated' as any,
        status: AuditStatus.SUCCESS,
        resource: keyId,
        details: {
          keyName: keyData.name,
          updates,
        },
      });

      return true;
    } catch (error) {
      console.error('Error updating API key:', error);
      return false;
    }
  }

  /**
   * Get API key usage statistics
   */
  async getAPIKeyStats(keyId: string, userId: string): Promise<any> {
    const keyData = await prisma.api_keys.findUnique({
      where: { id: keyId },
    });

    if (!keyData || keyData.userId !== userId) {
      return null;
    }

    const now = new Date();
    const windowRemaining = keyData.windowStart
      ? Math.max(0, 60 - Math.floor((now.getTime() - keyData.windowStart.getTime()) / (60 * 1000)))
      : 0;

    return {
      id: keyData.id,
      name: keyData.name,
      isActive: keyData.isActive,
      usage: {
        current: keyData.usageCount,
        limit: keyData.rateLimit,
        remaining: Math.max(0, keyData.rateLimit - keyData.usageCount),
        windowRemainingMinutes: windowRemaining,
      },
      lastUsed: keyData.lastUsedAt,
      expiresAt: keyData.expiresAt,
      scopes: JSON.parse(keyData.scopes),
    };
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await prisma.api_keys.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`🧹 Deactivated ${result.count} expired API keys`);
    return result.count;
  }
}

export default new APIKeyService();
export { APIKeyScope, CreateAPIKeyOptions, ValidateAPIKeyResult };
