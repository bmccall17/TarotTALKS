/**
 * OG Image Helper Utilities
 *
 * Satori (used by Next.js ImageResponse) cannot fetch cross-origin images
 * directly via <img src={url}>. This utility fetches images and converts
 * them to base64 data URLs that Satori can render.
 */

/**
 * Fetch an image URL and return it as a base64 data URL.
 * Returns null if the fetch fails (allows graceful fallback).
 */
export async function fetchImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      // Add cache headers for better performance
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`[OG Image] Failed to fetch image: ${response.status} ${url}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`[OG Image] Error fetching image:`, error);
    return null;
  }
}

/**
 * Convert a Supabase talk-thumbnail URL from WebP to PNG.
 * Satori (next/og ImageResponse) cannot decode WebP, so share image
 * generators must reference the PNG copy stored alongside the WebP.
 * Non-WebP URLs (YouTube JPEG fallbacks, etc.) pass through unchanged.
 */
export function getThumbnailPngUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('talk-thumbnails/') && url.endsWith('.webp')) {
    return url.replace(/\.webp$/, '.png');
  }
  return url;
}

/**
 * Normalize a thumbnail URL to be absolute.
 * Handles both relative paths and full URLs.
 */
export function normalizeImageUrl(url: string | null | undefined, baseUrl: string = 'https://tarottalks.app'): string | null {
  if (!url) return null;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}
