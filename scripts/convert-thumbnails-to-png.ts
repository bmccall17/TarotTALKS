#!/usr/bin/env tsx
/**
 * Convert Talk Thumbnails to PNG
 *
 * Satori (used by next/og ImageResponse) cannot decode WebP images.
 * This script creates PNG copies of all WebP thumbnails in the
 * talk-thumbnails bucket so share image generators can reference them.
 *
 * The WebP originals are kept for frontend use. PNG copies live alongside
 * them in the same bucket (e.g., abc123.webp + abc123.png).
 *
 * Usage:
 *   npx dotenv -e .env.local -- tsx scripts/convert-thumbnails-to-png.ts
 *
 * Options:
 *   --dry-run    Preview what would be done without making changes
 *   --limit=N    Process only N thumbnails (for testing)
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ============================================================
// CONFIGURATION
// ============================================================

const THUMBNAILS_BUCKET = 'talk-thumbnails';
const PNG_QUALITY = 90;
const PNG_COMPRESSION = 6;

// ============================================================
// TYPES
// ============================================================

interface ConversionResult {
  filename: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  webpSize?: number;
  pngSize?: number;
}

// ============================================================
// HELPERS
// ============================================================

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('\n============================================================');
  console.log('  WEBP TO PNG CONVERSION');
  console.log('============================================================\n');

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made\n');
  }
  if (limit) {
    console.log(`Limited to ${limit} files\n`);
  }

  // Initialize Supabase client
  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // List all files in the thumbnails bucket
  console.log('Listing files in talk-thumbnails bucket...\n');
  const { data: files, error: listError } = await supabase.storage
    .from(THUMBNAILS_BUCKET)
    .list('', { limit: 500 });

  if (listError) {
    console.error('Failed to list bucket:', listError.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('No files found in bucket.\n');
    process.exit(0);
  }

  // Filter to .webp files only (exclude folders like _archive, _temp)
  const webpFiles = files
    .filter(f => f.name.endsWith('.webp'))
    .map(f => f.name);

  // Check which ones already have a .png counterpart
  const pngFilenames = new Set(
    files.filter(f => f.name.endsWith('.png')).map(f => f.name)
  );

  const toConvert = webpFiles.filter(name => {
    const pngName = name.replace(/\.webp$/, '.png');
    return !pngFilenames.has(pngName);
  });

  console.log(`Found ${webpFiles.length} WebP files total`);
  console.log(`Already have PNG: ${webpFiles.length - toConvert.length}`);
  console.log(`Need conversion: ${toConvert.length}\n`);

  const filesToProcess = limit ? toConvert.slice(0, limit) : toConvert;

  if (filesToProcess.length === 0) {
    console.log('Nothing to convert. All WebP files already have PNG copies.\n');
    process.exit(0);
  }

  console.log(`Processing ${filesToProcess.length} files...\n`);

  // Process each file
  const results: ConversionResult[] = [];
  let processed = 0;

  for (const webpFilename of filesToProcess) {
    processed++;
    const progress = `[${processed}/${filesToProcess.length}]`;
    const pngFilename = webpFilename.replace(/\.webp$/, '.png');

    console.log(`${progress} ${webpFilename}`);

    if (dryRun) {
      results.push({
        filename: webpFilename,
        status: 'success',
        reason: '[DRY RUN] Would convert to PNG',
      });
      console.log(`   -> Would create ${pngFilename}\n`);
      continue;
    }

    try {
      // Download WebP
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(THUMBNAILS_BUCKET)
        .download(webpFilename);

      if (downloadError) {
        throw new Error(`Download failed: ${downloadError.message}`);
      }

      const webpBuffer = Buffer.from(await downloadData.arrayBuffer());
      const webpSize = webpBuffer.byteLength;

      // Convert to PNG
      const pngBuffer = await sharp(webpBuffer)
        .png({ quality: PNG_QUALITY, compressionLevel: PNG_COMPRESSION })
        .toBuffer();

      const pngSize = pngBuffer.byteLength;

      // Upload PNG
      const { error: uploadError } = await supabase.storage
        .from(THUMBNAILS_BUCKET)
        .upload(pngFilename, pngBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      results.push({
        filename: webpFilename,
        status: 'success',
        webpSize,
        pngSize,
      });

      console.log(`   -> ${pngFilename} (${formatBytes(webpSize)} WebP -> ${formatBytes(pngSize)} PNG)\n`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      results.push({
        filename: webpFilename,
        status: 'failed',
        reason,
      });
      console.log(`   FAILED: ${reason}\n`);
    }
  }

  // Summary
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  const totalWebpSize = results
    .filter(r => r.webpSize)
    .reduce((sum, r) => sum + (r.webpSize || 0), 0);
  const totalPngSize = results
    .filter(r => r.pngSize)
    .reduce((sum, r) => sum + (r.pngSize || 0), 0);

  console.log('============================================================');
  console.log('SUMMARY');
  console.log('============================================================');
  console.log(`Converted: ${successful}`);
  console.log(`Failed: ${failed}`);
  if (totalPngSize > 0) {
    console.log(`PNG storage added: ${formatBytes(totalPngSize)}`);
  }
  console.log('============================================================\n');

  if (failed > 0) {
    console.log('FAILED ITEMS:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`   - ${r.filename}: ${r.reason}`));
    console.log('');
  }

  if (dryRun) {
    console.log('This was a DRY RUN. Run without --dry-run to apply changes.\n');
  } else {
    console.log('Done!\n');
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
