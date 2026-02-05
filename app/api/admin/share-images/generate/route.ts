import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { talks, cards, spreads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadShareImage } from '@/lib/supabase/share-image-storage';

type Category = 'talks' | 'cards' | 'spreads';
type ImageType = 'opengraph' | 'twitter' | 'instagram' | 'instagram-card-only';

const BASE_URL = 'https://tarottalks.app';

/**
 * Build the Satori generator URL for a given entity.
 */
function getSatoriUrl(category: Category, slug: string, type: ImageType): string {
  const basePath = `${BASE_URL}/${category}/${slug}`;
  switch (type) {
    case 'opengraph':
      return `${basePath}/opengraph-image`;
    case 'twitter':
      return `${basePath}/twitter-image`;
    case 'instagram':
      return `${basePath}/instagram`;
    case 'instagram-card-only':
      return `${basePath}/instagram?v=card`;
  }
}

/**
 * POST /api/admin/share-images/generate
 * Generate and upload share images for a single entity.
 *
 * Body: { category: 'cards'|'talks'|'spreads', slug: string, types: ImageType[] }
 * Returns: { results: [{ type, success, url?, error? }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, slug, types } = body as {
      category: Category;
      slug: string;
      types: ImageType[];
    };

    if (!category || !slug || !types || !Array.isArray(types) || types.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: category, slug, types[]' },
        { status: 400 }
      );
    }

    const results: { type: ImageType; success: boolean; url?: string; error?: string }[] = [];

    for (const type of types) {
      try {
        const satoriUrl = getSatoriUrl(category, slug, type);
        console.log(`[SHARE-IMAGE] Fetching ${type} for ${category}/${slug} from ${satoriUrl}`);

        const response = await fetch(satoriUrl, {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) {
          throw new Error(`Satori fetch failed: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadResult = await uploadShareImage(buffer, category, type, slug);

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }

        results.push({ type, success: true, url: uploadResult.url });

        // If this is the opengraph type, update the entity's share_image_url in DB
        if (type === 'opengraph' && uploadResult.url) {
          await updateShareImageUrl(category, slug, uploadResult.url);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[SHARE-IMAGE] Failed ${type} for ${category}/${slug}:`, errorMsg);
        results.push({ type, success: false, error: errorMsg });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[SHARE-IMAGE] Generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate share images' },
      { status: 500 }
    );
  }
}

/**
 * Update the share_image_url column for the given entity.
 */
async function updateShareImageUrl(category: Category, slug: string, url: string) {
  try {
    switch (category) {
      case 'talks':
        await db.update(talks).set({ shareImageUrl: url, updatedAt: new Date() }).where(eq(talks.slug, slug));
        break;
      case 'cards':
        await db.update(cards).set({ shareImageUrl: url, updatedAt: new Date() }).where(eq(cards.slug, slug));
        break;
      case 'spreads':
        await db.update(spreads).set({ shareImageUrl: url, updatedAt: new Date() }).where(eq(spreads.shortId, slug));
        break;
    }
    console.log(`[SHARE-IMAGE] Updated share_image_url for ${category}/${slug}`);
  } catch (err) {
    console.error(`[SHARE-IMAGE] Failed to update DB for ${category}/${slug}:`, err);
  }
}
