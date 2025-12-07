import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllDocuments() {
  console.log('='.repeat(60));
  console.log('DELETING ALL DOCUMENTS');
  console.log('='.repeat(60));

  try {
    // Delete in order due to foreign key constraints

    // 1. Delete document chunks
    const chunks = await prisma.$executeRaw`DELETE FROM document_chunks`;
    console.log(`Deleted document_chunks: ${chunks} rows`);

    // 2. Delete document embeddings
    const embeddings = await prisma.$executeRaw`DELETE FROM document_embeddings`;
    console.log(`Deleted document_embeddings: ${embeddings} rows`);

    // 3. Delete document metadata
    const metadata = await prisma.documentMetadata.deleteMany({});
    console.log(`Deleted document_metadata: ${metadata.count} rows`);

    // 4. Delete document summaries
    const summaries = await prisma.documentSummary.deleteMany({});
    console.log(`Deleted document_summaries: ${summaries.count} rows`);

    // 5. Delete document categories
    const categories = await prisma.documentCategory.deleteMany({});
    console.log(`Deleted document_categories: ${categories.count} rows`);

    // 6. Delete document tags
    const tags = await prisma.documentTag.deleteMany({});
    console.log(`Deleted document_tags: ${tags.count} rows`);

    // 7. Delete document keywords
    const keywords = await prisma.documentKeyword.deleteMany({});
    console.log(`Deleted document_keywords: ${keywords.count} rows`);

    // 8. Delete document entities
    const entities = await prisma.documentEntity.deleteMany({});
    console.log(`Deleted document_entities: ${entities.count} rows`);

    // 9. Delete excel cells
    const cells = await prisma.excelCell.deleteMany({});
    console.log(`Deleted excel_cells: ${cells.count} rows`);

    // 10. Delete excel sheets
    const sheets = await prisma.excelSheet.deleteMany({});
    console.log(`Deleted excel_sheets: ${sheets.count} rows`);

    // 11. Delete documents
    const docs = await prisma.document.deleteMany({});
    console.log(`Deleted documents: ${docs.count} rows`);

    console.log('\n' + '='.repeat(60));
    console.log('ALL DOCUMENTS DELETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllDocuments();
