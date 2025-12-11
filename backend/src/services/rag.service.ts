/**
 * Koda RAG Service
 *
 * Main entry point - exports from core/ragV2.service.ts
 */

import cacheService from './cache.service';

export * from './core/ragV2.service';
export { ragServiceV2 as ragService, ragServiceV2 as default } from './core/ragV2.service';

// Cache invalidation helper used by document.service.ts
export function invalidateFileListingCache(userId: string): void {
  const cacheKey = cacheService.generateKey('file-listing', userId);
  cacheService.set(cacheKey, null, { ttl: 0 });
}
