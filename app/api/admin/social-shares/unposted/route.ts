import { NextRequest, NextResponse } from 'next/server';
import {
  getUnpostedCards,
  getUnpostedCardsStats,
  type Platform,
} from '@/lib/db/queries/admin-social-shares';

const validPlatforms = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

/**
 * GET /api/admin/social-shares/unposted
 * Query params:
 *   - stats: if "true", returns stats only (no cards list)
 *   - platform: filter by platform (x, bluesky, threads, linkedin, instagram, other)
 *   - limit: max number of cards to return (default: all)
 *
 * Examples:
 *   GET /api/admin/social-shares/unposted?platform=bluesky&limit=3
 *   GET /api/admin/social-shares/unposted?stats=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getUnpostedCardsStats();
      return NextResponse.json({ stats });
    }

    // Get unposted cards with optional filters
    const platformParam = searchParams.get('platform');
    const platform = platformParam && validPlatforms.includes(platformParam)
      ? (platformParam as Platform)
      : undefined;

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const cards = await getUnpostedCards(platform, limit);
    const stats = await getUnpostedCardsStats();

    return NextResponse.json({ cards, stats });
  } catch (error) {
    console.error('Error fetching unposted cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unposted cards' },
      { status: 500 }
    );
  }
}
