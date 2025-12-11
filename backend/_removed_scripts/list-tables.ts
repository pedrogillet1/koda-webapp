import prisma from './src/config/database';

(async () => {
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    console.log('\n=== TABLES IN DATABASE ===\n');
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.tablename}`);
    });
    console.log(`\nTotal tables: ${tables.length}`);

    // Check specifically for chunk-related tables
    const chunkTables = tables.filter(t =>
      t.tablename.toLowerCase().includes('chunk') ||
      t.tablename.toLowerCase().includes('embedding')
    );

    if (chunkTables.length > 0) {
      console.log('\n=== CHUNK/EMBEDDING RELATED TABLES ===');
      chunkTables.forEach(table => console.log(`- ${table.tablename}`));
    } else {
      console.log('\n⚠️  NO chunk or embedding tables found!');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
