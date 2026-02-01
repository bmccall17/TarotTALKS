/**
 * API: Get Spread by Short ID
 *
 * GET /api/spreads/[id]
 *
 * Fetches a spread by its short_id for public spread pages.
 */

import { NextResponse } from 'next/server';
import { getSpreadByShortId } from '@/lib/db/queries/spreads';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid spread ID' },
        { status: 400 }
      );
    }

    const spread = await getSpreadByShortId(id);

    if (!spread) {
      return NextResponse.json(
        { error: 'Spread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ spread }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching spread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spread' },
      { status: 500 }
    );
  }
}
