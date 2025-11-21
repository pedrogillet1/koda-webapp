import { Request, Response } from 'express';
import prisma from '../config/database';
import { addDocumentProcessingJob } from '../queues/document.queue';
import { generatePresignedUploadUrl } from '../config/storage';

// Validate AWS S3 configuration
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in environment');
  throw new Error('AWS S3 configuration is missing');
}

console.log('✅ AWS S3 client initialized for presigned URLs');

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

    const startTime = Date.now();
    console.log(`📝 Generating ${files.length} presigned URLs for user ${userId}`);

    // ✅ OPTIMIZATION: Validate all file sizes upfront
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    for (const file of files) {
      if (file.fileSize > MAX_FILE_SIZE) {
        res.status(400).json({
          error: `File too large: ${file.fileName} (${(file.fileSize / 1024 / 1024).toFixed(2)}MB). Maximum size is 500MB.`
        });
        return;
      }
    }

    // ✅ OPTIMIZATION: Process files in parallel batches of 50 to avoid connection pool exhaustion
    const BATCH_SIZE = 50;
    const results: Array<{
      presignedUrl: string;
      documentId: string;
      encryptedFilename: string;
    }> = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)} (${batch.length} files)`);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const { fileName, fileType, fileSize, relativePath } = file;

          // Generate unique encrypted filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 15);
          const encryptedFilename = `${userId}/${timestamp}-${randomSuffix}-${fileName}`;

          // Generate presigned upload URL for S3 (expires in 1 hour)
          const presignedUrl = await generatePresignedUploadUrl(
            encryptedFilename,
            fileType,
            3600 // 1 hour
          );

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

          return {
            presignedUrl,
            documentId: document.id,
            encryptedFilename
          };
        })
      );

      results.push(...batchResults);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Generated ${results.length} presigned URLs successfully in ${duration}ms`);
    console.log(`📊 [METRICS] URL generation speed: ${(results.length / (duration / 1000)).toFixed(2)} URLs/second`);
    console.log(`📊 [METRICS] Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);

    res.status(200).json({
      presignedUrls: results.map(r => r.presignedUrl),
      documentIds: results.map(r => r.documentId),
      encryptedFilenames: results.map(r => r.encryptedFilename)
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

    const startTime = Date.now();
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

    // ✅ OPTIMIZATION: Queue all documents for parallel background processing (10 concurrent)
    // Fetch document details to get encryptedFilename and mimeType
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        userId
      },
      select: {
        id: true,
        encryptedFilename: true,
        mimeType: true
      }
    });

    console.log(`🔄 Queueing ${documents.length} documents for parallel background processing...`);

    let queuedCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      try {
        await addDocumentProcessingJob({
          documentId: doc.id,
          userId,
          encryptedFilename: doc.encryptedFilename,
          mimeType: doc.mimeType
        });
        queuedCount++;
      } catch (error) {
        console.error(`❌ Failed to queue document ${doc.id}:`, error);
        skippedCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Queued ${queuedCount} documents for processing in ${duration}ms`);
    if (skippedCount > 0) {
      console.warn(`⚠️  ${skippedCount} documents failed to queue`);
    }
    console.log(`📊 [METRICS] Queue processing speed: ${(queuedCount / (duration / 1000)).toFixed(2)} jobs/second`);
    console.log(`📊 [METRICS] Worker will process 10 documents concurrently (10x throughput)`);

    res.status(200).json({
      success: true,
      count: updateResult.count,
      queued: queuedCount,
      skipped: skippedCount
    });

  } catch (error: any) {
    console.error('❌ Error completing batch upload:', error);
    res.status(500).json({ error: error.message });
  }
};
