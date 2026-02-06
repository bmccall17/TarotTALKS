/**
 * campaign:download - Fetch source images for campaign items
 *
 * Usage: npm run campaign:download -- --campaign feb-2026
 *
 * Reads manifest.json, downloads each item's image_url as source.png.
 * Idempotent: skips already-downloaded files.
 * 3 retries with exponential backoff on failure.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { CampaignItem, DownloadError } from '@/lib/campaign/types';
import {
  readManifest,
  getPostDirectory,
  getCampaignDir,
  ensureDirectory,
  fileExists,
  log,
} from '@/lib/campaign/utils';

function parseArgs(): { campaign: string } {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      opts[args[i].slice(2)] = args[i + 1] || '';
      i++;
    }
  }
  if (!opts.campaign) {
    console.error('❌  Missing --campaign flag');
    process.exit(1);
  }
  return { campaign: opts.campaign };
}

async function downloadWithRetry(
  url: string,
  destPath: string,
  retries: number = 3
): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000;
        log('⏳', `Retry ${attempt}/${retries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(destPath, buffer);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
}

async function main() {
  const { campaign } = parseArgs();
  log('🚀', `Downloading assets for campaign: ${campaign}`);

  const manifest = await readManifest(campaign);
  if (!manifest) {
    console.error('❌  No manifest.json found. Run campaign:ingest first.');
    process.exit(1);
  }

  log('📋', `${manifest.items.length} items in manifest`);

  const errors: DownloadError[] = [];
  let downloaded = 0;
  let skipped = 0;

  for (const item of manifest.items) {
    const dir = getPostDirectory(campaign, item.platform, item);
    await ensureDirectory(dir);
    const destPath = join(dir, 'source.png');

    if (await fileExists(destPath)) {
      skipped++;
      continue;
    }

    if (!item.image_url) {
      log('⚠️', `No image_url for ${item.platform}/${item.slug}, skipping`);
      errors.push({
        slug: item.slug,
        platform: item.platform,
        url: '',
        error: 'No image_url',
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    try {
      log('⬇️', `Downloading ${item.platform}/${item.slug}...`);
      await downloadWithRetry(item.image_url, destPath);
      downloaded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      log('❌', `Failed: ${item.platform}/${item.slug} - ${errorMsg}`);
      errors.push({
        slug: item.slug,
        platform: item.platform,
        url: item.image_url,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Write errors log if any
  if (errors.length > 0) {
    const errorsPath = join(getCampaignDir(campaign), 'download-errors.json');
    await writeFile(errorsPath, JSON.stringify(errors, null, 2), 'utf-8');
    log('⚠️', `${errors.length} errors written to download-errors.json`);
  }

  log('📊', `Downloaded: ${downloaded}, Skipped: ${skipped}, Errors: ${errors.length}`);
  log('✅', 'Download complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
