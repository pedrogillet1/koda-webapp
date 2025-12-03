import prisma from '../config/database';

/**
 * Create a new tag
 */
export const createTag = async (userId: string, name: string, color?: string) => {
  const tag = await prisma.tag.create({
    data: {
      userId,
      name: name.toLowerCase(),
      color: color || '#3B82F6', // Default blue color
    },
  });

  return tag;
};

/**
 * Get all tags for a user
 */
export const getUserTags = async (userId: string) => {
  const tags = await prisma.tag.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          documents: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return tags;
};

/**
 * Add tag to document
 */
export const addTagToDocument = async (documentId: string, tagId: string, userId: string) => {
  // Verify document ownership
  const document = await prisma.documents.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Verify tag ownership
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error('Tag not found');
  }

  if (tag.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Check if already tagged
  const existing = await prisma.document_tags.findFirst({
    where: {
      documentId,
      tagId,
    },
  });

  if (existing) {
    return existing;
  }

  // Add tag
  const documentTag = await prisma.document_tags.create({
    data: {
      documentId,
      tagId,
    },
    include: {
      tags: true,
    },
  });

  return documentTag;
};

/**
 * Remove tag from document
 */
export const removeTagFromDocument = async (documentId: string, tagId: string, userId: string) => {
  // Verify document ownership
  const document = await prisma.documents.findUnique({
    where: { id: documentId },
  });

  if (!document || document.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await prisma.document_tags.deleteMany({
    where: {
      documentId,
      tagId,
    },
  });

  return { success: true };
};

/**
 * Delete tag
 */
export const deleteTag = async (tagId: string, userId: string) => {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error('Tag not found');
  }

  if (tag.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Delete tag (will cascade to DocumentTag)
  await prisma.tag.delete({
    where: { id: tagId },
  });

  return { success: true };
};

/**
 * Search documents by tag
 */
export const searchDocumentsByTag = async (tagId: string, userId: string) => {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error('Tag not found');
  }

  if (tag.userId !== userId) {
    throw new Error('Unauthorized');
  }

  const documents = await prisma.documents.findMany({
    where: {
      userId,
      document_tags: {
        some: {
          tagId,
        },
      },
    },
    include: {
      document_tags: {
        include: {
          tags: true,
        },
      },
      folder: true,
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return documents;
};
