/**
 * Supabase Storage Configuration
 * Provides a unified interface for file storage operations using Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase configuration not found. Supabase storage will be disabled.');
  console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable Supabase storage.');
}

// Create Supabase client with service role key for admin operations
// Use dummy values if not configured to prevent import errors
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Storage bucket name
export const STORAGE_BUCKET = 'user-files';

/**
 * Initialize storage bucket if it doesn't exist
 */
export async function initializeStorageBucket() {
  // Skip initialization if Supabase is not configured
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKET);

    if (!bucketExists) {
      // Create bucket if it doesn't exist
      const { data, error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: false, // Private bucket - requires authentication
        fileSizeLimit: 52428800, // 50MB limit
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint',
          'text/plain',
          'text/csv',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp'
        ]
      });

      if (error) {
        console.error('Error creating bucket:', error);
      } else {
        console.log('✅ Supabase storage bucket created:', STORAGE_BUCKET);
      }
    } else {
      console.log('✅ Supabase storage bucket already exists:', STORAGE_BUCKET);
    }
  } catch (error) {
    console.error('Error initializing storage bucket:', error);
  }
}

// Initialize bucket on module load
initializeStorageBucket();

export default supabase;
