import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimized connection pool settings for Supabase with timeouts
  // Supabase pooler can handle 15 connections per database
  // We use a smaller pool to avoid exhausting connections
  // Add connection timeout and retry logic
  __internal: {
    engine: {
      connectTimeout: 30000, // 30 seconds
    },
  },
});

// Configure connection pool timeout and retry logic
const connectWithRetry = async (retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, error);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Failed to connect to database after all retries');
        throw error;
      }
    }
  }
};

// Connect with retry on startup
connectWithRetry().catch(console.error);

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
