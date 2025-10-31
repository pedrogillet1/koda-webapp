import Redis from 'ioredis';

async function clearRAGCache() {
  console.log('🧹 Clearing RAG cache...\n');

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  try {
    // Find all keys with the koda:rag: prefix
    const keys = await redis.keys('koda:rag:*');

    if (keys.length === 0) {
      console.log('✅ No RAG cache entries found');
    } else {
      console.log(`📋 Found ${keys.length} cached RAG responses`);

      // Delete all RAG cache keys
      await redis.del(...keys);

      console.log(`✅ Cleared ${keys.length} cached RAG responses`);
    }

    console.log('\n✅ Cache cleared successfully');
    console.log('💡 New queries will now use the optimized system prompt\n');

  } catch (error: any) {
    console.error('❌ Error clearing cache:', error.message);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

clearRAGCache();
