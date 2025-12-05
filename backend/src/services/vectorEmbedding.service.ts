/**
 * Vector Embedding Service - STUB (service removed)
 */

export const storeDocumentEmbeddings = async (documentId: string, chunks: any[]): Promise<void> => {};
export const deleteDocumentEmbeddings = async (documentId: string): Promise<void> => {};
export const generateEmbeddings = async () => [];
export const searchSimilar = async () => [];

export default {
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
  generateEmbeddings,
  searchSimilar,
};
