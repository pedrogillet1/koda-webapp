/**
 * Supabase Storage Service
 * Provides GCS-compatible interface for Supabase Storage
 */

import { supabase, STORAGE_BUCKET } from '../config/supabase';
import path from 'path';

interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

interface DownloadResult {
  data: Buffer;
  contentType?: string;
}

class SupabaseStorageService {
  private bucketName: string;

  constructor() {
    this.bucketName = STORAGE_BUCKET;
  }

  /**
   * Upload a file to Supabase Storage
   * @param filePath - Path in storage (e.g., "userId/filename")
   * @param buffer - File buffer
   * @param options - Upload options
   */
  async upload(filePath: string, buffer: Buffer, options?: UploadOptions): Promise<void> {
    try {
      console.log(`📤 Uploading to Supabase: ${filePath} (${buffer.length} bytes)`);

      const { error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, buffer, {
          contentType: options?.contentType,
          cacheControl: options?.cacheControl || '3600',
          upsert: options?.upsert || false
        });

      if (error) {
        console.error(`Supabase upload error for ${filePath}:`, JSON.stringify(error, null, 2));
        throw new Error(`Supabase upload error: ${error.message || JSON.stringify(error)}`);
      }

      console.log(`✅ Uploaded to Supabase: ${filePath} (${buffer.length} bytes)`);
    } catch (error: any) {
      console.error(`Error uploading to Supabase (${filePath}):`, error);
      throw error;
    }
  }

  /**
   * Download a file from Supabase Storage
   * @param filePath - Path in storage
   */
  async download(filePath: string): Promise<DownloadResult> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        console.error(`Supabase download error for ${filePath}:`, JSON.stringify(error, null, 2));
        throw new Error(`Supabase download error: ${error.message || JSON.stringify(error)}`);
      }

      if (!data) {
        throw new Error(`No data returned from Supabase for ${filePath}`);
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`✅ Downloaded from Supabase: ${filePath} (${buffer.length} bytes)`);

      return {
        data: buffer,
        contentType: data.type
      };
    } catch (error: any) {
      console.error(`Error downloading from Supabase (${filePath}):`, error);
      throw error;
    }
  }

  /**
   * Delete a file from Supabase Storage
   * @param filePath - Path in storage
   */
  async delete(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new Error(`Supabase delete error: ${error.message}`);
      }

      console.log(`🗑️ Deleted from Supabase: ${filePath}`);
    } catch (error: any) {
      console.error('Error deleting from Supabase:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in Supabase Storage
   * @param filePath - Path in storage
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(path.dirname(filePath), {
          search: path.basename(filePath)
        });

      if (error) {
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get a signed URL for temporary access to a file
   * @param filePath - Path in storage
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error || !data) {
        throw new Error(`Supabase signed URL error: ${error?.message}`);
      }

      return data.signedUrl;
    } catch (error: any) {
      console.error('Error getting signed URL from Supabase:', error);
      throw error;
    }
  }

  /**
   * Get public URL for a file (works only for public buckets)
   * @param filePath - Path in storage
   */
  getPublicUrl(filePath: string): string {
    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * List files in a directory
   * @param prefix - Directory path prefix
   */
  async list(prefix: string = ''): Promise<any[]> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(prefix);

      if (error) {
        throw new Error(`Supabase list error: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error listing files from Supabase:', error);
      throw error;
    }
  }

  /**
   * Move/rename a file
   * @param fromPath - Current path
   * @param toPath - New path
   */
  async move(fromPath: string, toPath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .move(fromPath, toPath);

      if (error) {
        throw new Error(`Supabase move error: ${error.message}`);
      }

      console.log(`📦 Moved in Supabase: ${fromPath} → ${toPath}`);
    } catch (error: any) {
      console.error('Error moving file in Supabase:', error);
      throw error;
    }
  }

  /**
   * Copy a file
   * @param fromPath - Source path
   * @param toPath - Destination path
   */
  async copy(fromPath: string, toPath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .copy(fromPath, toPath);

      if (error) {
        throw new Error(`Supabase copy error: ${error.message}`);
      }

      console.log(`📋 Copied in Supabase: ${fromPath} → ${toPath}`);
    } catch (error: any) {
      console.error('Error copying file in Supabase:', error);
      throw error;
    }
  }
}

export default new SupabaseStorageService();
