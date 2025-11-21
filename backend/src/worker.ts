/**
 * Background Worker
 * Processes jobs from the document processing queue
 * Run this as a separate process: npm run worker
 */

import 'dotenv/config';
import { documentWorker } from './queues/document.queue';

console.log('🚀 Starting KODA background worker...');
console.log(`📊 Worker concurrency: ${process.env.WORKER_CONCURRENCY || 10}`);
console.log(`🔗 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

// Log worker status
if (documentWorker) {
  console.log('✅ Document processing worker initialized successfully');
  console.log('⏳ Waiting for jobs...');
} else {
  console.error('❌ Failed to initialize worker - Redis may not be available');
  console.error('⚠️  Make sure Redis is running and REDIS_HOST/REDIS_PORT are set correctly');
  process.exit(1);
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n📴 Received ${signal}, shutting down worker gracefully...`);

  if (documentWorker) {
    await documentWorker.close();
    console.log('✅ Worker closed successfully');
  }

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep the process running
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ Worker is running and ready to process jobs');
