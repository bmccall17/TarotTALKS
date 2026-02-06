/**
 * Shared Satori Helpers
 *
 * DRY utilities used across OG, Twitter, and Instagram image generators.
 * Extracted from duplicated code in opengraph-image.tsx, twitter-image.tsx,
 * and instagram/route.tsx files.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Load OpenDyslexic fonts from the public/fonts directory.
 * Returns ArrayBuffer data for Satori font registration,
 * or null if loading fails (fallback to system fonts).
 */
export async function loadOpenDyslexicFonts(): Promise<{
  regular: ArrayBuffer;
  bold: ArrayBuffer;
} | null> {
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
 * Build Satori font options from loaded font data.
 * Returns the fonts array for ImageResponse, or empty object for system fallback.
 */
export function buildFontOptions(fonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null) {
  const fontFamily = fonts ? 'OpenDyslexic' : 'system-ui, sans-serif';
  const fontOptions = fonts
    ? {
        fonts: [
          { name: 'OpenDyslexic', data: fonts.regular, weight: 400 as const },
          { name: 'OpenDyslexic', data: fonts.bold, weight: 700 as const },
        ],
      }
    : {};

  return { fontFamily, fontOptions };
}

/**
 * Generate decorative sparkle positions using a seeded PRNG.
 * Produces consistent-looking but varied sparkle patterns.
 */
export function generateSparkles(
  width: number,
  height: number,
  count?: number
): Array<{ x: number; y: number; s: number; o: number }> {
  const sparkles: Array<{ x: number; y: number; s: number; o: number }> = [];
  let seed = Date.now();
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const sparkleCount = count ?? 12 + Math.floor(random() * 4);
  const margin = 25;

  for (let i = 0; i < sparkleCount; i++) {
    sparkles.push({
      x: Math.floor(random() * (width - margin * 2)) + margin,
      y: Math.floor(random() * (height - margin * 2)) + margin,
      s: Math.floor(random() * 3) + 3,
      o: 0.4 + random() * 0.5,
    });
  }

  return sparkles;
}
