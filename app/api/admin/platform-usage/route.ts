import { NextResponse } from 'next/server';
import { getAllPlatformUsage } from '@/lib/db/queries/admin-platform-usage';

export const maxDuration = 30;

export async function GET() {
  const routeStart = Date.now();

  try {
    console.log(`[platform-usage] START at ${new Date().toISOString()}`);

    const data = await getAllPlatformUsage();

    const elapsed = Date.now() - routeStart;
    console.log(`[platform-usage] DONE in ${elapsed}ms`);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
        'X-Timing-Ms': String(elapsed),
        'X-Version': '2026-03-10-v4',
      },
    });
  } catch (error) {
    const elapsed = Date.now() - routeStart;
    console.error(`[platform-usage] ERROR after ${elapsed}ms:`, error);
    return NextResponse.json(
      {
        error: 'Failed to fetch platform usage',
        detail: error instanceof Error ? error.message : 'Unknown error',
        elapsed,
        version: '2026-03-10-v4',
      },
      { status: 500 }
    );
  }
}
