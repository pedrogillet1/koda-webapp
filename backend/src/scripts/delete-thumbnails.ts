/**
 * Delete all thumbnails from Supabase Storage
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseStorageService from '../services/supabaseStorage.service';

async function deleteThumbnails() {
  try {
    console.log('🗑️ Starting thumbnail deletion...');

    // List all files in the thumbnails directory
    const files = await supabaseStorageService.list('');

    console.log(`Found ${files.length} top-level items`);

    // Delete all thumbnail files and folders
    for (const file of files) {
      const path = file.name;

      // If it's a user folder, check for thumbnails subfolder
      if (!path.includes('.')) {
        console.log(`📁 Checking folder: ${path}`);

        // List contents of user folder
        const userFiles = await supabaseStorageService.list(path);

        for (const userFile of userFiles) {
          if (userFile.name === 'thumbnails') {
            const thumbnailsPath = `${path}/thumbnails`;
            console.log(`🗑️ Found thumbnails folder: ${thumbnailsPath}`);

            // List all thumbnails in this folder
            const thumbnails = await supabaseStorageService.list(thumbnailsPath);
            console.log(`  Found ${thumbnails.length} thumbnails to delete`);

            // Delete each thumbnail
            for (const thumbnail of thumbnails) {
              const thumbnailPath = `${thumbnailsPath}/${thumbnail.name}`;
              try {
                await supabaseStorageService.delete(thumbnailPath);
                console.log(`  ✅ Deleted: ${thumbnailPath}`);
              } catch (error: any) {
                console.error(`  ❌ Failed to delete ${thumbnailPath}:`, error.message);
              }
            }
          }
        }
      }
    }

    console.log('✅ Thumbnail deletion complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error deleting thumbnails:', error);
    process.exit(1);
  }
}

deleteThumbnails();
