const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📦 Adding chat history UX fields...');

    // Add columns one by one
    console.log('  ➡️  Adding summary column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS summary TEXT;
    `);

    console.log('  ➡️  Adding isPinned column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN DEFAULT FALSE NOT NULL;
    `);

    console.log('  ➡️  Adding isDeleted column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT FALSE NOT NULL;
    `);

    console.log('  ➡️  Adding deletedAt column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
    `);

    console.log('🔍 Creating indexes...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "conversations_userId_isDeleted_isPinned_updatedAt_idx"
      ON conversations ("userId", "isDeleted", "isPinned", "updatedAt");
    `);

    console.log('🔌 Enabling pg_trgm extension...');
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    console.log('🔍 Creating full-text search index...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "messages_content_gin_idx"
      ON messages USING GIN (content gin_trgm_ops);
    `);

    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('New conversation fields added:');
    console.log('  - summary (TEXT)');
    console.log('  - isPinned (BOOLEAN)');
    console.log('  - isDeleted (BOOLEAN)');
    console.log('  - deletedAt (TIMESTAMP)');
    console.log('');
    console.log('Indexes created:');
    console.log('  - conversations_userId_isDeleted_isPinned_updatedAt_idx');
    console.log('  - messages_content_gin_idx (for full-text search)');
    console.log('');
    console.log('Extension enabled:');
    console.log('  - pg_trgm (for trigram similarity search)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
