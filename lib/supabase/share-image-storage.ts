/**
 * SERVER ONLY - Supabase Storage for Share Images
 *
 * Handles upload/retrieval of pre-generated social share images
 * (OpenGraph, Twitter, Instagram) stored in the `share-images` bucket.
 * NEVER import this file from client components.
 */

import { createServiceClient } from './server';

const BUCKET = 'share-images';

type Category = 'talks' | 'cards' | 'spreads';
type ImageType = 'opengraph' | 'twitter' | 'instagram' | 'instagram-card-only';

/**
 * Build the deterministic path for a share image in the bucket.
 * e.g. "talks/opengraph/brene-brown-the-power-of-vulnerability.png"
 */
export function getShareImagePath(category: Category, type: ImageType, slug: string): string {
  return `${category}/${type}/${slug}.png`;
}

/**
 * Upload a PNG buffer to the share-images bucket at the deterministic path.
 * Returns the public URL on success.
 */
export async function uploadShareImage(
  buffer: Buffer | ArrayBuffer,
  category: Category,
  type: ImageType,
  slug: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createServiceClient();
    const filePath = getShareImagePath(category, type, slug);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const url = getShareImagePublicUrl(category, type, slug);
    return { success: true, url };
  } catch (err) {
    console.error(`[SHARE-IMAGE] Upload failed for ${category}/${type}/${slug}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

/**
 * Construct the public URL for a share image without uploading.
 * Uses the Supabase public storage URL pattern.
 */
export function getShareImagePublicUrl(category: Category, type: ImageType, slug: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const filePath = getShareImagePath(category, type, slug);
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

/**
 * List all share images in a specific category/type folder.
 * Returns an array of slug names (without .png extension).
 */
export async function listShareImages(
  category: Category,
  type: ImageType
): Promise<string[]> {
  try {
    const supabase = createServiceClient();
    const folder = `${category}/${type}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: 1000 });

    if (error) {
      console.error(`[SHARE-IMAGE] List failed for ${folder}:`, error);
      return [];
    }

    return data
      .filter((file) => file.name.endsWith('.png'))
      .map((file) => file.name.replace('.png', ''));
  } catch (err) {
    console.error('[SHARE-IMAGE] List error:', err);
    return [];
  }
}
