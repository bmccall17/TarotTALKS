import { NextRequest, NextResponse } from 'next/server';
import { cleanupOrphanedSpreads, previewOrphanedSpreads } from '@/lib/db/queries/admin-spreads';

/**
 * GET /api/admin/spreads/cleanup?daysOld=30
 * Preview what would be deleted
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysOld = parseInt(searchParams.get('daysOld') || '30', 10);

    if (daysOld < 1 || daysOld > 365) {
      return NextResponse.json(
        { error: 'daysOld must be between 1 and 365' },
        { status: 400 }
      );
    }

    const preview = await previewOrphanedSpreads(daysOld);

    return NextResponse.json({ preview });
  } catch (error) {
    console.error('Error previewing cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to preview cleanup' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/spreads/cleanup
 * Body: { daysOld: number }
 * Delete orphaned spreads older than specified days
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const daysOld = body.daysOld || 30;

    if (typeof daysOld !== 'number' || daysOld < 1 || daysOld > 365) {
      return NextResponse.json(
        { error: 'daysOld must be a number between 1 and 365' },
        { status: 400 }
      );
    }

    const deletedCount = await cleanupOrphanedSpreads(daysOld);

    return NextResponse.json({
      success: true,
      deletedCount,
      daysOld,
    });
  } catch (error) {
    console.error('Error cleaning up spreads:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup spreads' },
      { status: 500 }
    );
  }
}
