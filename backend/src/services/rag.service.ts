/**
 * Koda RAG Service
 *
 * Main entry point - exports from core/ragV1.service.ts
 */

import cacheService from './cache.service';

export * from './core/ragV1.service';
export { ragServiceV1 as ragService, ragServiceV1 as default } from './core/ragV1.service';

// Cache invalidation helper used by document.service.ts
export function invalidateFileListingCache(userId: string): void {
  const cacheKey = cacheService.generateKey('file-listing', userId);
  cacheService.set(cacheKey, null, { ttl: 0 });
}
