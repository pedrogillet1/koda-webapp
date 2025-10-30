/**
 * FolderUploadService - REDESIGNED FROM SCRATCH
 *
 * CORE CONCEPT:
 * - The uploaded folder structure is ALWAYS preserved
 * - When uploading from Documents page (no category): creates a new Category with the folder name
 * - When uploading from inside a category/subfolder: creates the folder as a subfolder in that location
 * - All immediate files in the folder are added to the created folder
 * - All subfolders become nested subfolders
 * - Files in nested folders are properly mapped to their respective folders
 *
 * EXAMPLE 1 (from Documents page):
 * Upload "koda website/" containing:
 *   - file1.pdf
 *   - file2.doc
 *   - saaa/
 *     - nested.pdf
 *
 * Result:
 * - Category: "koda website" (shows 2 files: file1.pdf, file2.doc)
 * - Subfolder: "saaa" (under koda website, shows 1 file: nested.pdf)
 *
 * EXAMPLE 2 (from inside a category called "Projects"):
 * Upload same "koda website/" folder
 *
 * Result:
 * - Category: "Projects" (unchanged)
 * - Subfolder: "koda website" (under Projects, shows 2 files: file1.pdf, file2.doc)
 * - Subfolder: "saaa" (under koda website, shows 1 file: nested.pdf)
 */

import api from './api';

class FolderUploadService {
  constructor() {
    this.maxConcurrentUploads = 5;
    this.uploadProgress = {
      totalFiles: 0,
      uploadedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
      errors: []
    };
  }

  /**
   * Extract folder structure from uploaded files
   * Returns: { rootFolderName, subfolders[], files[] }
   */
  analyzeFolderStructure(files) {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    console.log(`\n📊 ===== ANALYZING FOLDER STRUCTURE =====`);
    console.log(`Total files: ${files.length}`);

    // Extract root folder name from first file
    const firstPath = files[0].webkitRelativePath;
    const rootFolderName = firstPath.split('/')[0];

    console.log(`Root folder name: "${rootFolderName}"`);
    console.log(`\nSample file paths:`);
    files.slice(0, 5).forEach(f => console.log(`  - ${f.webkitRelativePath}`));

    // Build subfolder structure
    const subfolderSet = new Set();
    const subfolders = [];
    const fileList = [];

    files.forEach(file => {
      const fullPath = file.webkitRelativePath;
      const pathParts = fullPath.split('/');

      // Remove root folder name to get relative path
      // ["koda website", "file.pdf"] → ["file.pdf"]
      // ["koda website", "saaa", "nested.pdf"] → ["saaa", "nested.pdf"]
      const relativeParts = pathParts.slice(1);

      // Add file to file list
      fileList.push({
        file: file,
        fullPath: fullPath,
        relativePath: relativeParts.join('/'),
        fileName: relativeParts[relativeParts.length - 1],
        depth: relativeParts.length - 1, // 0 = direct child of category
        folderPath: relativeParts.length > 1 ? relativeParts.slice(0, -1).join('/') : null
      });

      // Build subfolder structure (if file is nested)
      for (let i = 0; i < relativeParts.length - 1; i++) {
        const folderPath = relativeParts.slice(0, i + 1).join('/');
        const folderName = relativeParts[i];
        const parentPath = i > 0 ? relativeParts.slice(0, i).join('/') : null;

        if (!subfolderSet.has(folderPath)) {
          subfolderSet.add(folderPath);
          subfolders.push({
            name: folderName,
            path: folderPath,
            parentPath: parentPath,
            depth: i // 0 = direct child of category
          });
        }
      }
    });

    // Sort subfolders by depth (parents before children)
    subfolders.sort((a, b) => a.depth - b.depth);

    console.log(`\n📁 Subfolders found: ${subfolders.length}`);
    subfolders.forEach(sf => {
      console.log(`  - "${sf.name}" (path: ${sf.path}, parent: ${sf.parentPath || 'CATEGORY'}, depth: ${sf.depth})`);
    });

    console.log(`\n📄 Files categorized:`);
    const rootFiles = fileList.filter(f => f.depth === 0);
    const nestedFiles = fileList.filter(f => f.depth > 0);
    console.log(`  - Root level (direct in category): ${rootFiles.length} files`);
    console.log(`  - Nested (in subfolders): ${nestedFiles.length} files`);

    return {
      rootFolderName,
      subfolders,
      files: fileList
    };
  }

  /**
   * Create or get category (root folder)
   */
  async ensureCategory(categoryName) {
    console.log(`\n🏷️  ===== ENSURING CATEGORY "${categoryName}" =====`);

    try {
      // Check if category exists (root folders have no parent)
      const response = await api.get('/api/folders');
      const existingCategory = response.data.folders.find(
        f => f.name === categoryName && !f.parentFolderId
      );

      if (existingCategory) {
        console.log(`✅ Category already exists with ID: ${existingCategory.id}`);
        return existingCategory.id;
      }

      // Create new category
      console.log(`📝 Creating new category...`);
      const createResponse = await api.post('/api/folders', {
        name: categoryName,
        emoji: '📁'
      });

      console.log(`✅ Created category with ID: ${createResponse.data.folder.id}`);
      return createResponse.data.folder.id;
    } catch (error) {
      console.error('❌ Error ensuring category:', error);
      throw error;
    }
  }

  /**
   * Create subfolder hierarchy
   * Returns mapping of folderPath → folderId
   */
  async createSubfolders(subfolders, categoryId) {
    console.log(`\n📂 ===== CREATING ${subfolders.length} SUBFOLDERS =====`);
    console.log(`Category ID: ${categoryId}`);

    if (subfolders.length === 0) {
      console.log(`No subfolders to create`);
      return {};
    }

    try {
      const response = await api.post('/api/folders/bulk', {
        folderTree: subfolders,
        defaultEmoji: '📁',
        parentFolderId: categoryId
      });

      console.log(`✅ Created ${response.data.count} subfolders`);
      console.log(`Folder mapping:`, response.data.folderMap);

      return response.data.folderMap;
    } catch (error) {
      console.error('❌ Error creating subfolders:', error);
      throw error;
    }
  }

  /**
   * Map files to their folder IDs
   */
  mapFilesToFolders(files, categoryId, folderMap) {
    console.log(`\n🗺️  ===== MAPPING FILES TO FOLDERS =====`);
    console.log(`Category ID: ${categoryId}`);
    console.log(`Folder map:`, folderMap);

    const fileMapping = files.map(fileInfo => {
      const { file, fileName, folderPath, depth } = fileInfo;

      let folderId;
      if (depth === 0) {
        // File is directly in category (root level)
        folderId = categoryId;
        console.log(`  📄 "${fileName}" → Category (${categoryId})`);
      } else {
        // File is in a subfolder
        folderId = folderMap[folderPath];
        console.log(`  📄 "${fileName}" → Subfolder "${folderPath}" (${folderId})`);
      }

      if (!folderId) {
        console.warn(`  ⚠️  WARNING: No folder ID found for "${fileName}" (path: ${folderPath})`);
      }

      return {
        file,
        fileName,
        folderId,
        relativePath: fileInfo.relativePath
      };
    });

    console.log(`✅ Mapped ${fileMapping.length} files`);
    return fileMapping;
  }

  /**
   * Calculate SHA-256 hash of a file
   */
  async calculateFileHash(file) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Error calculating file hash:', error);
      throw error;
    }
  }

  /**
   * Upload a single file
   */
  async uploadSingleFile(fileObj, onProgress) {
    const { file, fileName, folderId } = fileObj;

    try {
      console.log(`📤 Uploading "${fileName}" to folder ${folderId}...`);

      // Calculate file hash
      const fileHash = await this.calculateFileHash(file);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileHash', fileHash);
      formData.append('filename', fileName);

      if (folderId) {
        formData.append('folderId', folderId);
      }

      const response = await api.post('/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 600000, // 10 minute timeout for large files (up to 500MB)
        onUploadProgress: (progressEvent) => {
          const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(percentComplete);
        }
      });

      console.log(`✅ Uploaded "${fileName}"`);
      return { success: true, fileId: response.data.document?.id, fileName };
    } catch (error) {
      console.error(`❌ Failed to upload "${fileName}":`, error);
      return { success: false, fileName, error: error.message };
    }
  }

  /**
   * Upload files in parallel batches
   */
  async uploadFilesInParallel(fileMapping, onOverallProgress) {
    console.log(`\n📤 ===== UPLOADING ${fileMapping.length} FILES =====`);

    const totalFiles = fileMapping.length;
    let uploadedFiles = 0;

    // Create batches
    const batches = [];
    for (let i = 0; i < fileMapping.length; i += this.maxConcurrentUploads) {
      batches.push(fileMapping.slice(i, i + this.maxConcurrentUploads));
    }

    console.log(`📦 Created ${batches.length} batches (${this.maxConcurrentUploads} files per batch)`);

    this.uploadProgress = {
      totalFiles,
      uploadedFiles: 0,
      currentBatch: 0,
      totalBatches: batches.length,
      errors: []
    };

    const results = [];

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.uploadProgress.currentBatch = batchIndex + 1;

      console.log(`\n🚀 Batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);

      // Upload all files in this batch simultaneously
      const batchPromises = batch.map(async (fileObj) => {
        const result = await this.uploadSingleFile(
          fileObj,
          (progress) => {
            // Individual file progress can be logged here if needed
          }
        );

        uploadedFiles++;
        this.uploadProgress.uploadedFiles = uploadedFiles;

        if (!result.success) {
          this.uploadProgress.errors.push({ fileName: result.fileName, error: result.error });
        }

        // Update overall progress
        const overallPercentage = Math.round((uploadedFiles / totalFiles) * 100);
        onOverallProgress({
          uploaded: uploadedFiles,
          total: totalFiles,
          percentage: overallPercentage,
          currentBatch: batchIndex + 1,
          totalBatches: batches.length
        });

        return result;
      });

      // Wait for all files in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`\n✅ Upload complete: ${successCount}/${totalFiles} succeeded, ${failureCount} failed`);

    return {
      results,
      totalFiles,
      successCount,
      failureCount,
      errors: this.uploadProgress.errors
    };
  }

  /**
   * MAIN METHOD: Upload entire folder with nested structure
   *
   * @param files - FileList from folder upload
   * @param onProgress - Progress callback
   * @param existingCategoryId - If provided, create the folder AS A SUBFOLDER of this category/folder
   */
  async uploadFolder(files, onProgress, existingCategoryId = null) {
    console.log(`\n\n🚀 ===== STARTING FOLDER UPLOAD =====`);
    console.log(`Files to upload: ${files.length}`);
    console.log(`Parent folder ID: ${existingCategoryId || 'NONE (will create new root category)'}`);

    try {
      // Step 1: Analyze folder structure
      onProgress({ stage: 'analyzing', message: 'Analyzing folder structure...' });
      const structure = this.analyzeFolderStructure(files);

      let categoryId;
      let categoryName;

      if (existingCategoryId) {
        // SCENARIO: Uploading INTO an existing category/subfolder
        // Create the uploaded folder as a SUBFOLDER of the existing location
        console.log(`📂 Creating folder "${structure.rootFolderName}" inside existing category: ${existingCategoryId}`);
        onProgress({ stage: 'category', message: `Creating folder "${structure.rootFolderName}"...` });

        try {
          const createResponse = await api.post('/api/folders', {
            name: structure.rootFolderName,
            emoji: '📁',
            parentFolderId: existingCategoryId
          });
          categoryId = createResponse.data.folder.id;
          categoryName = structure.rootFolderName;
          console.log(`✅ Created folder with ID: ${categoryId}`);
        } catch (error) {
          console.error('❌ Error creating folder:', error);
          throw error;
        }
      } else {
        // SCENARIO: Creating NEW category from folder name (root level)
        console.log(`📂 Creating new category from folder name: "${structure.rootFolderName}"`);
        onProgress({ stage: 'category', message: `Setting up category "${structure.rootFolderName}"...` });
        categoryId = await this.ensureCategory(structure.rootFolderName);
        categoryName = structure.rootFolderName;
      }

      // Step 3: Create subfolders
      onProgress({ stage: 'subfolders', message: `Creating ${structure.subfolders.length} subfolders...` });
      const folderMap = await this.createSubfolders(structure.subfolders, categoryId);

      // Step 4: Map files to folders
      onProgress({ stage: 'mapping', message: 'Mapping files to folders...' });
      const fileMapping = this.mapFilesToFolders(structure.files, categoryId, folderMap);

      // Step 5: Upload files in parallel
      onProgress({
        stage: 'uploading',
        message: 'Uploading files...',
        uploaded: 0,
        total: files.length,
        percentage: 0
      });

      const uploadResults = await this.uploadFilesInParallel(fileMapping, (progressData) => {
        onProgress({
          stage: 'uploading',
          message: `Uploading files (${progressData.currentBatch}/${progressData.totalBatches} batches)...`,
          ...progressData
        });
      });

      // Step 6: Complete
      onProgress({
        stage: 'complete',
        message: 'Upload complete!',
        uploaded: uploadResults.totalFiles,
        total: uploadResults.totalFiles,
        percentage: 100,
        successCount: uploadResults.successCount,
        failureCount: uploadResults.failureCount
      });

      console.log(`\n✅ ===== FOLDER UPLOAD COMPLETE =====\n`);

      return {
        ...uploadResults,
        categoryId,
        categoryName
      };
    } catch (error) {
      console.error('\n❌ ===== FOLDER UPLOAD FAILED =====');
      console.error(error);
      onProgress({ stage: 'error', message: error.message });
      throw error;
    }
  }

  /**
   * Reset upload progress
   */
  resetProgress() {
    this.uploadProgress = {
      totalFiles: 0,
      uploadedFiles: 0,
      currentBatch: 0,
      totalBatches: 0,
      errors: []
    };
  }
}

export default new FolderUploadService();
