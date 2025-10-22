import { Redis } from 'ioredis';
import { config } from './env';

let redisConnection: Redis | null = null;

try {
  // Railway sets REDIS_URL, local dev uses REDIS_HOST/REDIS_PORT
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Use REDIS_URL for Railway/production
    console.log('🔗 Connecting to Redis using REDIS_URL...');
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      lazyConnect: true,
    });
  } else {
    // Use host/port for local development
    console.log('🔗 Connecting to Redis using REDIS_HOST/PORT...');
    redisConnection = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
      lazyConnect: true,
    });
  }

  redisConnection.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redisConnection.on('error', (error) => {
    console.warn('⚠️  Redis connection error (continuing without Redis):', error.message);
  });

  // Try to connect
  redisConnection.connect().catch((err) => {
    console.warn('⚠️  Redis not available (continuing without background jobs):', err.message);
    redisConnection = null;
  });
} catch (error) {
  console.warn('⚠️  Redis initialization failed (continuing without Redis)');
  redisConnection = null;
}

export { redisConnection };
export default redisConnection;
