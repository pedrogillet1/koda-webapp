import prisma from '../config/database';
import { downloadFile } from '../services/storage.service';
import vectorEmbeddingService from '../services/vectorEmbedding.service';
import excelProcessor from '../services/excelProcessor.service';

async function forceExcelReembed() {
  try {
    console.log('\n🔄 ===== FORCE EXCEL RE-EMBEDDING WITH FILENAME =====\n');

    // Get the latest Excel file
    const latestExcel = await prisma.documents.findFirst({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestExcel) {
      console.log('❌ No Excel file found!');
      await prisma.$disconnect();
      return;
    }

    console.log(`📄 Found Excel file:`);
    console.log(`   Filename: ${latestExcel.filename}`);
    console.log(`   ID: ${latestExcel.id}`);
    console.log(`   User ID: ${latestExcel.userId}\n`);

    // Download the Excel file
    console.log('📥 Downloading file from storage...');
    const fileBuffer = await downloadFile(latestExcel.encryptedFilename);
    console.log(`✅ Downloaded ${fileBuffer.length} bytes\n`);

    // Process Excel with cell-level metadata
    console.log('📊 Processing Excel with enhanced processor...');
    const excelChunks = await excelProcessor.processExcel(fileBuffer);
    console.log(`✅ Processed ${excelChunks.length} Excel chunks\n`);

    // Convert to embedding format WITH FILENAME IN CONTENT
    console.log('📝 Adding filename to chunk content...');
    const chunks = excelChunks.map(chunk => ({
      content: `📄 File: ${latestExcel.filename} | ${chunk.content}`,
      document_metadata: {
        documentId: latestExcel.id,
        filename: latestExcel.filename,
        sheet: chunk.document_metadata.sheetName,
        sheetNumber: chunk.document_metadata.sheetNumber,
        row: chunk.document_metadata.rowNumber,
        cells: chunk.document_metadata.cells,
        chunkIndex: chunk.document_metadata.chunkIndex,
        sourceType: chunk.document_metadata.sourceType,
        tableHeaders: chunk.document_metadata.tableHeaders
      }
    }));

    console.log(`✅ Filename added to all chunks\n`);
    console.log(`Sample chunk content: ${chunks[0].content.substring(0, 100)}...\n`);

    // Delete old embeddings
    console.log('🗑️  Deleting old embeddings from Pinecone...');
    await vectorEmbeddingService.deleteDocumentEmbeddings(latestExcel.id);
    console.log('✅ Old embeddings deleted\n');

    // Store new embeddings with filename
    console.log('💾 Storing new embeddings (this may take 30-60 seconds)...');
    await vectorEmbeddingService.storeDocumentEmbeddings(
      latestExcel.id,
      latestExcel.userId,
      {
        filename: latestExcel.filename,
        mimeType: latestExcel.mimeType,
        createdAt: latestExcel.createdAt,
        status: 'completed'
      },
      chunks
    );

    console.log('\n✅ ===== RE-EMBEDDING COMPLETE =====\n');
    console.log('🎉 Excel embeddings now include filename in content!\n');
    console.log('Test with: "what excel did i upload"\n');
    console.log(`Expected: "Lista_9 (1) (1) (1).xlsx" with multiple rows\n`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

forceExcelReembed();
