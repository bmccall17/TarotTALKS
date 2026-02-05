import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { talks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { downloadAndUploadImage } from '@/lib/supabase/storage';
import { isSupabaseStorageUrl } from '@/lib/supabase/server';

/**
 * POST /api/admin/talks/[id]/upscale-thumbnail
 * If the talk's thumbnail is external (YouTube), downloads it,
 * upscales to 1280x720 WebP, and uploads to Supabase Storage.
 * Returns early if thumbnail is already in Supabase.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [talk] = await db
      .select({ id: talks.id, thumbnailUrl: talks.thumbnailUrl, slug: talks.slug })
      .from(talks)
      .where(eq(talks.id, id))
      .limit(1);

    if (!talk) {
      return NextResponse.json({ error: 'Talk not found' }, { status: 404 });
    }

    if (!talk.thumbnailUrl) {
      return NextResponse.json({ error: 'Talk has no thumbnail URL' }, { status: 400 });
    }

    // Already in Supabase — no work needed
    if (isSupabaseStorageUrl(talk.thumbnailUrl)) {
      return NextResponse.json({
        success: true,
        alreadyUpscaled: true,
        thumbnailUrl: talk.thumbnailUrl,
      });
    }

    // Download, upscale, and upload
    const result = await downloadAndUploadImage(talk.thumbnailUrl, talk.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Upscale failed' },
        { status: 500 }
      );
    }

    // Update the talk's thumbnail URL to the new Supabase URL
    await db
      .update(talks)
      .set({ thumbnailUrl: result.url, updatedAt: new Date() })
      .where(eq(talks.id, id));

    return NextResponse.json({
      success: true,
      alreadyUpscaled: false,
      thumbnailUrl: result.url,
    });
  } catch (error) {
    console.error('[UPSCALE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upscale thumbnail' },
      { status: 500 }
    );
  }
}
