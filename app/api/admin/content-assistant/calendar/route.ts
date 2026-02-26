import { NextRequest, NextResponse } from 'next/server';
import { getCalendarItems } from '@/lib/db/queries/admin-content-assistant';
import type { Platform } from '@/lib/services/platform-style-analyzer';

const VALID_PLATFORMS: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

/**
 * GET /api/admin/content-assistant/calendar?week=2026-03-02&platform=bluesky
 * Fetch a week's calendar items
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const platform = searchParams.get('platform') as Platform | null;

    if (!week) {
      return NextResponse.json({ error: 'week parameter is required' }, { status: 400 });
    }

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'Valid platform is required' }, { status: 400 });
    }

    const items = await getCalendarItems(week, platform);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching calendar items:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar items' }, { status: 500 });
  }
}
