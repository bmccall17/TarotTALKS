/**
 * campaign:ugc - All-in-one UGC campaign pipeline
 *
 * Usage:
 *   npm run campaign:ugc -- --campaign ugc-feb-2026 --platform instagram --limit 10
 *
 * Combines: ingest (from Signal Deck) -> download -> render (--ugc --captions) -> index
 * Single command for the most common workflow.
 * Same idempotency guarantees as individual scripts.
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { socialShares, cards, talks } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { CampaignItem, CampaignManifest, CampaignPlatform } from '@/lib/campaign/types';
import { PLATFORM_RENDER_SPECS } from '@/lib/campaign/types';
import {
  readManifest,
  writeManifest,
  getPostDirectory,
  getCampaignDir,
  ensureDirectory,
  fileExists,
  itemKey,
  log,
  getLiveImageUrl,
} from '@/lib/campaign/utils';

function parseArgs(): {
  campaign: string;
  platform?: CampaignPlatform;
  limit?: number;
} {
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
  return {
    campaign: opts.campaign,
    platform: opts.platform as CampaignPlatform | undefined,
    limit: opts.limit ? parseInt(opts.limit) : undefined,
  };
}

// ── Step 1: Ingest ──────────────────────────────────────────────
async function ingest(campaign: string, platform?: CampaignPlatform, limit?: number): Promise<CampaignManifest> {
  log('📡', 'Step 1/4: Ingesting from Signal Deck...');

  const conditions = [
    sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`,
  ];
  if (platform) conditions.push(eq(socialShares.platform, platform));

  const shares = await db
    .select()
    .from(socialShares)
    .where(and(...conditions))
    .orderBy(desc(socialShares.postedAt))
    .limit(limit || 100);

  const cardIds = shares.filter(s => s.cardId).map(s => s.cardId as string);
  const talkIds = shares.filter(s => s.talkId).map(s => s.talkId as string);

  let cardsMap: Record<string, { name: string; slug: string; imageUrl: string }> = {};
  let talksMap: Record<string, { title: string; slug: string; speakerName: string; thumbnailUrl: string | null }> = {};

  if (cardIds.length > 0) {
    const results = await db
      .select({ id: cards.id, name: cards.name, slug: cards.slug, imageUrl: cards.imageUrl })
      .from(cards)
      .where(sql`${cards.id} IN (${sql.join(cardIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    cardsMap = Object.fromEntries(results.map(c => [c.id, c]));
  }
  if (talkIds.length > 0) {
    const results = await db
      .select({ id: talks.id, title: talks.title, slug: talks.slug, speakerName: talks.speakerName, thumbnailUrl: talks.thumbnailUrl })
      .from(talks)
      .where(sql`${talks.id} IN (${sql.join(talkIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    talksMap = Object.fromEntries(results.map(t => [t.id, t]));
  }

  const newItems: CampaignItem[] = [];
  for (const share of shares) {
    const card = share.cardId ? cardsMap[share.cardId] : null;
    const talk = share.talkId ? talksMap[share.talkId] : null;
    const category = card ? 'cards' : talk ? 'talks' : null;
    const slug = card?.slug || talk?.slug;
    if (!category || !slug) continue;

    const sharePlatform = share.platform as CampaignPlatform;

    newItems.push({
      platform: sharePlatform,
      image_url: getLiveImageUrl(category as 'cards' | 'talks', sharePlatform, slug),
      slug,
      post_id: share.id,
      caption: share.notes || '',
      alt_text: card ? `${card.name} tarot card` : `${talk!.title} by ${talk!.speakerName}`,
      tags: [],
      speaker_handle: share.speakerHandle || undefined,
      talk_url: share.sharedUrl || undefined,
      card_name: card?.name,
      talk_title: talk?.title,
      speaker_name: talk?.speakerName || share.speakerName || undefined,
      category: category as 'cards' | 'talks',
      scheduled_date: share.postedAt?.toISOString().slice(0, 10),
    });
  }

  // Merge with existing manifest (new items overwrite stale data for same key)
  const existing = await readManifest(campaign);
  const newItemsByKey = new Map(newItems.map(i => [itemKey(i), i]));
  const existingKeys = new Set(existing?.items.map(itemKey) || []);
  const unique = newItems.filter(i => !existingKeys.has(itemKey(i)));

  // Update existing items with fresh data (e.g. corrected URLs)
  const updatedExisting = (existing?.items || []).map(item => {
    const fresh = newItemsByKey.get(itemKey(item));
    return fresh || item;
  });

  const manifest: CampaignManifest = {
    campaign_slug: campaign,
    created_at: existing?.created_at || new Date().toISOString(),
    items: [...updatedExisting, ...unique],
    source: 'signal-deck',
  };

  for (const item of unique) {
    await ensureDirectory(getPostDirectory(campaign, item.platform, item));
  }
  await writeManifest(campaign, manifest);

  log('📋', `${manifest.items.length} items in manifest (${unique.length} new)`);
  return manifest;
}

// ── Step 2: Download ────────────────────────────────────────────
async function download(campaign: string, manifest: CampaignManifest): Promise<void> {
  log('⬇️', 'Step 2/4: Downloading source images...');
  let downloaded = 0, skipped = 0, errors = 0;

  for (const item of manifest.items) {
    const dir = getPostDirectory(campaign, item.platform, item);
    const dest = join(dir, 'source.png');

    if (await fileExists(dest)) { skipped++; continue; }
    if (!item.image_url) { errors++; continue; }

    try {
      const res = await fetch(item.image_url, { headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      downloaded++;
    } catch (err) {
      log('⚠️', `Download failed: ${item.slug} - ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  log('📊', `Downloaded: ${downloaded}, Skipped: ${skipped}, Errors: ${errors}`);
}

// ── Step 3: Render (with UGC + Captions) ────────────────────────
async function render(campaign: string, manifest: CampaignManifest): Promise<void> {
  log('🎨', 'Step 3/4: Rendering + UGC styling + AI captions...');

  // Load UGC module
  let applyUgcStyle: ((buf: Buffer, w: number, h: number) => Promise<Buffer>) | null = null;
  try {
    const ugcModule = await import('@/lib/campaign/ugc-style');
    applyUgcStyle = ugcModule.applyUgcStyle;
  } catch { /* UGC module not available */ }

  // Load caption module
  let generateCaptions: ((item: CampaignItem) => Promise<any>) | null = null;
  try {
    const captionModule = await import('@/lib/campaign/caption-generator');
    generateCaptions = captionModule.generateCaptions;
  } catch { /* Caption module not available */ }

  let rendered = 0;

  for (const item of manifest.items) {
    const dir = getPostDirectory(campaign, item.platform, item);
    const sourcePath = join(dir, 'source.png');
    if (!(await fileExists(sourcePath))) continue;

    const specs = PLATFORM_RENDER_SPECS[item.platform] || [];
    const sourceBuffer = await readFile(sourcePath);

    for (const spec of specs) {
      const outPath = join(dir, `${spec.name}.${spec.format}`);

      // Render clean version if missing
      if (!(await fileExists(outPath))) {
        const buf = await sharp(sourceBuffer)
          .resize(spec.width, spec.height, { fit: 'cover', kernel: 'lanczos3' })
          .jpeg({ quality: spec.quality })
          .toBuffer();
        await writeFile(outPath, buf);
        rendered++;
      }

      // UGC variant - runs even if clean render already existed
      if (applyUgcStyle) {
        const ugcPath = join(dir, `ugc_${spec.name}.${spec.format}`);
        if (!(await fileExists(ugcPath))) {
          const cleanBuf = await readFile(outPath);
          const ugcBuf = await applyUgcStyle(cleanBuf, spec.width, spec.height);
          await writeFile(ugcPath, ugcBuf);
        }
      }
    }

    // Write caption.txt
    if (item.caption && !(await fileExists(join(dir, 'caption.txt')))) {
      await writeFile(join(dir, 'caption.txt'), item.caption, 'utf-8');
    }

    // AI captions
    if (generateCaptions && !(await fileExists(join(dir, 'caption_short.txt')))) {
      try {
        const captionSet = await generateCaptions(item);
        if (captionSet) {
          await writeFile(join(dir, 'caption_short.txt'), captionSet.short, 'utf-8');
          await writeFile(join(dir, 'caption_medium.txt'), captionSet.medium, 'utf-8');
          await writeFile(join(dir, 'caption_spicy.txt'), captionSet.spicy, 'utf-8');
          await writeFile(join(dir, 'hashtags.txt'), captionSet.hashtags.join(' '), 'utf-8');
        }
        await new Promise(r => setTimeout(r, 2000)); // rate limit
      } catch (err) {
        log('⚠️', `Captions failed for ${item.slug}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Metadata
    if (!(await fileExists(join(dir, 'metadata.json')))) {
      await writeFile(join(dir, 'metadata.json'), JSON.stringify({
        slug: item.slug, platform: item.platform, category: item.category,
        card_name: item.card_name, talk_title: item.talk_title,
        speaker_name: item.speaker_name, alt_text: item.alt_text,
        tags: item.tags, scheduled_date: item.scheduled_date,
        rendered_at: new Date().toISOString(),
      }, null, 2), 'utf-8');
    }
  }

  log('📊', `Rendered ${rendered} image variants`);
}

// ── Step 4: Index ───────────────────────────────────────────────
async function index(campaign: string, manifest: CampaignManifest): Promise<void> {
  log('📑', 'Step 4/4: Building index...');

  const campaignDir = getCampaignDir(campaign);
  const byPlatform: Record<string, typeof manifest.items> = {};
  for (const item of manifest.items) {
    if (!byPlatform[item.platform]) byPlatform[item.platform] = [];
    byPlatform[item.platform].push(item);
  }

  const summary: Record<string, any> = {
    campaign_slug: campaign,
    generated_at: new Date().toISOString(),
    total_items: manifest.items.length,
    by_platform: {},
  };

  for (const [platform, items] of Object.entries(byPlatform)) {
    const platformDir = join(campaignDir, platform);
    await ensureDirectory(platformDir);

    const rows = ['date,slug,category,card_name,caption,status'];
    let ready = 0;

    for (const item of items) {
      const dir = getPostDirectory(campaign, item.platform, item);
      const hasSource = await fileExists(join(dir, 'source.png'));
      const specs = PLATFORM_RENDER_SPECS[item.platform as CampaignPlatform] || [];
      let allRendered = true;
      for (const spec of specs) {
        if (!(await fileExists(join(dir, `${spec.name}.${spec.format}`)))) {
          allRendered = false;
          break;
        }
      }
      const status = !hasSource ? 'missing_source' : allRendered ? 'ready' : 'partial';
      if (status === 'ready') ready++;

      const esc = (s: string) => s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
      rows.push(`${item.scheduled_date || ''},${item.slug},${item.category},${esc(item.card_name || '')},${esc(item.caption.slice(0, 80))},${status}`);
    }

    await writeFile(join(platformDir, '_index.csv'), rows.join('\n'), 'utf-8');
    summary.by_platform[platform] = { total: items.length, ready, incomplete: items.length - ready };
    log('📄', `${platform}: ${ready}/${items.length} ready`);
  }

  await writeFile(join(campaignDir, '_summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  log('🚀', `UGC Pipeline: ${opts.campaign}`);
  console.log('');

  const manifest = await ingest(opts.campaign, opts.platform, opts.limit);
  console.log('');

  await download(opts.campaign, manifest);
  console.log('');

  await render(opts.campaign, manifest);
  console.log('');

  await index(opts.campaign, manifest);
  console.log('');

  log('✅', `Campaign "${opts.campaign}" complete!`);
  log('📁', `Output: campaigns/${opts.campaign}/`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
