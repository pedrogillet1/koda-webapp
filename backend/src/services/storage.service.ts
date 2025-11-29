import prisma from '../config/database';

/**
 * Storage Service - Manages user storage limits and tracking
 * Beta tier: 5GB storage limit per user
 */

// Storage tier limits in bytes
export const STORAGE_TIERS = {
  beta: 5 * 1024 * 1024 * 1024,      // 5 GB
  free: 1 * 1024 * 1024 * 1024,      // 1 GB
  personal: 10 * 1024 * 1024 * 1024, // 10 GB
  premium: 50 * 1024 * 1024 * 1024,  // 50 GB
  business: 100 * 1024 * 1024 * 1024 // 100 GB
} as const;

// Default limit for beta (all users during beta)
const DEFAULT_STORAGE_LIMIT = STORAGE_TIERS.beta; // 5GB

export interface StorageInfo {
  used: number;          // bytes used
  limit: number;         // bytes limit
  available: number;     // bytes available
  usedPercentage: number; // percentage used (0-100)
  usedFormatted: string; // human readable used
  limitFormatted: string; // human readable limit
  availableFormatted: string; // human readable available
}

/**
 * Format bytes to human readable string
 * Shows 2 decimals for GB+, 1 decimal for MB, 0 for smaller
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Show 2 decimal places for GB and above, 1 for MB, 0 for smaller
  const decimals = i >= 3 ? 2 : (i === 2 ? 1 : 0);
  return value.toFixed(decimals) + ' ' + sizes[i];
}

/**
 * Get storage limit for a user based on their subscription tier
 */
export async function getStorageLimit(userId: string): Promise<number> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // During beta, everyone gets 5GB regardless of tier
  // After beta, use tier-based limits
  const tierLimits: Record<string, number> = {
    free: STORAGE_TIERS.free,
    personal: STORAGE_TIERS.personal,
    premium: STORAGE_TIERS.premium,
    business: STORAGE_TIERS.business
  };

  // For now, use beta limit for all users
  return DEFAULT_STORAGE_LIMIT;

  // After beta, uncomment this:
  // return tierLimits[user.subscriptionTier] || STORAGE_TIERS.free;
}

/**
 * Get current storage usage for a user
 */
export async function getStorageUsage(userId: string): Promise<number> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { storageUsedBytes: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // BigInt to number conversion (safe for storage sizes up to ~9PB)
  return Number(user.storageUsedBytes);
}

/**
 * Get complete storage info for a user
 */
export async function getStorageInfo(userId: string): Promise<StorageInfo> {
  const [used, limit] = await Promise.all([
    getStorageUsage(userId),
    getStorageLimit(userId)
  ]);

  const available = Math.max(0, limit - used);
  const usedPercentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return {
    used,
    limit,
    available,
    usedPercentage,
    usedFormatted: formatBytes(used),
    limitFormatted: formatBytes(limit),
    availableFormatted: formatBytes(available)
  };
}

/**
 * Check if user has enough storage capacity for a new file
 */
export async function hasCapacity(userId: string, fileSizeBytes: number): Promise<{
  hasCapacity: boolean;
  available: number;
  required: number;
  shortfall: number;
}> {
  const [used, limit] = await Promise.all([
    getStorageUsage(userId),
    getStorageLimit(userId)
  ]);

  const available = Math.max(0, limit - used);
  const hasCapacity = fileSizeBytes <= available;
  const shortfall = hasCapacity ? 0 : fileSizeBytes - available;

  return {
    hasCapacity,
    available,
    required: fileSizeBytes,
    shortfall
  };
}

/**
 * Increment storage usage after file upload
 */
export async function incrementStorage(userId: string, bytes: number): Promise<void> {
  console.log(`📊 [Storage] Incrementing storage for user ${userId.substring(0, 8)}... by ${formatBytes(bytes)}`);

  await prisma.users.update({
    where: { id: userId },
    data: {
      storageUsedBytes: {
        increment: BigInt(bytes)
      }
    }
  });

  console.log(`✅ [Storage] Storage incremented successfully`);
}

/**
 * Decrement storage usage after file deletion
 */
export async function decrementStorage(userId: string, bytes: number): Promise<void> {
  console.log(`📊 [Storage] Decrementing storage for user ${userId.substring(0, 8)}... by ${formatBytes(bytes)}`);

  // Get current usage to prevent going negative
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { storageUsedBytes: true }
  });

  if (!user) {
    console.error(`❌ [Storage] User not found: ${userId}`);
    return;
  }

  const currentUsage = Number(user.storageUsedBytes);
  const newUsage = Math.max(0, currentUsage - bytes);

  await prisma.users.update({
    where: { id: userId },
    data: {
      storageUsedBytes: BigInt(newUsage)
    }
  });

  console.log(`✅ [Storage] Storage decremented successfully (${formatBytes(currentUsage)} -> ${formatBytes(newUsage)})`);
}

/**
 * Recalculate storage usage from actual documents (for repair/sync)
 */
export async function recalculateStorage(userId: string): Promise<{
  previousUsage: number;
  actualUsage: number;
  difference: number;
}> {
  console.log(`🔄 [Storage] Recalculating storage for user ${userId.substring(0, 8)}...`);

  // Get current stored usage
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { storageUsedBytes: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const previousUsage = Number(user.storageUsedBytes);

  // Calculate actual usage from documents
  const result = await prisma.documents.aggregate({
    where: { userId },
    _sum: { fileSize: true }
  });

  const actualUsage = result._sum.fileSize || 0;

  // Update if different
  if (previousUsage !== actualUsage) {
    await prisma.users.update({
      where: { id: userId },
      data: {
        storageUsedBytes: BigInt(actualUsage)
      }
    });
    console.log(`✅ [Storage] Usage corrected: ${formatBytes(previousUsage)} -> ${formatBytes(actualUsage)}`);
  } else {
    console.log(`✅ [Storage] Usage is accurate: ${formatBytes(actualUsage)}`);
  }

  return {
    previousUsage,
    actualUsage,
    difference: actualUsage - previousUsage
  };
}

export default {
  STORAGE_TIERS,
  formatBytes,
  getStorageLimit,
  getStorageUsage,
  getStorageInfo,
  hasCapacity,
  incrementStorage,
  decrementStorage,
  recalculateStorage
};
