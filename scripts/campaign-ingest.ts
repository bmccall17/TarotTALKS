/**
 * campaign:ingest - Build a campaign manifest from various sources
 *
 * Usage:
 *   npm run campaign:ingest -- --source signal-deck --campaign feb-2026 [--platform instagram] [--limit 10]
 *   npm run campaign:ingest -- --source csv --file input.csv --campaign feb-2026
 *   npm run campaign:ingest -- --source json --file input.json --campaign feb-2026
 *
 * Creates /campaigns/{slug}/manifest.json and directory skeleton.
 * Idempotent: merges into existing manifest, skips duplicate slug+platform combos.
 */

import { readFile } from 'fs/promises';
import { db } from '@/lib/db';
import { socialShares, cards, talks } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getShareImagePublicUrl } from '@/lib/supabase/share-image-storage';
import type { CampaignItem, CampaignManifest, CampaignPlatform } from '@/lib/campaign/types';
import {
  parseCsvInput,
  parseJsonInput,
  readManifest,
  writeManifest,
  getPostDirectory,
  ensureDirectory,
  itemKey,
  log,
} from '@/lib/campaign/utils';

function parseArgs(): {
  source: 'signal-deck' | 'csv' | 'json';
  campaign: string;
  platform?: CampaignPlatform;
  limit?: number;
  file?: string;
} {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1] || '';
      i++;
    }
  }

  if (!opts.campaign) {
    console.error('❌  Missing --campaign flag');
    process.exit(1);
  }
  if (!opts.source) {
    console.error('❌  Missing --source flag (signal-deck | csv | json)');
    process.exit(1);
  }

  return {
    source: opts.source as 'signal-deck' | 'csv' | 'json',
    campaign: opts.campaign,
    platform: opts.platform as CampaignPlatform | undefined,
    limit: opts.limit ? parseInt(opts.limit) : undefined,
    file: opts.file,
  };
}

async function ingestFromSignalDeck(
  platform?: CampaignPlatform,
  limit?: number
): Promise<CampaignItem[]> {
  log('📡', 'Querying Signal Deck...');

  const conditions = [
    sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`,
  ];

  if (platform) {
    conditions.push(eq(socialShares.platform, platform));
  }

  const shares = await db
    .select()
    .from(socialShares)
    .where(and(...conditions))
    .orderBy(desc(socialShares.postedAt))
    .limit(limit || 100);

  // Load related cards and talks
  const cardIds = shares.filter(s => s.cardId).map(s => s.cardId as string);
  const talkIds = shares.filter(s => s.talkId).map(s => s.talkId as string);

  let cardsMap: Record<string, { name: string; slug: string; imageUrl: string }> = {};
  let talksMap: Record<string, { title: string; slug: string; speakerName: string; thumbnailUrl: string | null }> = {};

  if (cardIds.length > 0) {
    const cardResults = await db
      .select({ id: cards.id, name: cards.name, slug: cards.slug, imageUrl: cards.imageUrl })
      .from(cards)
      .where(sql`${cards.id} IN (${sql.join(cardIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    cardsMap = Object.fromEntries(cardResults.map(c => [c.id, c]));
  }

  if (talkIds.length > 0) {
    const talkResults = await db
      .select({ id: talks.id, title: talks.title, slug: talks.slug, speakerName: talks.speakerName, thumbnailUrl: talks.thumbnailUrl })
      .from(talks)
      .where(sql`${talks.id} IN (${sql.join(talkIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    talksMap = Object.fromEntries(talkResults.map(t => [t.id, t]));
  }

  const items: CampaignItem[] = [];

  for (const share of shares) {
    const card = share.cardId ? cardsMap[share.cardId] : null;
    const talk = share.talkId ? talksMap[share.talkId] : null;

    // Determine category and slug
    const category = card ? 'cards' : talk ? 'talks' : null;
    const slug = card?.slug || talk?.slug;
    if (!category || !slug) continue;

    // Determine the best image URL from Supabase storage
    const sharePlatform = share.platform as CampaignPlatform;
    let imageType: 'opengraph' | 'twitter' | 'instagram' | 'instagram-feed' = 'opengraph';
    if (sharePlatform === 'instagram') imageType = 'instagram-feed';
    else if (sharePlatform === 'x') imageType = 'twitter';

    const imageUrl = getShareImagePublicUrl(
      category as 'cards' | 'talks',
      imageType,
      slug
    );

    items.push({
      platform: sharePlatform,
      image_url: imageUrl,
      slug,
      post_id: share.id,
      caption: share.notes || '',
      alt_text: card ? `${card.name} tarot card` : talk ? `${talk.title} by ${talk.speakerName}` : '',
      tags: [],
      speaker_handle: share.speakerHandle || undefined,
      talk_url: share.sharedUrl || undefined,
      card_name: card?.name,
      talk_title: talk?.title,
      speaker_name: talk?.speakerName || share.speakerName || undefined,
      category: category as 'cards' | 'talks',
      scheduled_date: share.postedAt ? share.postedAt.toISOString().slice(0, 10) : undefined,
    });
  }

  return items;
}

async function main() {
  const opts = parseArgs();
  log('🚀', `Ingesting campaign: ${opts.campaign} (source: ${opts.source})`);

  let newItems: CampaignItem[] = [];

  switch (opts.source) {
    case 'signal-deck':
      newItems = await ingestFromSignalDeck(opts.platform, opts.limit);
      break;
    case 'csv': {
      if (!opts.file) {
        console.error('❌  --file required for CSV source');
        process.exit(1);
      }
      const csvContent = await readFile(opts.file, 'utf-8');
      newItems = parseCsvInput(csvContent);
      break;
    }
    case 'json': {
      if (!opts.file) {
        console.error('❌  --file required for JSON source');
        process.exit(1);
      }
      const jsonContent = await readFile(opts.file, 'utf-8');
      newItems = parseJsonInput(jsonContent);
      break;
    }
  }

  log('📋', `Found ${newItems.length} items from ${opts.source}`);

  // Load existing manifest for merge
  const existing = await readManifest(opts.campaign);
  const existingKeys = new Set(existing?.items.map(itemKey) || []);

  // Filter out duplicates
  const uniqueNewItems = newItems.filter(item => !existingKeys.has(itemKey(item)));
  log('✨', `${uniqueNewItems.length} new items (${newItems.length - uniqueNewItems.length} duplicates skipped)`);

  // Build manifest
  const manifest: CampaignManifest = {
    campaign_slug: opts.campaign,
    created_at: existing?.created_at || new Date().toISOString(),
    items: [...(existing?.items || []), ...uniqueNewItems],
    source: opts.source,
  };

  // Create directory skeleton for new items
  for (const item of uniqueNewItems) {
    const dir = getPostDirectory(opts.campaign, item.platform, item);
    await ensureDirectory(dir);
  }

  // Write manifest
  await writeManifest(opts.campaign, manifest);
  log('💾', `Manifest written with ${manifest.items.length} total items`);

  // Summary
  const platformCounts: Record<string, number> = {};
  for (const item of manifest.items) {
    platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
  }
  for (const [platform, count] of Object.entries(platformCounts)) {
    log('📊', `  ${platform}: ${count} items`);
  }

  log('✅', 'Ingest complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
