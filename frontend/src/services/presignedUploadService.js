import axios from 'axios';
// TODO: Implement client-side encryption
// import { encryptFile } from './encryption';

/**
 * Presigned Upload Service
 *
 * Handles file uploads using Supabase Storage presigned URLs.
 * Files are uploaded directly to Supabase, bypassing the backend.
 */
class PresignedUploadService {
  constructor() {
    // Concurrency limit: how many files to upload in parallel
    this.maxConcurrentUploads = 20;
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
    console.log(`📁 Starting presigned upload for ${files.length} files`);

    try {
      // Step 1: Request presigned URLs from backend
      console.log('📝 Requesting presigned URLs from backend...');
      const urlRequests = files.map(file => ({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        relativePath: file.webkitRelativePath || null
      }));

      const { data } = await axios.post('/api/presigned-urls/bulk', {
        files: urlRequests,
        folderId
      });

      const { presignedUrls, documentIds, encryptedFilenames } = data;
      console.log(`✅ Received ${presignedUrls.length} presigned URLs`);

      // Step 2: Upload files directly to Supabase in batches
      console.log(`🚀 Starting upload of ${files.length} files (${this.maxConcurrentUploads} concurrent)...`);
      const results = await this.uploadInBatches(
        files,
        presignedUrls,
        documentIds,
        encryptedFilenames,
        onProgress
      );

      // Step 3: Notify backend that uploads are complete
      const successfulUploads = results.filter(r => r.success);
      console.log(`📢 Notifying backend of ${successfulUploads.length} successful uploads...`);

      if (successfulUploads.length > 0) {
        await axios.post('/api/presigned-urls/complete', {
          documentIds: successfulUploads.map(r => r.documentId)
        });
      }

      // Log summary
      const failed = results.filter(r => !r.success);
      console.log(`✅ Upload complete! ${successfulUploads.length}/${results.length} files uploaded successfully`);
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
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n🚀 Batch ${batchIndex + 1}/${batches.length} (${batch.files.length} files)`);

      // Upload all files in batch concurrently
      const batchResults = await Promise.all(
        batch.files.map((file, idx) =>
          this.uploadSingleFile(
            file,
            batch.urls[idx],
            batch.ids[idx],
            batch.filenames[idx],
            (progress, stage) => {
              if (onProgress) {
                const completedFiles = results.length + idx;
                const overallProgress = (completedFiles / files.length) * 100;
                onProgress(overallProgress, file.name, stage);
              }
            }
          )
        )
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Upload single file directly to Supabase Storage
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

        // Step 2: Upload file DIRECTLY to Supabase (bypasses backend!)
        if (onProgress) onProgress(10, 'Uploading...');
        const startUpload = Date.now();

        const response = await axios.put(presignedUrl, file, {
          headers: {
            'Content-Type': file.type,
            'x-upsert': 'false'
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
