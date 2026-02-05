#!/usr/bin/env tsx
/**
 * Upscale Existing Thumbnails Migration Script
 *
 * This script:
 * 1. Fetches all talks from the database
 * 2. Downloads each existing thumbnail from Supabase
 * 3. Archives the original to a dated folder (for future cleanup)
 * 4. Processes through the upscaler (1280x720 + WebP)
 * 5. Uploads the new WebP version
 * 6. Updates the database thumbnailUrl
 *
 * Usage:
 *   npx dotenv -e .env.local -- tsx scripts/upscale-existing-thumbnails.ts
 *
 * Options:
 *   --dry-run    Preview what would be done without making changes
 *   --test       Run validation tests only
 *   --limit=N    Process only N thumbnails (for testing)
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ============================================================
// CONFIGURATION
// ============================================================

// Archive as subfolder in same bucket (simpler, no new bucket needed)
const THUMBNAILS_BUCKET = 'talk-thumbnails';
const ARCHIVE_FOLDER = '_archive'; // Prefixed with _ to sort first
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 720;
const WEBP_QUALITY = 85;

// ============================================================
// TYPES
// ============================================================

interface Talk {
  id: string;
  title: string;
  thumbnail_url: string | null;
}

interface MigrationResult {
  talkId: string;
  title: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  originalSize?: number;
  newSize?: number;
  originalDimensions?: string;
  newDimensions?: string;
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

function getArchivePath(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractFilename(url: string): string | null {
  // Handle Supabase URLs: .../storage/v1/object/public/bucket/filename.ext
  const match = url.match(/\/([^/]+\.[a-z]+)$/i);
  return match ? match[1] : null;
}

// ============================================================
// VALIDATION TESTS
// ============================================================

async function runTests(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  console.log('\n🧪 Running validation tests...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Sharp is available
  console.log('Test 1: Sharp library available');
  try {
    await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();
    console.log('  ✅ Sharp is working\n');
    passed++;
  } catch (err) {
    console.log(`  ❌ Sharp failed: ${err}\n`);
    failed++;
  }

  // Test 2: Can list thumbnails bucket
  console.log('Test 2: Thumbnails bucket accessible');
  try {
    const { data, error } = await supabase.storage.from(THUMBNAILS_BUCKET).list('', { limit: 1 });
    if (error) throw error;
    console.log(`  ✅ Found ${data?.length ?? 0} file(s) in bucket\n`);
    passed++;
  } catch (err) {
    console.log(`  ❌ Cannot access thumbnails bucket: ${err}\n`);
    failed++;
  }

  // Test 3: Archive folder writable (uses subfolder in same bucket)
  console.log('Test 3: Archive folder writable');
  try {
    const testFilename = `${ARCHIVE_FOLDER}/_test-${Date.now()}.txt`;
    const testContent = new TextEncoder().encode('test');

    // Try to upload a test file
    const { error: uploadError } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(testFilename, testContent, { upsert: true });

    if (uploadError) throw uploadError;

    // Clean up test file
    await supabase.storage.from(THUMBNAILS_BUCKET).remove([testFilename]);

    console.log(`  ✅ Archive folder writable (${ARCHIVE_FOLDER}/)\n`);
    passed++;
  } catch (err) {
    console.log(`  ❌ Cannot write to archive folder: ${err}\n`);
    failed++;
  }

  // Test 4: Can download a sample image
  console.log('Test 4: Can download from storage');
  try {
    const { data: files } = await supabase.storage.from(THUMBNAILS_BUCKET).list('', { limit: 10 });
    // Find a file (not a folder) to test download
    const imageFile = files?.find(f => f.name.match(/\.(jpg|jpeg|png|webp)$/i));
    if (imageFile) {
      const { data, error } = await supabase.storage.from(THUMBNAILS_BUCKET).download(imageFile.name);
      if (error) throw error;
      const buffer = await data.arrayBuffer();
      console.log(`  ✅ Downloaded ${imageFile.name} (${formatBytes(buffer.byteLength)})\n`);
      passed++;
    } else if (files && files.length > 0) {
      console.log('  ⚠️  No image files found (may all be processed already)\n');
      passed++; // Not a failure, bucket has content but no images at root
    } else {
      console.log('  ⚠️  No files in bucket to test download\n');
      passed++; // Not a failure, just empty
    }
  } catch (err) {
    console.log(`  ❌ Download failed: ${err}\n`);
    failed++;
  }

  // Test 5: Can process an image
  console.log('Test 5: Image processing works');
  try {
    // Create a test image
    const testImage = await sharp({
      create: { width: 640, height: 360, channels: 3, background: { r: 100, g: 150, b: 200 } },
    }).jpeg().toBuffer();

    // Process it
    const processed = await sharp(testImage)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: false,
        kernel: 'lanczos3',
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    console.log(`  ✅ Processed 640x360 → ${processed.info.width}x${processed.info.height} WebP\n`);
    passed++;
  } catch (err) {
    console.log(`  ❌ Image processing failed: ${err}\n`);
    failed++;
  }

  // Test 6: Database connection
  console.log('Test 6: Database connection');
  try {
    const { data, error } = await supabase
      .from('talks')
      .select('id')
      .limit(1);
    if (error) throw error;
    console.log('  ✅ Database connected\n');
    passed++;
  } catch (err) {
    console.log(`  ❌ Database connection failed: ${err}\n`);
    failed++;
  }

  // Summary
  console.log('============================================================');
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  return failed === 0;
}

// ============================================================
// MIGRATION LOGIC
// ============================================================

async function processImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  const processed = await sharp(buffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 6,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    originalWidth,
    originalHeight,
  };
}

async function migrateThumbnail(
  supabase: ReturnType<typeof createClient>,
  talk: Talk,
  archivePath: string,
  dryRun: boolean
): Promise<MigrationResult> {
  const { id, title, thumbnail_url } = talk;

  // Skip if no thumbnail
  if (!thumbnail_url) {
    return { talkId: id, title, status: 'skipped', reason: 'No thumbnail URL' };
  }

  // Skip if already WebP in Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (thumbnail_url.includes(supabaseUrl) && thumbnail_url.endsWith('.webp')) {
    return { talkId: id, title, status: 'skipped', reason: 'Already WebP format' };
  }

  // Determine if this is a Supabase URL or external URL
  const isSupabaseUrl = thumbnail_url.includes(supabaseUrl);
  const filename = extractFilename(thumbnail_url);

  if (isSupabaseUrl && !filename) {
    return { talkId: id, title, status: 'failed', reason: `Cannot parse filename from: ${thumbnail_url}` };
  }

  if (dryRun) {
    return {
      talkId: id,
      title,
      status: 'success',
      reason: `[DRY RUN] Would process ${isSupabaseUrl ? 'Supabase' : 'external'} image`,
    };
  }

  try {
    let originalBuffer: Buffer;
    let originalSize: number;

    if (isSupabaseUrl) {
      // Download from Supabase
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(THUMBNAILS_BUCKET)
        .download(filename!);

      if (downloadError) {
        throw new Error(`Supabase download failed: ${downloadError.message}`);
      }

      originalBuffer = Buffer.from(await downloadData.arrayBuffer());
      originalSize = originalBuffer.byteLength;

      // Archive original from Supabase
      const archiveFilename = `${ARCHIVE_FOLDER}/${archivePath}/${filename}`;
      const { error: archiveError } = await supabase.storage
        .from(THUMBNAILS_BUCKET)
        .upload(archiveFilename, originalBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (archiveError) {
        throw new Error(`Archive failed: ${archiveError.message}`);
      }
    } else {
      // Download from external URL
      const response = await fetch(thumbnail_url);
      if (!response.ok) {
        throw new Error(`External download failed: ${response.status} ${response.statusText}`);
      }

      originalBuffer = Buffer.from(await response.arrayBuffer());
      originalSize = originalBuffer.byteLength;
      // No archiving needed for external URLs - original still exists at source
    }

    // Step 3: Process image
    const processed = await processImage(originalBuffer);

    // Step 4: Upload new WebP (use talk ID for external URLs, existing filename for Supabase)
    const newFilename = isSupabaseUrl
      ? filename!.replace(/\.[^.]+$/, '.webp')
      : `${id}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(newFilename, processed.buffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Step 5: Update database
    const newUrl = `${supabaseUrl}/storage/v1/object/public/${THUMBNAILS_BUCKET}/${newFilename}`;
    const { error: updateError } = await supabase
      .from('talks')
      .update({ thumbnail_url: newUrl, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    // Step 6: Delete old file from Supabase (only if it was a Supabase URL and different filename)
    if (isSupabaseUrl && filename && filename !== newFilename) {
      await supabase.storage.from(THUMBNAILS_BUCKET).remove([filename]);
    }

    return {
      talkId: id,
      title,
      status: 'success',
      originalSize,
      newSize: processed.buffer.byteLength,
      originalDimensions: `${processed.originalWidth}x${processed.originalHeight}`,
      newDimensions: `${processed.width}x${processed.height}`,
      reason: isSupabaseUrl ? undefined : '(from external URL)',
    };
  } catch (err) {
    return {
      talkId: id,
      title,
      status: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const testOnly = args.includes('--test');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('\n============================================================');
  console.log('🖼️  THUMBNAIL UPSCALE MIGRATION');
  console.log('============================================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  if (limit) {
    console.log(`📊 Limited to ${limit} thumbnails\n`);
  }

  // Initialize Supabase client
  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // Run tests
  const testsPass = await runTests(supabase);
  if (!testsPass) {
    console.log('❌ Tests failed. Please fix issues before running migration.\n');
    process.exit(1);
  }

  if (testOnly) {
    console.log('✅ Tests passed. Use without --test to run migration.\n');
    process.exit(0);
  }

  // Fetch all talks with thumbnails
  console.log('📥 Fetching talks from database...\n');
  const { data: talks, error: fetchError } = await supabase
    .from('talks')
    .select('id, title, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch talks:', fetchError.message);
    process.exit(1);
  }

  if (!talks || talks.length === 0) {
    console.log('📭 No talks with thumbnails found.\n');
    process.exit(0);
  }

  const talksToProcess = limit ? talks.slice(0, limit) : talks;
  console.log(`📦 Found ${talks.length} talks with thumbnails`);
  console.log(`🔄 Processing ${talksToProcess.length} thumbnails...\n`);

  // Create archive path
  const archivePath = getArchivePath(new Date());
  console.log(`📁 Archive path: ${THUMBNAILS_BUCKET}/${ARCHIVE_FOLDER}/${archivePath}/\n`);

  // Process each talk
  const results: MigrationResult[] = [];
  let processed = 0;

  for (const talk of talksToProcess) {
    processed++;
    const progress = `[${processed}/${talksToProcess.length}]`;

    console.log(`${progress} Processing: ${talk.title.substring(0, 50)}...`);

    const result = await migrateThumbnail(supabase, talk, archivePath, dryRun);
    results.push(result);

    if (result.status === 'success' && result.originalSize && result.newSize) {
      const savings = ((result.originalSize - result.newSize) / result.originalSize * 100).toFixed(1);
      const note = result.reason ? ` ${result.reason}` : '';
      console.log(
        `   ✅ ${result.originalDimensions} → ${result.newDimensions} | ` +
        `${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (${savings}% smaller)${note}`
      );
    } else if (result.status === 'skipped') {
      console.log(`   ⏭️  Skipped: ${result.reason}`);
    } else if (result.status === 'failed') {
      console.log(`   ❌ Failed: ${result.reason}`);
    } else if (result.status === 'success') {
      console.log(`   ✅ ${result.reason}`);
    }
  }

  // Summary
  const successful = results.filter(r => r.status === 'success').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  const totalOriginalSize = results
    .filter(r => r.originalSize)
    .reduce((sum, r) => sum + (r.originalSize || 0), 0);
  const totalNewSize = results
    .filter(r => r.newSize)
    .reduce((sum, r) => sum + (r.newSize || 0), 0);

  console.log('\n============================================================');
  console.log('📊 MIGRATION SUMMARY');
  console.log('============================================================');
  console.log(`✅ Successfully migrated: ${successful}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  if (totalOriginalSize > 0) {
    const totalSavings = ((totalOriginalSize - totalNewSize) / totalOriginalSize * 100).toFixed(1);
    console.log(`💾 Storage: ${formatBytes(totalOriginalSize)} → ${formatBytes(totalNewSize)} (${totalSavings}% reduction)`);
  }
  console.log(`📁 Archives saved to: ${THUMBNAILS_BUCKET}/${ARCHIVE_FOLDER}/${archivePath}/`);
  console.log('============================================================\n');

  if (failed > 0) {
    console.log('❌ FAILED ITEMS:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`   - ${r.title}: ${r.reason}`));
    console.log('');
  }

  if (dryRun) {
    console.log('🔍 This was a DRY RUN. Run without --dry-run to apply changes.\n');
  } else {
    console.log('✨ Migration complete!\n');
  }
}

main().catch(err => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
