import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { supabase } from './supabaseClient';

const DEFAULT_BUCKET = 'customerstracker';

/**
 * Ensure that the specified Supabase storage bucket exists.
 * If not found, it is automatically created as a public bucket.
 */
export const ensureBucketExists = async (bucketName = DEFAULT_BUCKET) => {
  try {
    const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
    if (!getError && bucket) {
      return true;
    }

    // Try to create the bucket if not found
    const { data: createData, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });

    if (createError) {
      // Bucket might already exist or permission error
      console.warn(`StorageService: createBucket notice for '${bucketName}':`, createError.message);
    }
    return true;
  } catch (err) {
    console.warn(`StorageService: Exception in ensureBucketExists for '${bucketName}':`, err);
    return false;
  }
};

/**
 * Read the file URI into an uploadable format (Buffer or Blob) and Base64 string for fallback.
 */
export const prepareFileBody = async (uri, mimeType = 'image/jpeg') => {
  try {
    // If it's already a base64 data URI
    if (typeof uri === 'string' && uri.startsWith('data:')) {
      const base64Data = uri.split(',')[1] || uri;
      const buffer = Buffer.from(base64Data, 'base64');
      return { uploadBody: buffer, base64Url: uri };
    }

    if (Platform.OS === 'web' || !FileSystem?.readAsStringAsync) {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert blob to base64 for fallback
      const base64Url = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });

      return { uploadBody: blob, base64Url: base64Url || uri };
    } else {
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const buffer = Buffer.from(base64Data, 'base64');
      const base64Url = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;
      return { uploadBody: buffer, base64Url };
    }
  } catch (err) {
    console.error('StorageService: Error in prepareFileBody:', err);
    return { uploadBody: null, base64Url: uri };
  }
};

/**
 * Upload an image/file to Supabase Storage with automatic bucket creation and fallback.
 * Returns { publicUrl, error }
 */
export const uploadImageToStorage = async ({
  uri,
  filePath,
  bucketName = DEFAULT_BUCKET,
  mimeType = 'image/jpeg',
}) => {
  try {
    const { uploadBody, base64Url } = await prepareFileBody(uri, mimeType);

    if (!uploadBody && !base64Url) {
      throw new Error('Unable to read image file data');
    }

    // Try ensuring bucket exists
    await ensureBucketExists(bucketName);

    if (uploadBody) {
      let { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, uploadBody, {
          contentType: mimeType || 'image/jpeg',
          upsert: true,
        });

      // If bucket not found or storage error, try creating the bucket and retry once
      if (error && (
        error.message?.toLowerCase().includes('bucket') ||
        error.message?.toLowerCase().includes('not found') ||
        error.statusCode === '404' ||
        error.status === 404
      )) {
        console.log(`StorageService: Bucket '${bucketName}' not found on upload. Creating automatically...`);
        await supabase.storage.createBucket(bucketName, { public: true });
        
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(filePath, uploadBody, {
            contentType: mimeType || 'image/jpeg',
            upsert: true,
          });
        data = retryResult.data;
        error = retryResult.error;
      }

      if (!error && data) {
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl;
        if (publicUrl) {
          return { publicUrl, isFallback: false, error: null };
        }
      } else if (error) {
        console.warn('StorageService: Supabase Storage upload failed, falling back to base64 data:', error.message);
      }
    }

    // Fallback: If S3 storage is unavailable or disabled, return base64 URL so data is preserved
    if (base64Url) {
      console.log('StorageService: Using fallback base64 URL for image persistence');
      return { publicUrl: base64Url, isFallback: true, error: null };
    }

    throw new Error('Failed to upload image to Supabase Storage');
  } catch (err) {
    console.error('StorageService: uploadImageToStorage error:', err);
    return { publicUrl: null, isFallback: false, error: err };
  }
};

/**
 * Delete an image/file from Supabase Storage given its file path or public URL.
 */
export const deleteImageFromStorage = async (fileUrlOrPath, bucketName = DEFAULT_BUCKET) => {
  try {
    if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string') return true;
    
    // If it's a data: URL (base64 fallback), there's no storage object to delete
    if (fileUrlOrPath.startsWith('data:')) {
      return true;
    }

    // Extract the relative path within the bucket
    let relativePath = fileUrlOrPath;
    if (fileUrlOrPath.includes(`/storage/v1/object/public/${bucketName}/`)) {
      relativePath = fileUrlOrPath.split(`/storage/v1/object/public/${bucketName}/`)[1];
    } else if (fileUrlOrPath.includes(`/${bucketName}/`)) {
      relativePath = fileUrlOrPath.split(`/${bucketName}/`)[1];
    }

    if (relativePath && !relativePath.startsWith('http')) {
      relativePath = decodeURIComponent(relativePath);
      const { error } = await supabase.storage.from(bucketName).remove([relativePath]);
      if (error) {
        console.warn('StorageService: delete notice:', error.message);
      }
    }
    return true;
  } catch (err) {
    console.error('StorageService: deleteImageFromStorage error:', err);
    return false;
  }
};
