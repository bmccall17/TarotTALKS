/**
 * Image Processing Utilities
 *
 * Uses Sharp to upscale and convert images to WebP format.
 * All talk thumbnails are processed to 1280x720 (YouTube maxresdefault equivalent).
 */

import sharp from 'sharp';

// Target dimensions for talk thumbnails (16:9 aspect ratio)
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 720;

// WebP quality settings
const WEBP_QUALITY = 85;
const WEBP_EFFORT = 6; // 0-6, higher = slower but better compression

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'webp';
  originalWidth: number;
  originalHeight: number;
  wasUpscaled: boolean;
}

export interface ProcessImageOptions {
  targetWidth?: number;
  targetHeight?: number;
  quality?: number;
}

/**
 * Process an image: upscale to target dimensions and convert to WebP.
 *
 * - Uses Lanczos3 interpolation for high-quality upscaling
 * - Preserves aspect ratio (fit: 'inside')
 * - Converts to WebP for better compression
 *
 * @param input - Image buffer (ArrayBuffer or Buffer)
 * @param options - Optional processing options
 * @returns Processed image with metadata
 */
export async function processImage(
  input: ArrayBuffer | Buffer,
  options: ProcessImageOptions = {}
): Promise<ProcessedImage> {
  const {
    targetWidth = TARGET_WIDTH,
    targetHeight = TARGET_HEIGHT,
    quality = WEBP_QUALITY,
  } = options;

  // Convert ArrayBuffer to Buffer if needed
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // Get original image metadata
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  // Process the image
  const processed = await sharp(buffer)
    .resize(targetWidth, targetHeight, {
      fit: 'inside', // Preserve aspect ratio, fit within bounds
      withoutEnlargement: false, // Allow upscaling
      kernel: 'lanczos3', // High-quality interpolation
    })
    .webp({
      quality,
      effort: WEBP_EFFORT,
    })
    .toBuffer({ resolveWithObject: true });

  const wasUpscaled = originalWidth < targetWidth || originalHeight < targetHeight;

  console.log(
    `🖼️  Image processed: ${originalWidth}x${originalHeight} → ${processed.info.width}x${processed.info.height}` +
      (wasUpscaled ? ' (upscaled)' : ' (downscaled)')
  );

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    format: 'webp',
    originalWidth,
    originalHeight,
    wasUpscaled,
  };
}

/**
 * Check if Sharp is available and working.
 * Useful for diagnostics.
 */
export async function isSharpAvailable(): Promise<boolean> {
  try {
    // Create a tiny test image
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    return true;
  } catch {
    return false;
  }
}
