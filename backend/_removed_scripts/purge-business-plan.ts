import pineconeService from './src/services/pinecone.service';

async function purge() {
  console.log('\n🧹 Purging Business Plan embeddings from Pinecone...');
  
  // These are the document IDs that might be orphaned
  // We need to find what the Business Plan document ID was
  
  // The issue is we don't know the documentId since it's deleted from DB
  // We need to query Pinecone by metadata to find and delete all vectors
  // that reference "Business Plan" in their filename
  
  console.log('⚠️  Cannot delete by filename - Pinecone requires vector IDs');
  console.log('');
  console.log('SOLUTION: We need to flush the entire Pinecone namespace or');
  console.log('recreate the index. This is a known Pinecone limitation.');
  console.log('');
  console.log('Temporary workaround:');
  console.log('1. The userRemovedAttachment fix should help');
  console.log('2. New conversations should work better');
  console.log('3. Consider re-uploading documents to fresh namespace');
}

purge();
