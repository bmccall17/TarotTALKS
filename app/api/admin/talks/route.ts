import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import {
  getAllTalksForAdmin,
  searchTalksForAdmin,
  createTalk,
  type InsertTalk,
} from '@/lib/db/queries/admin-talks';
import { downloadTalkThumbnail } from '@/lib/utils/download-image';

/**
 * GET /api/admin/talks
 * Query params:
 *   - includeDeleted: boolean (default: false)
 *   - search: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const searchQuery = searchParams.get('search');

    let talks;
    if (searchQuery) {
      talks = await searchTalksForAdmin(searchQuery, includeDeleted);
    } else {
      talks = await getAllTalksForAdmin(includeDeleted);
    }

    return NextResponse.json({ talks });
  } catch (error) {
    console.error('Error fetching talks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch talks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/talks
 * Body: InsertTalk (without slug)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.speakerName) {
      return NextResponse.json(
        { error: 'Title and speaker name are required' },
        { status: 400 }
      );
    }

    // Ensure at least one URL is provided
    if (!body.tedUrl && !body.youtubeUrl) {
      return NextResponse.json(
        { error: 'At least one URL (tedUrl or youtubeUrl) is required' },
        { status: 400 }
      );
    }

    // Download thumbnail if it's an external URL
    if (body.thumbnailUrl && (body.thumbnailUrl.startsWith('http://') || body.thumbnailUrl.startsWith('https://'))) {
      console.log('📥 Downloading thumbnail for new talk...');
      // Create a temporary ID for the filename (will use actual ID after creation)
      const tempId = `temp-${Date.now()}`;
      const localPath = await downloadTalkThumbnail(tempId, body.thumbnailUrl);
      if (localPath) {
        body.thumbnailUrl = localPath;
        console.log('✅ Thumbnail downloaded:', localPath);
      } else {
        console.warn('⚠️  Failed to download thumbnail, keeping external URL');
      }
    }

    const talk = await createTalk(body);

    // If we used a temp ID, rename the file to use the actual talk ID
    if (body.thumbnailUrl && body.thumbnailUrl.includes('temp-')) {
      const fs = require('fs');
      const path = require('path');
      const oldPath = path.join(process.cwd(), 'public', body.thumbnailUrl);
      const extension = body.thumbnailUrl.split('.').pop();
      const newFilename = `${talk.id}.${extension}`;
      const newPath = path.join(process.cwd(), 'public', 'images', 'talks', newFilename);

      try {
        fs.renameSync(oldPath, newPath);
        const newPublicPath = `/images/talks/${newFilename}`;
        // Update the talk with the correct path
        const { updateTalk } = await import('@/lib/db/queries/admin-talks');
        await updateTalk(talk.id, { thumbnailUrl: newPublicPath });
        talk.thumbnailUrl = newPublicPath;
      } catch (err) {
        console.error('Failed to rename thumbnail file:', err);
      }
    }

    revalidateTag('talks', 'max');
    return NextResponse.json({ talk }, { status: 201 });
  } catch (error) {
    console.error('Error creating talk:', error);
    return NextResponse.json(
      { error: 'Failed to create talk' },
      { status: 500 }
    );
  }
}
