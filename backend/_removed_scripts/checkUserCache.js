/**
 * Check if specific user has semantic cache entries
 */

const Redis = require('ioredis');
require('dotenv').config();

const FRIEND_USER_ID = 'd141ee38-1527-419a-a6ea-5b0ceab3af8b';

async function checkUserCache() {
  console.log('🔍 Checking cache for user:', FRIEND_USER_ID);

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  try {
    // Check for semantic cache entries for this user
    const semanticCacheKey = `semantic_cache:${FRIEND_USER_ID}:queries`;
    const cacheData = await redis.get(semanticCacheKey);

    console.log('\n📦 Semantic Cache Key:', semanticCacheKey);

    if (cacheData) {
      console.log('✅ Cache EXISTS for this user');
      const parsed = JSON.parse(cacheData);
      console.log(`📊 Number of cached queries: ${parsed.length}`);

      console.log('\n📝 Cached queries:');
      parsed.forEach((item, i) => {
        console.log(`\n${i + 1}. Query: "${item.query}"`);
        console.log(`   Timestamp: ${item.timestamp}`);
        console.log(`   Hit count: ${item.hitCount}`);
        console.log(`   Answer preview: ${JSON.stringify(item.answer).substring(0, 150)}...`);
      });

      // Delete this specific cache
      console.log('\n🗑️  Deleting cache for this user...');
      await redis.del(semanticCacheKey);
      console.log('✅ Cache deleted!');
    } else {
      console.log('❌ NO cache found for this user');

      // Check all semantic cache keys
      console.log('\n🔍 Checking ALL semantic cache keys...');
      const allKeys = await redis.keys('semantic_cache:*:queries');
      console.log(`📦 Total semantic cache keys in Redis: ${allKeys.length}`);

      if (allKeys.length > 0) {
        console.log('Keys found:');
        allKeys.forEach(key => console.log(`  - ${key}`));
      }
    }

    redis.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    redis.disconnect();
    process.exit(1);
  }
}

checkUserCache();
