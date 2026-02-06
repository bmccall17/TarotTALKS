/**
 * campaign:index - Generate per-platform index CSVs and summary
 *
 * Usage: npm run campaign:index -- --campaign feb-2026
 *
 * Reads manifest + scans post directories for actual files.
 * Writes {platform}/_index.csv and _summary.json.
 */

import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { CampaignSummary } from '@/lib/campaign/types';
import { PLATFORM_RENDER_SPECS } from '@/lib/campaign/types';
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

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main() {
  const { campaign } = parseArgs();
  log('🚀', `Indexing campaign: ${campaign}`);

  const manifest = await readManifest(campaign);
  if (!manifest) {
    console.error('❌  No manifest.json found. Run campaign:ingest first.');
    process.exit(1);
  }

  const campaignDir = getCampaignDir(campaign);
  const summary: CampaignSummary = {
    campaign_slug: campaign,
    generated_at: new Date().toISOString(),
    total_items: manifest.items.length,
    by_platform: {},
  };

  // Group items by platform
  const byPlatform: Record<string, typeof manifest.items> = {};
  for (const item of manifest.items) {
    if (!byPlatform[item.platform]) byPlatform[item.platform] = [];
    byPlatform[item.platform].push(item);
  }

  for (const [platform, items] of Object.entries(byPlatform)) {
    const platformDir = join(campaignDir, platform);
    await ensureDirectory(platformDir);

    const csvHeader = 'date,slug,category,card_name,talk_title,speaker_name,caption,alt_text,tags,source_exists,renders,status';
    const csvRows: string[] = [csvHeader];

    let renderedCount = 0;
    let missingCount = 0;

    for (const item of items) {
      const dir = getPostDirectory(campaign, item.platform, item);
      const hasSource = await fileExists(join(dir, 'source.png'));

      // Check which renders exist
      const specs = PLATFORM_RENDER_SPECS[item.platform as keyof typeof PLATFORM_RENDER_SPECS] || [];
      const existingRenders: string[] = [];
      for (const spec of specs) {
        const renderPath = join(dir, `${spec.name}.${spec.format}`);
        if (await fileExists(renderPath)) {
          existingRenders.push(`${spec.name}.${spec.format}`);
        }
      }

      // Check for UGC variants
      for (const spec of specs) {
        const ugcPath = join(dir, `ugc_${spec.name}.${spec.format}`);
        if (await fileExists(ugcPath)) {
          existingRenders.push(`ugc_${spec.name}.${spec.format}`);
        }
      }

      // Check for captions
      const hasCaptions = await fileExists(join(dir, 'caption_short.txt'));

      const isComplete = hasSource && existingRenders.length >= specs.length;
      if (isComplete) renderedCount++;
      else missingCount++;

      const status = !hasSource ? 'missing_source' : isComplete ? 'ready' : 'partial';

      csvRows.push([
        item.scheduled_date || '',
        item.slug,
        item.category,
        escapeCsv(item.card_name || ''),
        escapeCsv(item.talk_title || ''),
        escapeCsv(item.speaker_name || ''),
        escapeCsv(item.caption.slice(0, 100)),
        escapeCsv(item.alt_text),
        escapeCsv(item.tags.join(',')),
        hasSource ? 'yes' : 'no',
        existingRenders.join(';'),
        status + (hasCaptions ? '+captions' : ''),
      ].join(','));
    }

    // Write platform _index.csv
    const csvPath = join(platformDir, '_index.csv');
    await writeFile(csvPath, csvRows.join('\n'), 'utf-8');
    log('📄', `${platform}/_index.csv (${items.length} entries)`);

    summary.by_platform[platform] = {
      total: items.length,
      rendered: renderedCount,
      missing: missingCount,
    };
  }

  // Write summary
  const summaryPath = join(campaignDir, '_summary.json');
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  log('📊', `Summary: ${manifest.items.length} items across ${Object.keys(byPlatform).length} platforms`);

  for (const [platform, stats] of Object.entries(summary.by_platform)) {
    log('📊', `  ${platform}: ${stats.rendered} ready, ${stats.missing} incomplete`);
  }

  log('✅', 'Index complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
