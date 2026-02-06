/**
 * campaign:render - Resize source images to platform specs and generate metadata
 *
 * Usage:
 *   npm run campaign:render -- --campaign feb-2026
 *   npm run campaign:render -- --campaign feb-2026 --platform instagram
 *   npm run campaign:render -- --campaign feb-2026 --ugc
 *   npm run campaign:render -- --campaign feb-2026 --captions
 *
 * Reads manifest, loads source images, resizes to platform specs with Sharp.
 * Writes caption.txt and metadata.json per post.
 * --ugc: produces UGC-styled variants (Phase 3)
 * --captions: generates Gemini caption variants (Phase 4)
 * Idempotent: skips existing renders.
 */

import sharp from 'sharp';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { CampaignPlatform, RenderSpec } from '@/lib/campaign/types';
import { PLATFORM_RENDER_SPECS } from '@/lib/campaign/types';
import {
  readManifest,
  getPostDirectory,
  ensureDirectory,
  fileExists,
  log,
} from '@/lib/campaign/utils';

function parseArgs(): {
  campaign: string;
  platform?: CampaignPlatform;
  ugc: boolean;
  captions: boolean;
} {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  let ugc = false;
  let captions = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ugc') {
      ugc = true;
    } else if (args[i] === '--captions') {
      captions = true;
    } else if (args[i].startsWith('--')) {
      opts[args[i].slice(2)] = args[i + 1] || '';
      i++;
    }
  }

  if (!opts.campaign) {
    console.error('❌  Missing --campaign flag');
    process.exit(1);
  }

  return {
    campaign: opts.campaign,
    platform: opts.platform as CampaignPlatform | undefined,
    ugc,
    captions,
  };
}

async function renderImage(
  sourceBuffer: Buffer,
  spec: RenderSpec
): Promise<Buffer> {
  let pipeline = sharp(sourceBuffer)
    .resize(spec.width, spec.height, {
      fit: 'cover',
      kernel: 'lanczos3',
    });

  if (spec.format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: spec.quality });
  } else {
    pipeline = pipeline.png();
  }

  return pipeline.toBuffer();
}

async function main() {
  const opts = parseArgs();
  log('🚀', `Rendering campaign: ${opts.campaign}`);

  const manifest = await readManifest(opts.campaign);
  if (!manifest) {
    console.error('❌  No manifest.json found. Run campaign:ingest first.');
    process.exit(1);
  }

  // Filter by platform if specified
  const items = opts.platform
    ? manifest.items.filter(i => i.platform === opts.platform)
    : manifest.items;

  log('📋', `${items.length} items to render${opts.platform ? ` (platform: ${opts.platform})` : ''}`);

  let rendered = 0;
  let skipped = 0;
  let errors = 0;

  // Optionally load UGC styling module
  let applyUgcStyle: ((buf: Buffer, w: number, h: number) => Promise<Buffer>) | null = null;
  if (opts.ugc) {
    try {
      const ugcModule = await import('@/lib/campaign/ugc-style');
      applyUgcStyle = ugcModule.applyUgcStyle;
      log('🎨', 'UGC styling enabled');
    } catch {
      log('⚠️', 'UGC module not found - skipping UGC variants');
    }
  }

  // Optionally load caption generator
  let generateCaptions: ((item: any) => Promise<any>) | null = null;
  if (opts.captions) {
    try {
      const captionModule = await import('@/lib/campaign/caption-generator');
      generateCaptions = captionModule.generateCaptions;
      log('✍️', 'Caption generation enabled');
    } catch {
      log('⚠️', 'Caption module not found - skipping caption generation');
    }
  }

  for (const item of items) {
    const dir = getPostDirectory(opts.campaign, item.platform, item);
    await ensureDirectory(dir);

    const sourcePath = join(dir, 'source.png');
    if (!(await fileExists(sourcePath))) {
      log('⚠️', `No source.png for ${item.platform}/${item.slug}, skipping`);
      errors++;
      continue;
    }

    const specs = PLATFORM_RENDER_SPECS[item.platform] || [];
    const sourceBuffer = await readFile(sourcePath);
    let itemRendered = false;

    for (const spec of specs) {
      const outName = `${spec.name}.${spec.format}`;
      const outPath = join(dir, outName);

      // Render clean version if it doesn't exist yet
      if (await fileExists(outPath)) {
        skipped++;
      } else {
        try {
          const renderedBuffer = await renderImage(sourceBuffer, spec);
          await writeFile(outPath, renderedBuffer);
          itemRendered = true;
          rendered++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          log('❌', `Render failed for ${item.slug}/${outName}: ${msg}`);
          errors++;
          continue;
        }
      }

      // UGC variant - runs even if clean render already existed
      if (applyUgcStyle) {
        const ugcPath = join(dir, `ugc_${spec.name}.${spec.format}`);
        if (!(await fileExists(ugcPath))) {
          try {
            const cleanBuffer = await readFile(outPath);
            const ugcBuffer = await applyUgcStyle(cleanBuffer, spec.width, spec.height);
            await writeFile(ugcPath, ugcBuffer);
            log('🎨', `UGC variant: ${item.slug}/${spec.name}`);
          } catch (err) {
            log('⚠️', `UGC failed for ${item.slug}/${spec.name}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }

    // Write caption.txt (from manifest data)
    const captionPath = join(dir, 'caption.txt');
    if (!(await fileExists(captionPath)) && item.caption) {
      await writeFile(captionPath, item.caption, 'utf-8');
    }

    // Generate AI captions if enabled
    if (generateCaptions && itemRendered) {
      try {
        const captionSet = await generateCaptions(item);
        if (captionSet) {
          await writeFile(join(dir, 'caption_short.txt'), captionSet.short, 'utf-8');
          await writeFile(join(dir, 'caption_medium.txt'), captionSet.medium, 'utf-8');
          await writeFile(join(dir, 'caption_spicy.txt'), captionSet.spicy, 'utf-8');
          await writeFile(join(dir, 'hashtags.txt'), captionSet.hashtags.join(' '), 'utf-8');
        }
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        log('⚠️', `Caption generation failed for ${item.slug}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Write metadata.json
    const metadataPath = join(dir, 'metadata.json');
    if (!(await fileExists(metadataPath))) {
      await writeFile(metadataPath, JSON.stringify({
        slug: item.slug,
        platform: item.platform,
        category: item.category,
        card_name: item.card_name,
        talk_title: item.talk_title,
        speaker_name: item.speaker_name,
        alt_text: item.alt_text,
        tags: item.tags,
        scheduled_date: item.scheduled_date,
        rendered_at: new Date().toISOString(),
      }, null, 2), 'utf-8');
    }
  }

  log('📊', `Rendered: ${rendered}, Skipped: ${skipped}, Errors: ${errors}`);
  log('✅', 'Render complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
