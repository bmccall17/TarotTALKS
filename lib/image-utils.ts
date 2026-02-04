/**
 * Shared utilities for generating OG/Twitter/Instagram share images
 * Extracted from app/cards/[slug]/opengraph-image.tsx to reduce duplication
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Design constants for consistent styling across all share images
 */
export const IMAGE_STYLES = {
  gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
  brandGray: '#9ca3af',
  brandRed: '#EB0028',
  textWhite: '#ffffff',
  textMuted: '#d1d5db',
  textAccent: '#a5b4fc',
  keywordBg: 'rgba(99, 102, 241, 0.3)',
} as const;

/**
 * Standard image dimensions for different platforms
 */
export const IMAGE_SIZES = {
  opengraph: { width: 1200, height: 630 },
  twitter: { width: 1200, height: 630 },
  instagram: { width: 1080, height: 1080 },
} as const;

/**
 * Sparkle type for decorative elements
 */
export type Sparkle = {
  x: number;
  y: number;
  s: number; // size
  o: number; // opacity
};

/**
 * Font data returned from loadFonts
 */
export type FontData = {
  regular: ArrayBuffer;
  bold: ArrayBuffer;
};

/**
 * Load OpenDyslexic fonts from the public/fonts directory
 * Returns null if fonts cannot be loaded (will fall back to system fonts)
 */
export async function loadFonts(): Promise<FontData | null> {
  try {
    const fontsDir = join(process.cwd(), 'public', 'fonts');
    const [regular, bold] = await Promise.all([
      readFile(join(fontsDir, 'OpenDyslexic-Regular.woff')),
      readFile(join(fontsDir, 'OpenDyslexic-Bold.woff')),
    ]);

    return {
      regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
      bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
    };
  } catch (error) {
    console.error('Failed to load fonts from filesystem:', error);
    return null;
  }
}

/**
 * Generate font configuration for ImageResponse
 * Falls back to system-ui if custom fonts aren't available
 */
export function getFontConfig(fonts: FontData | null): {
  fontFamily: string;
  fontOptions: { fonts?: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700 }> };
} {
  if (fonts) {
    return {
      fontFamily: 'OpenDyslexic',
      fontOptions: {
        fonts: [
          { name: 'OpenDyslexic', data: fonts.regular, weight: 400 as const },
          { name: 'OpenDyslexic', data: fonts.bold, weight: 700 as const },
        ],
      },
    };
  }

  return {
    fontFamily: 'system-ui, sans-serif',
    fontOptions: {},
  };
}

/**
 * Generate decorative sparkle positions within given bounds
 * Uses a seeded random number generator for deterministic output
 *
 * @param bounds - The area to place sparkles within
 * @param seed - Optional seed for deterministic generation (defaults to Date.now())
 * @returns Array of 12-15 sparkle objects
 */
export function generateSparkles(
  bounds: { width: number; height: number; padding: number },
  seed?: number
): Sparkle[] {
  const sparkles: Sparkle[] = [];
  let currentSeed = seed ?? Date.now();

  // Seeded random number generator
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  const sparkleCount = 12 + Math.floor(random() * 4); // 12-15 sparkles
  const { width, height, padding } = bounds;

  for (let i = 0; i < sparkleCount; i++) {
    sparkles.push({
      x: Math.floor(random() * (width - 2 * padding)) + padding,
      y: Math.floor(random() * (height - 2 * padding)) + padding,
      s: Math.floor(random() * 3) + 3, // size: 3-5
      o: 0.4 + random() * 0.5, // opacity: 0.4-0.9
    });
  }

  return sparkles;
}

/**
 * Normalize an image URL to be absolute
 * - URLs starting with http/https are returned as-is
 * - Relative URLs are prefixed with https://tarottalks.app
 * - null/undefined returns null
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `https://tarottalks.app${url.startsWith('/') ? '' : '/'}${url}`;
}
