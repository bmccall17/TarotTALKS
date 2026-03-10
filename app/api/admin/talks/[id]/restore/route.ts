import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { restoreTalk } from '@/lib/db/queries/admin-talks';

/**
 * POST /api/admin/talks/[id]/restore
 * Restore a soft-deleted talk
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const talk = await restoreTalk(id);

    if (!talk) {
      return NextResponse.json(
        { error: 'Talk not found' },
        { status: 404 }
      );
    }

    revalidateTag('talks', 'max');
    if (talk.slug) {
      revalidatePath(`/talks/${talk.slug}`);
    }
    revalidatePath('/talks');
    return NextResponse.json({ talk });
  } catch (error) {
    console.error('Error restoring talk:', error);
    return NextResponse.json(
      { error: 'Failed to restore talk' },
      { status: 500 }
    );
  }
}
