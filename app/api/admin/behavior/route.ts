import { NextRequest, NextResponse } from 'next/server';
import { getAllBehaviorStats } from '@/lib/db/queries/admin-behavior';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Validate days parameter
    const validDays = Math.min(Math.max(1, days), 90); // Between 1 and 90 days

    const stats = await getAllBehaviorStats(validDays);

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error fetching behavior stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch behavior stats' },
      { status: 500 }
    );
  }
}
