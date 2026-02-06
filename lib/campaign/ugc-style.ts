/**
 * UGC (User-Generated Content) Image Styling
 *
 * Applies subtle treatments to make social images feel organic/authentic
 * rather than "too polished". Uses Sharp for all image processing.
 *
 * Treatments:
 * 1. Slight crop offset (imperfect framing)
 * 2. Grain/noise overlay
 * 3. Subtle warm color shift
 * 4. Semi-transparent watermark
 * 5. Slightly lower compression (not-too-perfect JPEG)
 */

import sharp from 'sharp';

export interface UgcOptions {
  /** Enable grain/noise overlay (default: true) */
  grain?: boolean;
  /** Enable warm color shift (default: true) */
  warmShift?: boolean;
  /** Enable watermark (default: true) */
  watermark?: boolean;
  /** Enable slight crop offset (default: true) */
  cropOffset?: boolean;
  /** Watermark text (default: 'tarottalks.app') */
  watermarkText?: string;
  /** Output JPEG quality (default: 88) */
  quality?: number;
}

const DEFAULT_OPTIONS: Required<UgcOptions> = {
  grain: true,
  warmShift: true,
  watermark: true,
  cropOffset: true,
  watermarkText: 'tarottalks.app',
  quality: 88,
};

/**
 * Generate a noise overlay buffer (random grayscale pixels at low opacity).
 * Creates a raw grayscale buffer that gets composited with low opacity.
 */
async function generateNoiseOverlay(width: number, height: number): Promise<Buffer> {
  const channels = 4; // RGBA
  const pixels = Buffer.alloc(width * height * channels);

  for (let i = 0; i < pixels.length; i += channels) {
    const noise = Math.floor(Math.random() * 256);
    pixels[i] = noise;     // R
    pixels[i + 1] = noise; // G
    pixels[i + 2] = noise; // B
    pixels[i + 3] = 18;    // A (very low opacity ~7%)
  }

  return sharp(pixels, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

/**
 * Generate an SVG watermark overlay.
 */
function generateWatermarkSvg(width: number, height: number, text: string): Buffer {
  const fontSize = Math.max(14, Math.floor(width * 0.018));
  const x = width - 20;
  const y = height - 16;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}"
      fill="white" fill-opacity="0.15" text-anchor="end">${text}</text>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Apply UGC styling to an image buffer.
 *
 * @param inputBuffer - Source image buffer (any format Sharp supports)
 * @param width - Target output width
 * @param height - Target output height
 * @param options - Optional styling toggles
 * @returns Styled image as JPEG buffer
 */
export async function applyUgcStyle(
  inputBuffer: Buffer,
  width: number,
  height: number,
  options?: UgcOptions
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let pipeline = sharp(inputBuffer);

  // 1. Slight crop offset - extract with 3-5px offset before final resize
  if (opts.cropOffset) {
    const metadata = await sharp(inputBuffer).metadata();
    const srcW = metadata.width || width;
    const srcH = metadata.height || height;
    const offsetX = 3 + Math.floor(Math.random() * 3); // 3-5px
    const offsetY = 3 + Math.floor(Math.random() * 3);

    if (srcW > offsetX * 2 + 10 && srcH > offsetY * 2 + 10) {
      pipeline = pipeline.extract({
        left: offsetX,
        top: offsetY,
        width: srcW - offsetX * 2,
        height: srcH - offsetY * 2,
      });
    }
  }

  // Resize to target dimensions
  pipeline = pipeline.resize(width, height, {
    fit: 'cover',
    kernel: 'lanczos3',
  });

  // 3. Subtle warm shift - slight brightness/saturation boost
  if (opts.warmShift) {
    pipeline = pipeline.modulate({
      brightness: 1.02,
      saturation: 1.05,
    });
    // Subtle warm tint via linear adjustment
    pipeline = pipeline.linear(
      [1.02, 1.0, 0.98], // RGB multipliers - slightly warm
      [2, 0, -2]          // RGB offsets
    );
  }

  // Convert to buffer for compositing
  let buffer = await pipeline.toBuffer();

  // 2. Grain/noise overlay
  if (opts.grain) {
    const noiseOverlay = await generateNoiseOverlay(width, height);
    buffer = await sharp(buffer)
      .composite([{ input: noiseOverlay, blend: 'over' }])
      .toBuffer();
  }

  // 4. Watermark
  if (opts.watermark) {
    const watermarkSvg = generateWatermarkSvg(width, height, opts.watermarkText);
    buffer = await sharp(buffer)
      .composite([{ input: watermarkSvg, blend: 'over' }])
      .toBuffer();
  }

  // 5. Final JPEG compression (slightly lower quality for "authentic" feel)
  return sharp(buffer)
    .jpeg({ quality: opts.quality })
    .toBuffer();
}
