import sqlite3 from 'sqlite3';
import prisma from '../config/database';

// SQLite source database
const sourceDb = new (sqlite3.verbose().Database)('./prisma/test.db', (err: Error | null) => {
  if (err) {
    console.error('❌ Error connecting to SQLite:', err);
    process.exit(1);
  }
});

function queryAsync(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrateData() {
  console.log('🚀 Starting data migration from SQLite to Supabase PostgreSQL...\n');

  try {
    console.log('📡 Connecting to Supabase...');
    await prisma.$connect();
    console.log('✅ Connected to Supabase\n');

    let totalRecords = 0;
    const stats: Record<string, number | string> = {};

    // Define tables and their migration order (respecting foreign keys)
    const tablesToMigrate = [
      { table: 'users', model: 'user' },
      { table: 'roles', model: 'role' },
      { table: 'user_roles', model: 'userRole' },
      { table: 'permissions', model: 'permission' },
      { table: 'role_permissions', model: 'rolePermission' },
      { table: 'role_hierarchy', model: 'roleHierarchy' },
      { table: 'folders', model: 'folder' },
      { table: 'documents', model: 'document' },
      { table: 'categories', model: 'category' },
      { table: 'document_categories', model: 'documentCategory' },
      { table: 'tags', model: 'tag' },
      { table: 'document_tags', model: 'documentTag' },
      { table: 'conversations', model: 'conversation' },
      { table: 'messages', model: 'message' },
      { table: 'message_attachments', model: 'messageAttachment' },
      { table: 'sessions', model: 'session' },
      { table: 'session_documents', model: 'sessionDocument' },
      { table: 'chat_contexts', model: 'chatContext' },
      { table: 'chat_documents', model: 'chatDocument' },
      { table: 'document_summaries', model: 'documentSummary' },
      { table: 'document_embeddings', model: 'documentEmbedding' },
      { table: 'document_keywords', model: 'documentKeyword' },
      { table: 'document_entities', model: 'documentEntity' },
      { table: 'document_metadata', model: 'documentMetadata' },
      { table: 'document_shares', model: 'documentShare' },
      { table: 'document_edit_history', model: 'documentEditHistory' },
      { table: 'document_templates', model: 'documentTemplate' },
      { table: 'generated_documents', model: 'generatedDocument' },
      { table: 'excel_sheets', model: 'excelSheet' },
      { table: 'excel_cells', model: 'excelCell' },
      { table: 'analysis_sessions', model: 'analysisSession' },
      { table: 'api_keys', model: 'apiKey' },
      { table: 'api_usage', model: 'apiUsage' },
      { table: 'reminders', model: 'reminder' },
      { table: 'notifications', model: 'notification' },
      { table: 'user_preferences', model: 'userPreference' },
      { table: 'two_factor_auth', model: 'twoFactorAuth' },
      { table: 'verification_codes', model: 'verificationCode' },
      { table: 'pending_users', model: 'pendingUser' },
      { table: 'audit_logs', model: 'auditLog' },
      { table: 'action_history', model: 'actionHistory' },
      { table: 'terminology_maps', model: 'terminologyMap' },
      { table: 'cloud_integrations', model: 'cloudIntegration' },
    ];

    for (const { table, model } of tablesToMigrate) {
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

        // Check if model exists in Prisma
        if (!(prisma as any)[model]) {
          console.log(`   ⚠️  Prisma model '${model}' not found, skipping...`);
          continue;
        }

        // Insert records into Supabase
        let migratedCount = 0;
        for (const record of records) {
          // Convert SQLite data types to PostgreSQL compatible types
          const cleanedRecord: any = {};
          for (const [key, value] of Object.entries(record)) {
            // Handle boolean conversions (SQLite stores as 0/1)
            if (typeof value === 'number' && (value === 0 || value === 1)) {
              // Check if this might be a boolean field
              const fieldName = key.toLowerCase();
              if (fieldName.includes('is') || fieldName.includes('has') ||
                  fieldName === 'notified' || fieldName === 'completed' ||
                  fieldName === 'enabled' || fieldName === 'verified' ||
                  fieldName === 'active' || fieldName === 'deleted') {
                cleanedRecord[key] = value === 1;
                continue;
              }
            }
            cleanedRecord[key] = value;
          }

          try {
            await (prisma as any)[model].create({
              data: cleanedRecord,
            });
            migratedCount++;
          } catch (error: any) {
            // Try to handle unique constraint violations with upsert
            if (error.code === 'P2002' && record.id) {
              try {
                await (prisma as any)[model].upsert({
                  where: { id: record.id },
                  update: cleanedRecord,
                  create: cleanedRecord,
                });
                migratedCount++;
              } catch (upsertError: any) {
                console.log(`   ⚠️  Failed to upsert record in ${table}:`, upsertError.message);
              }
            } else {
              console.log(`   ⚠️  Failed to migrate record in ${table}:`, error.message);
            }
          }
        }

        totalRecords += migratedCount;
        stats[table] = migratedCount;
        console.log(`   ✅ Migrated ${migratedCount}/${records.length} records from ${table}`);

      } catch (error: any) {
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
      if (typeof count === 'number' && count > 0) {
        console.log(`   • ${table}: ${count} records`);
      }
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    sourceDb.close();
    await prisma.$disconnect();
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
