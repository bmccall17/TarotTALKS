import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { hardDeleteTalk } from '@/lib/db/queries/admin-talks';

/**
 * DELETE /api/admin/talks/[id]/hard-delete
 * Permanently delete a talk and all its mappings (CASCADE)
 * YELLOW FLAG #5: Audit logged in hardDeleteTalk function
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await hardDeleteTalk(id);

    revalidateTag('talks', 'max');
    revalidatePath('/talks');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error hard deleting talk:', error);

    if (error instanceof Error && error.message === 'Talk not found') {
      return NextResponse.json(
        { error: 'Talk not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to hard delete talk' },
      { status: 500 }
    );
  }
}
