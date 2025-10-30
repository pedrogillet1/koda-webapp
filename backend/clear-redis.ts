import { createClient } from 'redis';

(async () => {
  const redis = createClient({
    url: 'redis://localhost:6379'
  });

  await redis.connect();
  const flushed = await redis.flushDb();
  console.log('✅ Redis cache cleared:', flushed);
  await redis.quit();
  process.exit(0);
})();
