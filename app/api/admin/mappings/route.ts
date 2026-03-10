import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  getAllMappingsForAdmin,
  getMappingsByCardId,
  getAllCardsWithMappingCounts,
  getUnmappedTalks,
  upsertMapping,
  getMappingsStats,
} from '@/lib/db/queries/admin-mappings';
import { searchTalksForAdmin } from '@/lib/db/queries/admin-talks';
import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/admin/mappings
 * Query params:
 *   - cardId: Get mappings for a specific card
 *   - cards: Get all cards with mapping counts
 *   - unmapped: Get talks not mapped to any card
 *   - stats: Get mapping statistics
 *   - searchTalks: Search for talks to add
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');
    const getCards = searchParams.get('cards');
    const getUnmapped = searchParams.get('unmapped');
    const getStats = searchParams.get('stats');
    const searchTalks = searchParams.get('searchTalks');

    // Get mapping statistics
    if (getStats === 'true') {
      const stats = await getMappingsStats();
      return NextResponse.json({ stats });
    }

    // Get all cards with mapping counts for sidebar
    if (getCards === 'true') {
      const cards = await getAllCardsWithMappingCounts();
      return NextResponse.json({ cards });
    }

    // Get unmapped talks
    if (getUnmapped === 'true') {
      const talks = await getUnmappedTalks();
      return NextResponse.json({ talks });
    }

    // Search talks for adding to mappings
    if (searchTalks) {
      const talks = await searchTalksForAdmin(searchTalks, false);
      return NextResponse.json({ talks });
    }

    // Get mappings for a specific card
    if (cardId) {
      const mappings = await getMappingsByCardId(cardId);
      return NextResponse.json({ mappings });
    }

    // Default: get all mappings
    const mappings = await getAllMappingsForAdmin();
    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('Error fetching mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/mappings
 * Create or update a mapping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { cardId, talkId, isPrimary, strength, rationaleShort, rationaleLong } = body;

    if (!cardId || !talkId) {
      return NextResponse.json(
        { error: 'cardId and talkId are required' },
        { status: 400 }
      );
    }

    if (strength === undefined || strength < 1 || strength > 5) {
      return NextResponse.json(
        { error: 'strength must be between 1 and 5' },
        { status: 400 }
      );
    }

    if (!rationaleShort?.trim()) {
      return NextResponse.json(
        { error: 'rationaleShort is required' },
        { status: 400 }
      );
    }

    const mapping = await upsertMapping({
      cardId,
      talkId,
      isPrimary: isPrimary ?? false,
      strength,
      rationaleShort: rationaleShort.trim(),
      rationaleLong: rationaleLong?.trim() || null,
    });

    // Revalidate the card detail page to bust the cache
    const cardData = await db
      .select({ slug: cards.slug })
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);

    if (cardData.length > 0) {
      revalidatePath(`/cards/${cardData[0].slug}`);
    }
    revalidateTag('cards', 'max');
    revalidateTag('talks', 'max');

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error('Error creating/updating mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save mapping' },
      { status: 500 }
    );
  }
}
