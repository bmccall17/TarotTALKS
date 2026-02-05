/**
 * SERVER ONLY - Supabase Storage Operations
 *
 * This file handles image upload/download to Supabase Storage.
 * Thumbnails are automatically upscaled to 1280x720 and converted to WebP.
 * NEVER import this file from client components.
 */

import { createServiceClient, getStorageBucket, getPublicStorageUrl } from './server';
import { processImage } from '@/lib/utils/image-processing';
import sharp from 'sharp';

// Allowed content types for image uploads
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/**
 * Validate and normalize a content-type header.
 * Throws if the content type is not an allowed image type.
 */
function validateContentType(contentType: string | null): AllowedContentType {
  if (!contentType) {
    throw new Error('Missing content-type header');
  }

  // Normalize: strip charset and other parameters
  const normalized = contentType.split(';')[0].trim().toLowerCase();

  if (!ALLOWED_CONTENT_TYPES.includes(normalized as AllowedContentType)) {
    throw new Error(
      `Invalid content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`
    );
  }

  return normalized as AllowedContentType;
}

/**
 * Get file extension from content type.
 */
function getExtensionFromContentType(contentType: AllowedContentType): string {
  const map: Record<AllowedContentType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[contentType];
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image buffer to Supabase Storage.
 * Uses upsert to overwrite existing files with the same name.
 */
export async function uploadImageBuffer(
  buffer: ArrayBuffer | Buffer,
  talkId: string,
  contentType: string | null,
  bucket?: string
): Promise<UploadResult> {
  try {
    const validatedType = validateContentType(contentType);
    const ext = getExtensionFromContentType(validatedType);
    const filename = `${talkId}.${ext}`;

    const supabase = createServiceClient();
    const bucketName = bucket || getStorageBucket();

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType: validatedType,
        upsert: true, // Overwrite if exists (idempotent)
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      url: getPublicStorageUrl(filename, bucketName),
    };
  } catch (err) {
    console.error('Upload failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

/**
 * Download an image from a URL, upscale to 1280x720, convert to WebP,
 * and upload it to Supabase Storage.
 * Returns the new Supabase Storage URL on success.
 */
export async function downloadAndUploadImage(
  imageUrl: string,
  talkId: string,
  bucket?: string
): Promise<UploadResult> {
  try {
    console.log(`📥 Fetching image from: ${imageUrl.substring(0, 80)}...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed with status: ${response.status}`);
    }

    const originalContentType = response.headers.get('content-type');
    const originalBuffer = await response.arrayBuffer();
    const originalSize = Math.round(originalBuffer.byteLength / 1024);

    console.log(`📦 Original image: ${originalSize}KB (${originalContentType})`);

    // Try to process the image (upscale + convert to WebP)
    let bufferToUpload: ArrayBuffer | Buffer = originalBuffer;
    let contentTypeToUse: string | null = originalContentType;

    try {
      const processed = await processImage(originalBuffer);
      bufferToUpload = processed.buffer;
      contentTypeToUse = 'image/webp';

      const processedSize = Math.round(processed.buffer.byteLength / 1024);
      console.log(
        `✨ Processed: ${processed.originalWidth}x${processed.originalHeight} → ` +
          `${processed.width}x${processed.height} WebP (${processedSize}KB)`
      );
    } catch (processError) {
      // Fallback: upload original image without processing
      console.warn('⚠️  Image processing failed, uploading original:', processError);
    }

    console.log(`📤 Uploading to Supabase Storage...`);

    const result = await uploadImageBuffer(bufferToUpload, talkId, contentTypeToUse, bucket);

    // Also create a PNG copy for Satori compatibility (share image generators)
    if (result.success && contentTypeToUse === 'image/webp') {
      try {
        const pngBuffer = await sharp(Buffer.isBuffer(bufferToUpload) ? bufferToUpload : Buffer.from(new Uint8Array(bufferToUpload)))
          .png({ quality: 90, compressionLevel: 6 })
          .toBuffer();
        await uploadImageBuffer(pngBuffer, talkId, 'image/png', bucket);
        console.log(`📋 PNG copy created for Satori compatibility`);
      } catch (pngError) {
        console.warn('⚠️  PNG copy creation failed (non-fatal):', pngError);
      }
    }

    return result;
  } catch (err) {
    console.error('Download and upload failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImage(filename: string, bucket?: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const bucketName = bucket || getStorageBucket();

    const { error } = await supabase.storage.from(bucketName).remove([filename]);

    if (error) {
      console.error('Delete failed:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Delete failed:', err);
    return false;
  }
}

/**
 * Check if an image exists in Supabase Storage.
 */
export async function imageExists(filename: string, bucket?: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const bucketName = bucket || getStorageBucket();

    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', { search: filename });

    if (error) {
      return false;
    }

    return data.some((file) => file.name === filename);
  } catch {
    return false;
  }
}

/**
 * List all images in a bucket.
 */
export async function listAllImages(bucket?: string): Promise<string[]> {
  try {
    const supabase = createServiceClient();
    const bucketName = bucket || getStorageBucket();

    const { data, error } = await supabase.storage.from(bucketName).list();

    if (error) {
      console.error('List failed:', error);
      return [];
    }

    return data.map((file) => file.name);
  } catch {
    return [];
  }
}
