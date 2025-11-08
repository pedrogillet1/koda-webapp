const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
require('dotenv').config();

// SQLite source
const sourceDb = new sqlite3.Database('./prisma/test.db');

// PostgreSQL target
const targetDb = new Client({
  connectionString: process.env.DATABASE_URL,
});

function getSQLiteData(table) {
  return new Promise((resolve, reject) => {
    sourceDb.all(`SELECT * FROM ${table}`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function migrate() {
  console.log('🚀 Starting SQLite to Supabase migration...\n');

  try {
    await targetDb.connect();
    console.log('✅ Connected to Supabase\n');

    // Get list of tables from SQLite
    const tables = await new Promise((resolve, reject) => {
      sourceDb.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.name));
        }
      );
    });

    console.log(`Found ${tables.length} tables to migrate\n`);

    let totalRecords = 0;

    for (const table of tables) {
      try {
        const rows = await getSQLiteData(table);

        if (rows.length === 0) {
          console.log(`ℹ️  ${table}: no data`);
          continue;
        }

        console.log(`📋 Migrating ${table} (${rows.length} records)...`);

        let migrated = 0;
        for (const row of rows) {
          try {
            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            const query = `
              INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `;

            await targetDb.query(query, values);
            migrated++;
          } catch (err) {
            // Silently skip conflicts/errors
          }
        }

        console.log(`   ✅ Migrated ${migrated}/${rows.length} records`);
        totalRecords += migrated;

      } catch (err) {
        console.log(`   ⚠️  Error: ${err.message}`);
      }
    }

    console.log(`\n🎉 Migration complete! Total: ${totalRecords} records\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    sourceDb.close();
    await targetDb.end();
  }
}

migrate();
