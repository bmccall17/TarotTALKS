import { NextRequest, NextResponse } from 'next/server';
import { getCalendarItem, updateCalendarItem } from '@/lib/db/queries/admin-content-assistant';
import { createShare } from '@/lib/db/queries/admin-social-shares';

/**
 * POST /api/admin/content-assistant/push-to-deck
 * Push a calendar item to Signal Deck as a draft
 *
 * Body: { itemId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    // Get the calendar item
    const item = await getCalendarItem(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Calendar item not found' }, { status: 404 });
    }

    if (item.status === 'pushed') {
      return NextResponse.json({ error: 'Item already pushed to Signal Deck' }, { status: 400 });
    }

    // Create a draft social share
    const share = await createShare({
      platform: item.platform,
      status: 'draft',
      notes: item.body || '',
      cardId: item.cardId,
      talkId: item.talkId,
      postedAt: new Date(),
    });

    // Update calendar item status
    await updateCalendarItem(item.id, {
      status: 'pushed',
      pushedShareId: share.id,
    });

    return NextResponse.json({
      share,
      message: 'Pushed to Signal Deck as draft',
    });
  } catch (error) {
    console.error('Error pushing to deck:', error);
    return NextResponse.json({ error: 'Failed to push to Signal Deck' }, { status: 500 });
  }
}
