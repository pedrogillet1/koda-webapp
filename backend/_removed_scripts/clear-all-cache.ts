import multiLayerCacheService from './src/services/multiLayerCache.service';
import cacheService from './src/services/cache.service';

(async () => {
  try {
    console.log('🗑️  Clearing all caches...');

    // Clear multi-layer cache
    await multiLayerCacheService.clearAll();

    // Clear response cache
    await cacheService.clearAll();

    console.log('✅ All caches cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
})();
