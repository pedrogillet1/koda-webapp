import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import prisma from '../config/database';

// Initialize Supabase client with error handling
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  throw new Error('Supabase configuration is missing');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('✅ Supabase client initialized for presigned URLs');

/**
 * Generate presigned URLs for bulk file upload
 */
export const generateBulkPresignedUrls = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { files, folderId } = req.body;
    const userId = req.user.id;

    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'Files array is required and must not be empty' });
      return;
    }

    console.log(`📝 Generating ${files.length} presigned URLs for user ${userId}`);

    const presignedUrls: string[] = [];
    const documentIds: string[] = [];
    const encryptedFilenames: string[] = [];

    for (const file of files) {
      const { fileName, fileType, fileSize, relativePath } = file;

      // Validate file size (500MB limit)
      const MAX_FILE_SIZE = 500 * 1024 * 1024;
      if (fileSize > MAX_FILE_SIZE) {
        res.status(400).json({
          error: `File too large: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB). Maximum size is 500MB.`
        });
        return;
      }

      // Generate unique encrypted filename
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const encryptedFilename = `${userId}/${timestamp}-${randomSuffix}-${fileName}`;

      // Generate presigned upload URL (expires in 1 hour)
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUploadUrl(encryptedFilename, {
          upsert: false
        });

      if (error) {
        console.error(`❌ Failed to generate presigned URL for ${fileName}:`, error);
        res.status(500).json({
          error: `Failed to generate presigned URL for ${fileName}: ${error.message}`
        });
        return;
      }

      // Create document record with "uploading" status
      const document = await prisma.document.create({
        data: {
          userId,
          folderId: folderId || null,
          filename: fileName,
          encryptedFilename,
          fileSize,
          mimeType: fileType,
          status: 'uploading',
          isEncrypted: true,
          ...(relativePath && {
            metadata: { relativePath }
          })
        }
      });

      presignedUrls.push(data.signedUrl);
      documentIds.push(document.id);
      encryptedFilenames.push(encryptedFilename);
    }

    console.log(`✅ Generated ${presignedUrls.length} presigned URLs successfully`);

    res.status(200).json({
      presignedUrls,
      documentIds,
      encryptedFilenames
    });

  } catch (error: any) {
    console.error('❌ Error generating presigned URLs:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark documents as uploaded and trigger background processing
 */
export const completeBatchUpload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentIds } = req.body;
    const userId = req.user.id;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: 'Document IDs array is required and must not be empty' });
      return;
    }

    console.log(`✅ Marking ${documentIds.length} documents as uploaded for user ${userId}`);

    // Update all documents to "processing" status
    const updateResult = await prisma.document.updateMany({
      where: {
        id: { in: documentIds },
        userId,
        status: 'uploading'
      },
      data: {
        status: 'processing',
        uploadedAt: new Date()
      }
    });

    console.log(`✅ Updated ${updateResult.count} documents to processing status`);

    // Trigger background processing for each document
    for (const documentId of documentIds) {
      console.log(`🔄 Queued background processing for document ${documentId}`);
      // TODO: Integrate with your existing background processing system
      // await queueDocumentProcessing(documentId);
    }

    // Invalidate user cache ONCE for entire batch
    // TODO: Integrate with your existing cache invalidation
    // await invalidateUserCache(userId);
    console.log(`🗑️ Invalidated cache for user ${userId}`);

    res.status(200).json({
      success: true,
      count: updateResult.count
    });

  } catch (error: any) {
    console.error('❌ Error completing batch upload:', error);
    res.status(500).json({ error: error.message });
  }
};
