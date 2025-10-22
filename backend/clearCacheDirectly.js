/**
 * Direct Redis cache clear - No authentication needed
 * Clears ALL semantic cache entries for all users
 */

const Redis = require('ioredis');
require('dotenv').config();

async function clearAllSemanticCache() {
  console.log('🗑️  Starting direct cache clear...');

  // Connect to Redis using environment variables
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  try {
    console.log('📡 Connecting to Redis...');

    // Get all keys matching semantic cache pattern
    const keys = await redis.keys('semantic_cache:*:queries');

    console.log(`📦 Found ${keys.length} semantic cache entries`);

    if (keys.length === 0) {
      console.log('✅ No cache entries found (already clear)');
      redis.disconnect();
      return;
    }

    // Delete all matching keys
    console.log('🗑️  Deleting cache entries...');
    const deletedCount = await redis.del(...keys);

    console.log(`✅ SUCCESS! Cleared ${deletedCount} cache entries for ${keys.length} users`);
    console.log('🎉 All users will now get fresh, correct answers!');

    redis.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    redis.disconnect();
    process.exit(1);
  }
}

clearAllSemanticCache();
