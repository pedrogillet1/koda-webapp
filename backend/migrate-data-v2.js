const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');

// Supabase PostgreSQL target database
const targetPrisma = new PrismaClient();

// SQLite source database
const sourceDb = new sqlite3.Database('./prisma/test.db', (err) => {
  if (err) {
    console.error('❌ Error connecting to SQLite:', err);
    process.exit(1);
  }
});

function queryAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrateData() {
  console.log('🚀 Starting data migration from SQLite to Supabase PostgreSQL...\n');

  try {
    console.log('📡 Connecting to Supabase...');
    await targetPrisma.$connect();
    console.log('✅ Connected to Supabase\n');

    let totalRecords = 0;
    const stats = {};

    // Define tables and their migration order (respecting foreign keys)
    const tablesToMigrate = [
      'users',
      'roles',
      'user_roles',
      'permissions',
      'role_permissions',
      'role_hierarchy',
      'folders',
      'documents',
      'categories',
      'document_categories',
      'tags',
      'document_tags',
      'conversations',
      'messages',
      'message_attachments',
      'sessions',
      'session_documents',
      'chat_contexts',
      'chat_documents',
      'document_summaries',
      'document_embeddings',
      'document_keywords',
      'document_entities',
      'document_metadata',
      'document_shares',
      'document_edit_history',
      'document_templates',
      'generated_documents',
      'excel_sheets',
      'excel_cells',
      'analysis_sessions',
      'api_keys',
      'api_usage',
      'reminders',
      'notifications',
      'user_preferences',
      'two_factor_auth',
      'verification_codes',
      'pending_users',
      'audit_logs',
      'action_history',
      'terminology_maps',
      'cloud_integrations',
    ];

    for (const table of tablesToMigrate) {
      try {
        console.log(`📋 Migrating ${table}...`);

        // Check if table exists in SQLite
        const tableCheck = await queryAsync(sourceDb,
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [table]
        );

        if (tableCheck.length === 0) {
          console.log(`   ℹ️  Table ${table} not found in source database`);
          continue;
        }

        // Fetch all records from SQLite
        const records = await queryAsync(sourceDb, `SELECT * FROM ${table}`);

        if (records.length === 0) {
          console.log(`   ℹ️  No data in ${table}`);
          stats[table] = 0;
          continue;
        }

        // Get the Prisma model name (convert snake_case to camelCase)
        const modelName = table.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

        // Check if model exists in Prisma
        if (!targetPrisma[modelName]) {
          console.log(`   ⚠️  Prisma model '${modelName}' not found, skipping...`);
          continue;
        }

        // Insert records into Supabase
        let migratedCount = 0;
        for (const record of records) {
          try {
            // Convert SQLite data types to PostgreSQL compatible types
            const cleanedRecord = {};
            for (const [key, value] of Object.entries(record)) {
              // Handle boolean conversions (SQLite stores as 0/1)
              if (typeof value === 'number' && (value === 0 || value === 1)) {
                // Check if this might be a boolean field
                const fieldName = key.toLowerCase();
                if (fieldName.includes('is') || fieldName.includes('has') ||
                    fieldName === 'notified' || fieldName === 'completed') {
                  cleanedRecord[key] = value === 1;
                  continue;
                }
              }
              cleanedRecord[key] = value;
            }

            await targetPrisma[modelName].create({
              data: cleanedRecord,
            });
            migratedCount++;
          } catch (error) {
            console.log(`   ⚠️  Failed to migrate record in ${table}:`, error.message);
          }
        }

        totalRecords += migratedCount;
        stats[table] = migratedCount;
        console.log(`   ✅ Migrated ${migratedCount}/${records.length} records from ${table}`);

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
    sourceDb.close();
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
