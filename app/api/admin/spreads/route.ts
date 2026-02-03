import { NextRequest, NextResponse } from 'next/server';
import { getSpreadsForAdmin, getSpreadsCount } from '@/lib/db/queries/admin-spreads';

/**
 * GET /api/admin/spreads
 * Query params:
 *   - filter: 'all' | 'shared' | 'viewed' | 'orphaned'
 *   - limit: number (default 50)
 *   - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = (searchParams.get('filter') || 'all') as 'all' | 'shared' | 'viewed' | 'orphaned';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [spreads, total] = await Promise.all([
      getSpreadsForAdmin({ filter, limit, offset }),
      getSpreadsCount(filter),
    ]);

    return NextResponse.json({
      spreads,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching spreads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spreads' },
      { status: 500 }
    );
  }
}
