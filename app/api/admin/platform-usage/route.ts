import { NextResponse } from 'next/server';
import { getAllPlatformUsage } from '@/lib/db/queries/admin-platform-usage';

export const maxDuration = 30;

export async function GET() {
  try {
    const data = await getAllPlatformUsage();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error fetching platform usage:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch platform usage',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
