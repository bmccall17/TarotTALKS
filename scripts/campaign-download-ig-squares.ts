/**
 * campaign:download-squares - One-off script to download IG square images
 *
 * Downloads 3 square (1080x1080) images per card into existing campaign directories:
 *   - Card+Talk square: /cards/{slug}/instagram
 *   - Card-only square: /cards/{slug}/instagram?v=card
 *   - Talk square:      /talks/{talkSlug}/instagram
 *
 * Usage:
 *   npm run campaign:download-squares
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { cards, cardTalkMappings, talks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  readManifest,
  getPostDirectory,
  fileExists,
  log,
} from '@/lib/campaign/utils';

const CAMPAIGN = 'all-cards-ig';
const BASE = 'https://tarottalks.app';

async function main() {
  log('🟦', 'Downloading IG square images for all cards...');

  // 1. Read manifest
  const manifest = await readManifest(CAMPAIGN);
  if (!manifest) {
    console.error('❌  No manifest found for campaign:', CAMPAIGN);
    process.exit(1);
  }
  log('📋', `Manifest has ${manifest.items.length} items`);

  // 2. Query primary talk slugs for all cards
  const primaryMappings = await db
    .select({
      cardSlug: cards.slug,
      talkSlug: talks.slug,
    })
    .from(cards)
    .innerJoin(cardTalkMappings, and(
      eq(cardTalkMappings.cardId, cards.id),
      eq(cardTalkMappings.isPrimary, true)
    ))
    .innerJoin(talks, and(
      eq(cardTalkMappings.talkId, talks.id),
      eq(talks.isDeleted, false)
    ));

  const talkSlugMap = new Map(primaryMappings.map(m => [m.cardSlug, m.talkSlug]));
  log('🔗', `Found ${talkSlugMap.size} primary card→talk mappings`);

  // 3. Download square images for each card
  let downloaded = 0, skipped = 0, errors = 0, noTalk = 0;

  for (const item of manifest.items) {
    const dir = getPostDirectory(CAMPAIGN, item.platform, item);
    const talkSlug = talkSlugMap.get(item.slug);

    const squareImages = [
      { file: 'square_1x1.jpg', url: `${BASE}/cards/${item.slug}/instagram` },
      { file: 'square_1x1_card_only.jpg', url: `${BASE}/cards/${item.slug}/instagram?v=card` },
    ];

    if (talkSlug) {
      squareImages.push({ file: 'square_1x1_talk.jpg', url: `${BASE}/talks/${talkSlug}/instagram` });
    } else {
      noTalk++;
    }

    for (const sq of squareImages) {
      const dest = join(dir, sq.file);

      if (await fileExists(dest)) {
        skipped++;
        continue;
      }

      try {
        const res = await fetch(sq.url, { headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const pngBuffer = Buffer.from(await res.arrayBuffer());

        // Convert PNG to JPG via Sharp
        const jpgBuffer = await sharp(pngBuffer)
          .resize(1080, 1080, { fit: 'cover', kernel: 'lanczos3' })
          .jpeg({ quality: 95 })
          .toBuffer();
        await writeFile(dest, jpgBuffer);
        downloaded++;
        log('✅', `${item.slug}/${sq.file}`);
      } catch (err) {
        log('⚠️', `Failed: ${item.slug}/${sq.file} - ${err instanceof Error ? err.message : err}`);
        errors++;
      }
    }
  }

  console.log('');
  log('📊', `Downloaded: ${downloaded}, Skipped: ${skipped}, Errors: ${errors}, No-talk: ${noTalk}`);
  log('✅', 'Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
