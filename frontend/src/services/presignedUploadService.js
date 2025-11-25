import api from './api';
import axios from 'axios'; // For direct S3 uploads only
// TODO: Implement client-side encryption
// import { encryptFile } from './encryption';

/**
 * Retry completion notification with exponential backoff
 */
async function notifyCompletionWithRetry(documentIds, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📢 Attempt ${attempt}/${maxRetries}: Notifying backend of completion...`);
      const response = await api.post('/api/presigned-urls/complete', {
        documentIds
      });
      console.log(`✅ Success on attempt ${attempt}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.response?.data || error.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ All ${maxRetries} attempts failed. Documents will remain in "uploading" status.`);
        throw error;
      }
    }
  }
}

/**
 * Presigned Upload Service
 *
 * Handles file uploads using AWS S3 presigned URLs.
 * Files are uploaded directly to S3, bypassing the backend.
 */
class PresignedUploadService {
  constructor() {
    // ✅ OPTIMIZATION: Increased concurrency from 20 to 30 for 1.5x faster uploads
    // Concurrency limit: how many files to upload in parallel
    this.maxConcurrentUploads = 30;
  }

  /**
   * Upload folder using presigned URLs
   *
   * @param {File[]} files - Array of File objects to upload
   * @param {string} folderId - Folder ID to upload to (optional)
   * @param {function} onProgress - Progress callback (progress, fileName, stage)
   * @returns {Promise<Array>} Array of upload results
   */
  async uploadFolder(files, folderId, onProgress) {
    const startTime = Date.now();
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    console.log(`📁 Starting presigned upload for ${files.length} files (${(totalSize / 1024 / 1024).toFixed(2)}MB total)`);

    try {
      // Step 1: Request presigned URLs from backend
      const urlStartTime = Date.now();
      console.log('📝 Requesting presigned URLs from backend...');
      const urlRequests = files.map(file => ({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        relativePath: file.webkitRelativePath || null
      }));

      const { data } = await api.post('/api/presigned-urls/bulk', {
        files: urlRequests,
        folderId
      });

      const { presignedUrls, documentIds, encryptedFilenames } = data;
      const urlDuration = Date.now() - urlStartTime;
      console.log(`✅ Received ${presignedUrls.length} presigned URLs in ${urlDuration}ms`);
      console.log(`📊 [METRICS] URL generation speed: ${(presignedUrls.length / (urlDuration / 1000)).toFixed(2)} URLs/second`);

      // Step 2: Upload files directly to AWS S3 in batches
      const uploadStartTime = Date.now();
      console.log(`🚀 Starting upload of ${files.length} files (${this.maxConcurrentUploads} concurrent)...`);
      const results = await this.uploadInBatches(
        files,
        presignedUrls,
        documentIds,
        encryptedFilenames,
        onProgress
      );

      const uploadDuration = Date.now() - uploadStartTime;
      const successfulUploads = results.filter(r => r.success);
      console.log(`📊 [METRICS] Upload duration: ${uploadDuration}ms (${(uploadDuration / 1000 / 60).toFixed(2)} minutes)`);
      console.log(`📊 [METRICS] Upload throughput: ${(successfulUploads.length / (uploadDuration / 1000 / 60)).toFixed(2)} files/minute`);
      console.log(`📊 [METRICS] Data throughput: ${(totalSize / 1024 / 1024 / (uploadDuration / 1000)).toFixed(2)} MB/second`);

      // Step 3: Notify backend that uploads are complete
      console.log(`📢 Notifying backend of ${successfulUploads.length} successful uploads...`);

      if (successfulUploads.length > 0) {
        try {
          console.log(`📢 Calling /api/presigned-urls/complete with ${successfulUploads.length} document IDs...`);
          const completeResponse = await notifyCompletionWithRetry(
            successfulUploads.map(r => r.documentId)
          );
          console.log(`✅ Backend acknowledged completion:`, completeResponse);
          console.log(`✅ ${completeResponse.queued} documents queued for processing`);
        } catch (completeError) {
          console.error('❌ CRITICAL: Failed to notify backend of upload completion!');
          console.error('❌ Documents will remain in "uploading" status and won\'t be processed!');
          console.error('❌ Error details:', {
            status: completeError.response?.status,
            statusText: completeError.response?.statusText,
            message: completeError.response?.data?.error || completeError.message,
            documentIds: successfulUploads.map(r => r.documentId)
          });

          // Show user-friendly error
          alert(`⚠️ Files uploaded to S3 successfully, but failed to start processing.\n\nPlease contact support or use the "Retrigger Stuck Documents" button.`);

          // Don't throw - let the upload succeed even if completion notification fails
          // User can manually trigger reprocessing later
        }
      }

      // Log summary
      const failed = results.filter(r => !r.success);
      const totalDuration = Date.now() - startTime;
      console.log(`✅ Upload complete! ${successfulUploads.length}/${results.length} files uploaded successfully`);
      console.log(`📊 [METRICS] Total time: ${totalDuration}ms (${(totalDuration / 1000 / 60).toFixed(2)} minutes)`);
      console.log(`📊 [METRICS] Success rate: ${(successfulUploads.length / results.length * 100).toFixed(2)}%`);
      if (failed.length > 0) {
        console.warn(`⚠️ ${failed.length} files failed:`, failed.map(f => f.fileName));
      }

      return results;

    } catch (error) {
      console.error('❌ Error in presigned upload:', error);
      throw error;
    }
  }

  /**
   * Upload files in batches with concurrency limit
   * @private
   */
  async uploadInBatches(files, presignedUrls, documentIds, encryptedFilenames, onProgress) {
    // Split files into batches
    const batches = [];
    for (let i = 0; i < files.length; i += this.maxConcurrentUploads) {
      batches.push({
        files: files.slice(i, i + this.maxConcurrentUploads),
        urls: presignedUrls.slice(i, i + this.maxConcurrentUploads),
        ids: documentIds.slice(i, i + this.maxConcurrentUploads),
        filenames: encryptedFilenames.slice(i, i + this.maxConcurrentUploads)
      });
    }

    console.log(`📦 Created ${batches.length} batches (${this.maxConcurrentUploads} files per batch)`);

    const results = [];
    let completedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n🚀 Batch ${batchIndex + 1}/${batches.length} (${batch.files.length} files)`);

      // Upload all files in batch concurrently
      const batchPromises = batch.files.map((file, batchIdx) =>
        this.uploadSingleFile(
          file,
          batch.urls[batchIdx],
          batch.ids[batchIdx],
          batch.filenames[batchIdx],
          null // No per-file progress tracking
        ).then(result => {
          // When each file completes, update overall progress
          if (result.success) {
            completedCount++;
            if (onProgress) {
              // Upload phase is 0-50% (files uploaded to S3)
              // Processing phase is 50-100% (handled by WebSocket updates)
              const uploadProgress = (completedCount / files.length) * 50; // Cap at 50%
              const stage = completedCount === files.length ? 'Processing...' : `Uploading (${completedCount}/${files.length})`;
              onProgress(uploadProgress, '', stage);
            }
          }
          return result;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Final progress update - cap at 50% (upload phase complete)
    if (onProgress) {
      const successfulUploads = results.filter(r => r.success).length;
      const uploadProgress = (successfulUploads / files.length) * 50; // Cap at 50%
      onProgress(uploadProgress, '', 'Processing...');
    }

    return results;
  }

  /**
   * Upload single file directly to AWS S3
   * @private
   */
  async uploadSingleFile(file, presignedUrl, documentId, encryptedFilename, onProgress) {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        console.log(`📤 Uploading "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);

        // TODO: Step 1: Encrypt file client-side (currently skipped)
        // if (onProgress) onProgress(10, 'Encrypting...');
        // const startEncrypt = Date.now();
        // const encryptedFile = await encryptFile(file);
        // const encryptTime = Date.now() - startEncrypt;
        // console.log(`🔐 Encrypted "${file.name}" in ${encryptTime}ms`);

        // Step 2: Upload file DIRECTLY to AWS S3 (bypasses backend!)
        if (onProgress) onProgress(10, 'Uploading...');
        const startUpload = Date.now();

        const response = await axios.put(presignedUrl, file, {
          headers: {
            'Content-Type': file.type,
            'x-amz-server-side-encryption': 'AES256' // Required - matches presigned URL signature
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const uploadPercent = (progressEvent.loaded / progressEvent.total) * 60;
              onProgress(30 + uploadPercent, 'Uploading...');
            }
          }
        });

        const uploadTime = Date.now() - startUpload;

        if (response.status !== 200) {
          throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
        }

        console.log(`✅ Uploaded "${file.name}" in ${uploadTime}ms`);

        if (onProgress) onProgress(100, 'Complete');

        return {
          documentId,
          fileName: file.name,
          encryptedFilename,
          success: true,
          uploadTime
        };

      } catch (error) {
        retries++;

        if (retries >= maxRetries) {
          console.error(`❌ Failed to upload "${file.name}" after ${maxRetries} retries:`, error);

          // ✅ ROLLBACK: Delete orphaned database record since S3 upload failed
          try {
            console.log(`🗑️  Rolling back: Deleting database record for "${file.name}" (ID: ${documentId})...`);
            await api.delete(`/api/documents/${documentId}`);
            console.log(`✅ Rollback successful: Database record deleted for "${file.name}"`);
          } catch (rollbackError) {
            console.error(`❌ Rollback failed for "${file.name}":`, rollbackError.message);
            console.error('⚠️  Orphaned database record may exist - run cleanup script');
          }

          return {
            documentId,
            fileName: file.name,
            success: false,
            error: error.message
          };
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retries) * 1000;
        console.log(`⏳ Retrying "${file.name}" in ${delay}ms (attempt ${retries + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

export default new PresignedUploadService();
