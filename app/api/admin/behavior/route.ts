import { NextRequest, NextResponse } from 'next/server';
import { getAllBehaviorStats } from '@/lib/db/queries/admin-behavior';

// Allow up to 30s for cold start + DB connection + 4 queries
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const routeStart = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    const validDays = Math.min(Math.max(1, days), 90);

    console.log(`[behavior] START days=${validDays} at ${new Date().toISOString()}`);

    const stats = await getAllBehaviorStats(validDays);

    const elapsed = Date.now() - routeStart;
    console.log(`[behavior] DONE in ${elapsed}ms`);

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
        'X-Timing-Ms': String(elapsed),
        'X-Version': '2026-03-10-v4',
      },
    });
  } catch (error) {
    const elapsed = Date.now() - routeStart;
    console.error(`[behavior] ERROR after ${elapsed}ms:`, error);
    return NextResponse.json(
      {
        error: 'Failed to fetch behavior stats',
        elapsed,
        version: '2026-03-10-v4',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
