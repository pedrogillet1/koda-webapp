/**
 * Seed Terminology Script
 *
 * Populates the terminology_maps table with professional terminology
 * for semantic query expansion across multiple domains and languages.
 *
 * Usage: npx tsx scripts/seed-terminology.ts [--system-user-id <id>] [--clear]
 */

import { PrismaClient } from '@prisma/client';
import { terminologySeedData, terminologyStats } from './data/terminology_seed_data';

const prisma = new PrismaClient();

// System user ID for storing global terminology
// This should be a dedicated system user or admin account
const DEFAULT_SYSTEM_USER_ID = 'system-terminology';

async function getOrCreateSystemUser(): Promise<string> {
  // Check command line args for custom system user ID
  const args = process.argv.slice(2);
  const userIdIndex = args.indexOf('--system-user-id');
  if (userIdIndex !== -1 && args[userIdIndex + 1]) {
    return args[userIdIndex + 1];
  }

  // Try to find an existing admin user
  const adminUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'admin' } },
        { email: { contains: 'system' } }
      ]
    }
  });

  if (adminUser) {
    console.log(`📌 Using existing admin user: ${adminUser.email} (${adminUser.id})`);
    return adminUser.id;
  }

  // Try to find any existing user (for development)
  const anyUser = await prisma.user.findFirst();
  if (anyUser) {
    console.log(`📌 Using existing user: ${anyUser.email} (${anyUser.id})`);
    return anyUser.id;
  }

  console.error('❌ No users found in database. Please create a user first.');
  process.exit(1);
}

async function clearExistingTerminology(userId: string): Promise<void> {
  console.log('🗑️  Clearing existing terminology...');
  const deleted = await prisma.terminologyMap.deleteMany({
    where: { userId }
  });
  console.log(`   Deleted ${deleted.count} existing entries`);
}

async function seedTerminology(userId: string): Promise<void> {
  console.log('\n📚 Seeding terminology database...\n');
  console.log('   Statistics from seed data:');
  console.log(`   - Total terms: ${terminologyStats.total}`);
  console.log(`   - Domains: ${JSON.stringify(terminologyStats.byDomain)}`);
  console.log(`   - Languages: ${JSON.stringify(terminologyStats.byLanguage)}`);
  console.log('');

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches for better performance
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < terminologySeedData.length; i += batchSize) {
    batches.push(terminologySeedData.slice(i, i + batchSize));
  }

  console.log(`   Processing ${batches.length} batches of ${batchSize} terms each...\n`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    for (const entry of batch) {
      try {
        // Combine domain and language into the domain field for storage
        // Format: "financial_en" or "legal_pt"
        const domainWithLang = `${entry.domain}_${entry.language}`;

        const result = await prisma.terminologyMap.upsert({
          where: {
            userId_term_domain: {
              userId,
              term: entry.term.toLowerCase(),
              domain: domainWithLang
            }
          },
          update: {
            synonyms: JSON.stringify(entry.synonyms)
          },
          create: {
            userId,
            term: entry.term.toLowerCase(),
            synonyms: JSON.stringify(entry.synonyms),
            domain: domainWithLang
          }
        });

        if (result.createdAt.getTime() === result.createdAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error: any) {
        errors++;
        console.error(`   ❌ Error seeding term "${entry.term}":`, error.message);
      }
    }

    // Progress indicator
    const progress = Math.round(((batchIndex + 1) / batches.length) * 100);
    process.stdout.write(`\r   Progress: ${progress}% (${batchIndex + 1}/${batches.length} batches)`);
  }

  console.log('\n');
  console.log('📊 Seeding Results:');
  console.log(`   ✅ Created/Updated: ${created + updated} entries`);
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors}`);
  }
}

async function verifySeeding(userId: string): Promise<void> {
  console.log('\n🔍 Verifying seeded data...\n');

  // Count by domain
  const domainCounts = await prisma.terminologyMap.groupBy({
    by: ['domain'],
    where: { userId },
    _count: { id: true }
  });

  console.log('   Terms by domain:');
  for (const dc of domainCounts) {
    console.log(`   - ${dc.domain}: ${dc._count.id} terms`);
  }

  // Sample some terms
  console.log('\n   Sample terms:');
  const samples = await prisma.terminologyMap.findMany({
    where: { userId },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  for (const sample of samples) {
    const synonyms = JSON.parse(sample.synonyms);
    console.log(`   - "${sample.term}" (${sample.domain}): ${synonyms.slice(0, 3).join(', ')}...`);
  }

  // Total count
  const total = await prisma.terminologyMap.count({ where: { userId } });
  console.log(`\n   Total terminology entries: ${total}`);
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Koda Terminology Seeding Script                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check for clear flag
    const shouldClear = process.argv.includes('--clear');

    // Get system user ID
    const userId = await getOrCreateSystemUser();
    console.log(`\n🔑 Using user ID: ${userId}\n`);

    // Clear existing if requested
    if (shouldClear) {
      await clearExistingTerminology(userId);
    }

    // Seed terminology
    await seedTerminology(userId);

    // Verify
    await verifySeeding(userId);

    console.log('\n✅ Terminology seeding complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
