const { PrismaClient } = require('@prisma/client');

// SQLite source database
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/test.db',
    },
  },
});

// Supabase PostgreSQL target database
const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function migrateData() {
  console.log('🚀 Starting data migration from SQLite to Supabase PostgreSQL...\n');

  try {
    // Connect to both databases
    console.log('📡 Connecting to databases...');
    await sourcePrisma.$connect();
    await targetPrisma.$connect();
    console.log('✅ Connected to both databases\n');

    // Get all model names (tables to migrate)
    const tables = [
      'users',
      'folders',
      'documents',
      'categories',
      'documentCategories',
      'tags',
      'documentTags',
      'conversations',
      'messages',
      'messageAttachments',
      'sessions',
      'sessionDocuments',
      'chatContexts',
      'chatDocuments',
      'documentSummaries',
      'documentEmbeddings',
      'documentKeywords',
      'documentEntities',
      'documentMetadata',
      'documentShares',
      'documentEditHistory',
      'documentTemplates',
      'generatedDocuments',
      'excelSheets',
      'excelCells',
      'analysisSessions',
      'apiKeys',
      'apiUsage',
      'reminders',
      'notifications',
      'userPreferences',
      'twoFactorAuth',
      'verificationCodes',
      'pendingUsers',
      'roles',
      'userRoles',
      'permissions',
      'rolePermissions',
      'roleHierarchy',
      'auditLogs',
      'actionHistory',
      'terminologyMaps',
      'cloudIntegrations',
    ];

    let totalRecords = 0;
    const stats = {};

    for (const table of tables) {
      try {
        // Check if the model exists in Prisma client
        if (!sourcePrisma[table] || !targetPrisma[table]) {
          console.log(`⚠️  Skipping ${table} (not found in schema)`);
          continue;
        }

        console.log(`📋 Migrating ${table}...`);

        // Fetch all records from source
        const records = await sourcePrisma[table].findMany();

        if (records.length === 0) {
          console.log(`   ℹ️  No data in ${table}`);
          stats[table] = 0;
          continue;
        }

        // Insert records into target database
        let migratedCount = 0;
        for (const record of records) {
          try {
            await targetPrisma[table].create({
              data: record,
            });
            migratedCount++;
          } catch (error) {
            // Try upsert if create fails (in case of duplicates)
            try {
              const uniqueFields = {};
              if (record.id) uniqueFields.id = record.id;

              await targetPrisma[table].upsert({
                where: uniqueFields,
                update: record,
                create: record,
              });
              migratedCount++;
            } catch (upsertError) {
              console.log(`   ⚠️  Failed to migrate record in ${table}:`, upsertError.message);
            }
          }
        }

        totalRecords += migratedCount;
        stats[table] = migratedCount;
        console.log(`   ✅ Migrated ${migratedCount} records from ${table}`);

      } catch (error) {
        console.log(`   ❌ Error migrating ${table}:`, error.message);
        stats[table] = 'error';
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log(`\n📊 Total records migrated: ${totalRecords}\n`);

    console.log('📈 Migration Summary:');
    for (const [table, count] of Object.entries(stats)) {
      if (count > 0) {
        console.log(`   • ${table}: ${count} records`);
      }
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
    console.log('\n🔌 Disconnected from databases');
  }
}

migrateData()
  .then(() => {
    console.log('\n🎉 Data migration successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Data migration failed:', error);
    process.exit(1);
  });
