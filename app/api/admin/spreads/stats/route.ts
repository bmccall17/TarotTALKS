import { NextResponse } from 'next/server';
import { getSpreadStats } from '@/lib/db/queries/admin-spreads';

/**
 * GET /api/admin/spreads/stats
 * Returns spread statistics for the admin dashboard
 */
export async function GET() {
  try {
    const stats = await getSpreadStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching spread stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spread statistics' },
      { status: 500 }
    );
  }
}
