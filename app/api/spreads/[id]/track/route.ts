import { NextRequest, NextResponse } from 'next/server';
import { incrementSpreadView, markSpreadAsShared } from '@/lib/db/queries/spreads';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/spreads/[id]/track
 *
 * Track spread interactions (views, shares)
 * Body: { action: 'view' | 'share' }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: shortId } = await context.params;
    const body = await request.json();
    const { action } = body;

    if (!shortId) {
      return NextResponse.json({ error: 'Missing spread ID' }, { status: 400 });
    }

    if (action === 'view') {
      await incrementSpreadView(shortId);
      return NextResponse.json({ success: true, action: 'view' });
    }

    if (action === 'share') {
      await markSpreadAsShared(shortId);
      return NextResponse.json({ success: true, action: 'share' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error tracking spread:', error);
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
  }
}
