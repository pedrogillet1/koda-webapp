import prisma from '../config/database';

/**
 * Create a new folder
 */
export const createFolder = async (
  userId: string,
  name: string,
  emoji?: string,
  parentFolderId?: string,
  encryptionMetadata?: {
    nameEncrypted?: string;
    encryptionSalt?: string;
    encryptionIV?: string;
    encryptionAuthTag?: string;
    isEncrypted?: boolean;
  }
) => {
  const folder = await prisma.folder.create({
    data: {
      userId,
      name,
      emoji: emoji || null,
      parentFolderId: parentFolderId || null,
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Store encryption metadata
      ...(encryptionMetadata?.isEncrypted && {
        nameEncrypted: encryptionMetadata.nameEncrypted || null,
        encryptionSalt: encryptionMetadata.encryptionSalt || null,
        encryptionIV: encryptionMetadata.encryptionIV || null,
        encryptionAuthTag: encryptionMetadata.encryptionAuthTag || null,
      }),
    },
    include: {
      parentFolder: true,
      subfolders: true,
      _count: {
        select: {
          documents: true,
        },
      },
    },
  });

  return folder;
};

/**
 * Get or create a folder by name (for auto-categorization)
 */
export const getOrCreateFolderByName = async (userId: string, folderName: string) => {
  // First, try to find existing folder
  const existingFolder = await prisma.folder.findFirst({
    where: {
      userId,
      name: folderName,
      parentFolderId: null, // Only check top-level folders
    },
  });

  if (existingFolder) {
    return existingFolder;
  }

  // Create new folder if it doesn't exist
  const newFolder = await prisma.folder.create({
    data: {
      userId,
      name: folderName,
      parentFolderId: null,
    },
  });

  return newFolder;
};

/**
 * Recursively count all documents in a folder and its subfolders
 */
const countDocumentsRecursively = async (folderId: string): Promise<number> => {
  // Count documents in this folder
  const directDocuments = await prisma.document.count({
    where: { folderId },
  });

  // Get subfolders
  const subfolders = await prisma.folder.findMany({
    where: { parentFolderId: folderId },
    select: { id: true },
  });

  // Recursively count documents in subfolders
  let subfoldersDocumentCount = 0;
  for (const subfolder of subfolders) {
    subfoldersDocumentCount += await countDocumentsRecursively(subfolder.id);
  }

  return directDocuments + subfoldersDocumentCount;
};

/**
 * Get folder tree for a user
 */
export const getFolderTree = async (userId: string, includeAll: boolean = false) => {
  const where: any = { userId };

  // Only filter by parentFolderId if we DON'T want all folders
  if (!includeAll) {
    where.parentFolderId = null; // Only get root-level categories
  }

  // When includeAll=true, return a FLAT list (no nested subfolders)
  // When includeAll=false, include nested subfolders structure
  const folders = await prisma.folder.findMany({
    where,
    include: {
      subfolders: includeAll ? false : true, // Only nest when NOT returning all
      _count: {
        select: {
          documents: true,
          subfolders: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Add recursive document count (only for root folders to avoid redundancy)
  if (!includeAll) {
    const foldersWithTotalCount = await Promise.all(
      folders.map(async (folder) => {
        const totalDocuments = await countDocumentsRecursively(folder.id);
        return {
          ...folder,
          _count: {
            ...folder._count,
            totalDocuments, // Total documents including all subfolders
          },
        };
      })
    );
    return foldersWithTotalCount;
  }

  return folders;
};

/**
 * Get single folder with contents
 */
export const getFolder = async (folderId: string, userId: string) => {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      subfolders: true,
      documents: {
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!folder) {
    throw new Error('Folder not found');
  }

  if (folder.userId !== userId) {
    throw new Error('Unauthorized');
  }

  return folder;
};

/**
 * Update folder
 */
export const updateFolder = async (folderId: string, userId: string, name?: string, emoji?: string, parentFolderId?: string | null) => {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
  });

  if (!folder) {
    throw new Error('Folder not found');
  }

  if (folder.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // If parentFolderId is provided, validate it's not a circular reference
  if (parentFolderId !== undefined) {
    // Can't set folder as its own parent
    if (parentFolderId === folderId) {
      throw new Error('Cannot set folder as its own parent');
    }

    // Check for circular reference (folder being moved into one of its descendants)
    if (parentFolderId) {
      const isDescendant = await checkIfDescendant(folderId, parentFolderId);
      if (isDescendant) {
        throw new Error('Cannot move folder into its own descendant');
      }
    }
  }

  const updateData: any = {};
  if (name !== undefined) {
    updateData.name = name;
  }
  if (emoji !== undefined) {
    updateData.emoji = emoji;
  }
  if (parentFolderId !== undefined) {
    updateData.parentFolderId = parentFolderId;
  }

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: updateData,
  });

  return updated;
};

/**
 * Check if targetFolder is a descendant of sourceFolder
 */
const checkIfDescendant = async (sourceFolderId: string, targetFolderId: string): Promise<boolean> => {
  let currentFolder = await prisma.folder.findUnique({
    where: { id: targetFolderId },
  });

  while (currentFolder) {
    if (currentFolder.id === sourceFolderId) {
      return true;
    }
    if (!currentFolder.parentFolderId) {
      return false;
    }
    currentFolder = await prisma.folder.findUnique({
      where: { id: currentFolder.parentFolderId },
    });
  }

  return false;
};

/**
 * Bulk create folders from folder tree structure - REDESIGNED
 * Uses transaction for atomic operation and better performance
 *
 * IMPORTANT: This function creates SUBFOLDERS only, not the root category
 * The root category (parentFolderId) must already exist before calling this
 *
 * @param userId - User ID who owns the folders
 * @param folderTree - Array of folders to create with {name, path, parentPath, depth}
 * @param defaultEmoji - Emoji to use for folders (default: 📁)
 * @param parentFolderId - The category ID under which to create these subfolders
 */
export const bulkCreateFolders = async (
  userId: string,
  folderTree: Array<{ name: string; path: string; parentPath?: string | null; depth?: number }>,
  defaultEmoji: string | null = null, // Change default to null to allow SVG icon
  parentFolderId?: string
) => {
  const startTime = Date.now();
  console.log(`\n📁 ===== BACKEND: BULK CREATE SUBFOLDERS =====`);
  console.log(`User ID: ${userId}`);
  console.log(`Parent Category ID: ${parentFolderId || 'NONE (will create root folders)'}`);
  console.log(`Number of subfolders to create: ${folderTree.length}`);

  if (folderTree.length === 0) {
    console.log(`No subfolders to create, returning empty map`);
    return {};
  }

  const folderMap: { [path: string]: string } = {};

  // Sort by depth to ensure parents are created before children
  const sortedFolders = folderTree.sort((a, b) => {
    const aDepth = a.depth !== undefined ? a.depth : a.path.split('/').length - 1;
    const bDepth = b.depth !== undefined ? b.depth : b.path.split('/').length - 1;
    return aDepth - bDepth;
  });

  console.log(`\nFolders sorted by depth:`);
  sortedFolders.forEach(f => {
    const depth = f.depth !== undefined ? f.depth : f.path.split('/').length - 1;
    console.log(`  - "${f.name}" (path: ${f.path}, parent: ${f.parentPath || 'CATEGORY'}, depth: ${depth})`);
  });

  // Use transaction for atomic operation
  await prisma.$transaction(async (tx) => {
    for (const folderData of sortedFolders) {
      const { name, path, parentPath } = folderData;

      // Determine parent folder ID
      let resolvedParentFolderId: string | null;

      if (parentPath === null || parentPath === undefined) {
        // Direct child of category (first level subfolder)
        resolvedParentFolderId = parentFolderId || null;
        console.log(`\n  📂 Creating first-level subfolder "${name}"`);
        console.log(`     Path: ${path}`);
        console.log(`     Parent: Category (${resolvedParentFolderId})`);
      } else {
        // Nested subfolder - look up parent from folderMap
        resolvedParentFolderId = folderMap[parentPath];
        console.log(`\n  📂 Creating nested subfolder "${name}"`);
        console.log(`     Path: ${path}`);
        console.log(`     Parent path: ${parentPath}`);
        console.log(`     Parent ID: ${resolvedParentFolderId}`);

        if (!resolvedParentFolderId) {
          throw new Error(`Parent folder not found for path "${parentPath}" when creating "${name}"`);
        }
      }

      // Create the folder within transaction
      const folder = await tx.folder.create({
        data: {
          userId,
          name,
          emoji: defaultEmoji,
          parentFolderId: resolvedParentFolderId,
        },
      });

      console.log(`     ✅ Created with ID: ${folder.id}`);

      // Store the mapping
      folderMap[path] = folder.id;
    }
  });

  const duration = Date.now() - startTime;
  console.log(`\n✅ Successfully created ${sortedFolders.length} subfolders in ${duration}ms`);
  console.log(`Folder mapping:`, folderMap);
  console.log(`===== END BULK CREATE =====\n`);

  return folderMap;
};

/**
 * Delete folder (cascade delete - deletes all subfolders and documents)
 */
export const deleteFolder = async (folderId: string, userId: string) => {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      subfolders: true,
      documents: true,
    },
  });

  if (!folder) {
    throw new Error('Folder not found');
  }

  if (folder.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Recursively delete all subfolders
  if (folder.subfolders.length > 0) {
    for (const subfolder of folder.subfolders) {
      await deleteFolder(subfolder.id, userId);
    }
  }

  // Delete all documents in this folder
  if (folder.documents.length > 0) {
    await prisma.document.deleteMany({
      where: { folderId: folderId },
    });
  }

  // Delete the folder itself
  await prisma.folder.delete({
    where: { id: folderId },
  });

  return { success: true };
};
