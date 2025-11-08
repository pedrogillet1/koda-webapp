import prisma from '../config/database';
import vectorEmbeddingService from '../services/vectorEmbedding.service';

async function deleteDocument() {
  try {
    const docId = '75fc0452-231f-495e-a1c8-5d129ee3feed';

    console.log('🗑️  Deleting document embeddings from Pinecone...');
    await vectorEmbeddingService.deleteDocumentEmbeddings(docId);

    console.log('🗑️  Deleting document from database...');
    await prisma.document.delete({
      where: { id: docId }
    });

    console.log('✅ Document deleted successfully!');
    console.log('👉 Please re-upload the PDF through the KODA frontend');

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
  }
}

deleteDocument();
