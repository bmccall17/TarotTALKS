import { NextRequest, NextResponse } from 'next/server';
import { updateCalendarItem, deleteCalendarItem, getCalendarItem } from '@/lib/db/queries/admin-content-assistant';

/**
 * PUT /api/admin/content-assistant/calendar/[id]
 * Edit an individual calendar item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // If body is being edited, update status to 'edited'
    const updateData: Record<string, unknown> = { ...body };
    if (body.body !== undefined || body.hook !== undefined || body.cta !== undefined) {
      const existing = await getCalendarItem(id);
      if (existing && existing.status === 'generated') {
        updateData.status = 'edited';
      }
    }

    const item = await updateCalendarItem(id, updateData);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error updating calendar item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/content-assistant/calendar/[id]
 * Discard a calendar item
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCalendarItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
