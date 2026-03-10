import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import {
  getTalkByIdForAdmin,
  updateTalk,
  softDeleteTalk,
} from '@/lib/db/queries/admin-talks';
import { downloadTalkThumbnail } from '@/lib/utils/download-image';

/**
 * GET /api/admin/talks/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const talk = await getTalkByIdForAdmin(id);

    if (!talk) {
      return NextResponse.json(
        { error: 'Talk not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ talk });
  } catch (error) {
    console.error('Error fetching talk:', error);
    return NextResponse.json(
      { error: 'Failed to fetch talk' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/talks/[id]
 * Body: Partial<InsertTalk>
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if at least one URL would remain
    if (body.tedUrl === null && body.youtubeUrl === null) {
      return NextResponse.json(
        { error: 'At least one URL (tedUrl or youtubeUrl) must be provided' },
        { status: 400 }
      );
    }

    // Download thumbnail if it's an external URL
    if (body.thumbnailUrl && (body.thumbnailUrl.startsWith('http://') || body.thumbnailUrl.startsWith('https://'))) {
      console.log('📥 Downloading thumbnail for talk update...');
      const localPath = await downloadTalkThumbnail(id, body.thumbnailUrl);
      if (localPath) {
        body.thumbnailUrl = localPath;
        console.log('✅ Thumbnail downloaded:', localPath);
      } else {
        console.warn('⚠️  Failed to download thumbnail, keeping external URL');
      }
    }

    const talk = await updateTalk(id, body);

    if (!talk) {
      return NextResponse.json(
        { error: 'Talk not found' },
        { status: 404 }
      );
    }

    revalidateTag('talks');
    if (talk.slug) {
      revalidatePath(`/talks/${talk.slug}`);
    }
    revalidatePath('/talks');
    return NextResponse.json({ talk });
  } catch (error) {
    console.error('Error updating talk:', error);
    return NextResponse.json(
      { error: 'Failed to update talk' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/talks/[id]
 * Soft delete by default
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const talk = await softDeleteTalk(id);

    if (!talk) {
      return NextResponse.json(
        { error: 'Talk not found' },
        { status: 404 }
      );
    }

    revalidateTag('talks');
    if (talk.slug) {
      revalidatePath(`/talks/${talk.slug}`);
    }
    revalidatePath('/talks');
    return NextResponse.json({ talk });
  } catch (error) {
    console.error('Error deleting talk:', error);
    return NextResponse.json(
      { error: 'Failed to delete talk' },
      { status: 500 }
    );
  }
}
