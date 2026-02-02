import { NextRequest, NextResponse } from 'next/server';
import { getAllApiUsageStats } from '@/lib/db/queries/admin-api-usage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Validate days parameter: min 1, max 90
    const validDays = Math.min(Math.max(1, days), 90);

    const stats = await getAllApiUsageStats(validDays);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching API usage stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API usage stats' },
      { status: 500 }
    );
  }
}
