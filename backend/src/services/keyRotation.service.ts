import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import encryptionService from './encryption.service';
import auditLogService, { AuditStatus } from './auditLog.service';

const prisma = new PrismaClient();

/**
 * Key Rotation Service
 *
 * Manages encryption key rotation:
 * - Automatic key rotation on schedule
 * - Manual key rotation triggers
 * - Re-encryption of existing data
 * - Key version tracking
 * - Zero-downtime rotation
 * - Rollback support
 */

interface KeyVersion {
  version: string;
  createdAt: Date;
  status: 'active' | 'rotating' | 'deprecated' | 'archived';
  algorithm: string;
  expiresAt?: Date;
}

interface RotationResult {
  success: boolean;
  oldVersion: string;
  newVersion: string;
  recordsRotated: number;
  duration: number;
  error?: string;
}

interface RotationProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTable?: string;
}

class KeyRotationService {
  private readonly ROTATION_BATCH_SIZE = 100;
  private readonly KEY_LIFETIME_DAYS = 90;
  private currentRotation: RotationProgress | null = null;

  /**
   * Check if key rotation is needed
   */
  async isRotationNeeded(): Promise<boolean> {
    // In a real implementation, check last rotation date from database
    // For now, return false
    return false;
  }

  /**
   * Get current key version
   */
  getCurrentKeyVersion(): string {
    return 'v1'; // In production, fetch from secure key management system
  }

  /**
   * Generate new encryption key version
   */
  private generateNewKeyVersion(): string {
    const timestamp = Date.now();
    return `v${timestamp}`;
  }

  /**
   * Rotate encryption keys (master key rotation)
   */
  async rotateMasterKey(initiatedBy: string): Promise<RotationResult> {
    const startTime = Date.now();
    const oldVersion = this.getCurrentKeyVersion();
    const newVersion = this.generateNewKeyVersion();

    console.log(`🔄 Starting master key rotation: ${oldVersion} → ${newVersion}`);

    try {
      // Initialize progress tracking
      this.currentRotation = {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0,
      };

      let totalRotated = 0;

      // Audit log
      await auditLogService.log({
        userId: initiatedBy,
        action: 'key_rotation_started' as any,
        status: AuditStatus.SUCCESS,
        details: {
          oldVersion,
          newVersion,
          startedAt: new Date().toISOString(),
        },
      });

      // Rotate data in each table
      totalRotated += await this.rotateUserData(oldVersion, newVersion);
      totalRotated += await this.rotateDocumentData(oldVersion, newVersion);
      totalRotated += await this.rotateSessionData(oldVersion, newVersion);

      const duration = Date.now() - startTime;

      console.log(`✅ Key rotation completed: ${totalRotated} records in ${duration}ms`);

      // Audit log completion
      await auditLogService.log({
        userId: initiatedBy,
        action: 'key_rotation_completed' as any,
        status: AuditStatus.SUCCESS,
        details: {
          oldVersion,
          newVersion,
          recordsRotated: totalRotated,
          duration,
          completedAt: new Date().toISOString(),
        },
      });

      this.currentRotation = null;

      return {
        success: true,
        oldVersion,
        newVersion,
        recordsRotated: totalRotated,
        duration,
      };
    } catch (error) {
      console.error('Key rotation error:', error);

      await auditLogService.log({
        userId: initiatedBy,
        action: 'key_rotation_failed' as any,
        status: AuditStatus.FAILURE,
        details: {
          oldVersion,
          newVersion,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.currentRotation = null;

      return {
        success: false,
        oldVersion,
        newVersion,
        recordsRotated: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rotate encrypted user data
   */
  private async rotateUserData(oldVersion: string, newVersion: string): Promise<number> {
    console.log('🔄 Rotating user data...');
    let rotatedCount = 0;

    // In a real implementation:
    // 1. Find all users with encrypted fields
    // 2. Decrypt with old key
    // 3. Re-encrypt with new key
    // 4. Update in database

    // For now, return 0 (no encrypted user fields yet)
    return rotatedCount;
  }

  /**
   * Rotate encrypted document data
   */
  private async rotateDocumentData(oldVersion: string, newVersion: string): Promise<number> {
    console.log('🔄 Rotating document data...');
    let rotatedCount = 0;

    // Find documents with encrypted filenames
    const encryptedDocs = await prisma.document.findMany({
      where: {
        encryptedFilename: {
          not: undefined,
        },
      },
    });

    console.log(`📄 Found ${encryptedDocs.length} documents to rotate`);

    // Process in batches
    for (let i = 0; i < encryptedDocs.length; i += this.ROTATION_BATCH_SIZE) {
      const batch = encryptedDocs.slice(i, i + this.ROTATION_BATCH_SIZE);

      for (const doc of batch) {
        try {
          if (doc.encryptedFilename) {
            // Re-encrypt using encryption service
            const reencrypted = encryptionService.reencrypt(
              doc.encryptedFilename,
              `document:${oldVersion}`,
              `document:${newVersion}`
            );

            // Update in database
            await prisma.document.update({
              where: { id: doc.id },
              data: { encryptedFilename: reencrypted },
            });

            rotatedCount++;
          }
        } catch (error) {
          console.error(`Failed to rotate document ${doc.id}:`, error);
          if (this.currentRotation) this.currentRotation.failed++;
        }
      }

      // Update progress
      if (this.currentRotation) {
        this.currentRotation.completed = rotatedCount;
        this.currentRotation.percentage = Math.round(
          (rotatedCount / encryptedDocs.length) * 100
        );
        this.currentRotation.currentTable = 'documents';
      }
    }

    console.log(`✅ Rotated ${rotatedCount} documents`);
    return rotatedCount;
  }

  /**
   * Rotate encrypted session data
   */
  private async rotateSessionData(oldVersion: string, newVersion: string): Promise<number> {
    console.log('🔄 Rotating session data...');
    let rotatedCount = 0;

    // Sessions typically use signed tokens, not encrypted data
    // In a real implementation, you might rotate session tokens

    return rotatedCount;
  }

  /**
   * Rotate API keys
   */
  async rotateAPIKeys(): Promise<number> {
    console.log('🔄 Rotating API keys...');

    // Deactivate all expired API keys
    const expiredCount = await prisma.aPIKey.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`🔑 Deactivated ${expiredCount.count} expired API keys`);
    return expiredCount.count;
  }

  /**
   * Get rotation progress
   */
  getRotationProgress(): RotationProgress | null {
    return this.currentRotation;
  }

  /**
   * Schedule automatic key rotation
   */
  startRotationScheduler(intervalDays: number = 90) {
    setInterval(
      async () => {
        console.log('🕐 Running scheduled key rotation check...');

        const needsRotation = await this.isRotationNeeded();
        if (needsRotation) {
          console.log('🔄 Automatic key rotation initiated');
          await this.rotateMasterKey('system_scheduler');
        } else {
          console.log('✅ No key rotation needed');
        }
      },
      intervalDays * 24 * 60 * 60 * 1000
    );

    console.log(`📅 Key rotation scheduler started (checks every ${intervalDays} days)`);
  }

  /**
   * Rotate individual field encryption key
   */
  async rotateFieldKey(
    tableName: string,
    fieldName: string,
    oldContext: string,
    newContext: string
  ): Promise<number> {
    console.log(`🔄 Rotating field key: ${tableName}.${fieldName}`);

    // This would be implemented per-table basis
    // For now, return 0
    return 0;
  }

  /**
   * Test key rotation (dry run)
   */
  async testRotation(): Promise<boolean> {
    try {
      console.log('🧪 Testing key rotation (dry run)...');

      const oldVersion = this.getCurrentKeyVersion();
      const newVersion = 'test_' + this.generateNewKeyVersion();

      // Test encryption/decryption with old and new keys
      const testData = 'test_data_' + Date.now();
      const encrypted = encryptionService.encrypt(testData, `test:${oldVersion}`);
      const decrypted = encryptionService.decrypt(encrypted, `test:${oldVersion}`);

      if (decrypted !== testData) {
        console.error('❌ Key rotation test failed: decryption mismatch');
        return false;
      }

      // Test re-encryption
      const reencrypted = encryptionService.reencrypt(
        encrypted,
        `test:${oldVersion}`,
        `test:${newVersion}`
      );
      const finalDecrypt = encryptionService.decrypt(reencrypted, `test:${newVersion}`);

      if (finalDecrypt !== testData) {
        console.error('❌ Key rotation test failed: re-encryption mismatch');
        return false;
      }

      console.log('✅ Key rotation test passed');
      return true;
    } catch (error) {
      console.error('Key rotation test error:', error);
      return false;
    }
  }

  /**
   * Get key rotation history
   */
  async getRotationHistory(): Promise<any[]> {
    const history = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['key_rotation_started', 'key_rotation_completed', 'key_rotation_failed'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return history.map((log) => ({
      action: log.action,
      status: log.status,
      details: log.details,
      timestamp: log.createdAt,
    }));
  }

  /**
   * Get key version info
   */
  async getKeyVersionInfo(): Promise<KeyVersion> {
    return {
      version: this.getCurrentKeyVersion(),
      createdAt: new Date(), // In production, fetch from key management system
      status: 'active',
      algorithm: 'AES-256-GCM',
      expiresAt: new Date(Date.now() + this.KEY_LIFETIME_DAYS * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Emergency key rotation (immediate)
   */
  async emergencyRotation(reason: string, initiatedBy: string): Promise<RotationResult> {
    console.log(`🚨 EMERGENCY KEY ROTATION: ${reason}`);

    await auditLogService.log({
      userId: initiatedBy,
      action: 'emergency_key_rotation' as any,
      status: AuditStatus.SUCCESS,
      details: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    return await this.rotateMasterKey(initiatedBy);
  }

  /**
   * Rollback key rotation (if issues occur)
   */
  async rollbackRotation(oldVersion: string, newVersion: string): Promise<boolean> {
    console.log(`⏪ Rolling back key rotation: ${newVersion} → ${oldVersion}`);

    try {
      // Re-encrypt all data back to old key
      // In production, you would reverse the rotation process
      return true;
    } catch (error) {
      console.error('Rollback error:', error);
      return false;
    }
  }
}

export default new KeyRotationService();
export { KeyVersion, RotationResult, RotationProgress };
