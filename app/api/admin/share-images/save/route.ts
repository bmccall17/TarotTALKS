import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * POST /api/admin/share-images/save
 * Saves a generated share image to the public folder as a fallback
 * Body: { slug: string, type: 'opengraph' | 'twitter' | 'instagram' | 'instagramCardOnly', imageData: string (base64), category?: 'cards' | 'talks' }
 *
 * For cards (default): /public/images/share/[type]/[slug].png
 * For talks: /public/images/share/[type]/talks/[slug].png
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, type, imageData, category = 'cards' } = body;

    if (!slug || !type || !imageData) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, type, imageData' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['opengraph', 'twitter', 'instagram', 'instagramCardOnly'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be opengraph, twitter, instagram, or instagramCardOnly' },
        { status: 400 }
      );
    }

    // Create directory path based on category
    const dir = category === 'talks'
      ? path.join(process.cwd(), 'public', 'images', 'share', type, 'talks')
      : path.join(process.cwd(), 'public', 'images', 'share', type);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Decode base64 and save
    const buffer = Buffer.from(imageData, 'base64');
    const filePath = path.join(dir, `${slug}.png`);
    await writeFile(filePath, buffer);

    const publicPath = category === 'talks'
      ? `/images/share/${type}/talks/${slug}.png`
      : `/images/share/${type}/${slug}.png`;

    console.log(`[SHARE-IMAGE] Saved ${type} image for ${category}/${slug} to ${publicPath}`);

    return NextResponse.json({
      success: true,
      path: publicPath,
    });
  } catch (error) {
    console.error('Error saving share image:', error);
    return NextResponse.json(
      { error: 'Failed to save share image' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/share-images/save
 * Returns list of existing saved share images
 * Query params:
 *   - category: 'cards' | 'talks' (default: 'cards')
 */
export async function GET(request: NextRequest) {
  try {
    const { readdir } = await import('fs/promises');
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'cards';

    const baseDir = path.join(process.cwd(), 'public', 'images', 'share');

    const result: { opengraph: string[]; twitter: string[]; instagram: string[]; instagramCardOnly: string[] } = {
      opengraph: [],
      twitter: [],
      instagram: [],
      instagramCardOnly: [],
    };

    for (const type of ['opengraph', 'twitter', 'instagram', 'instagramCardOnly'] as const) {
      // For talks, look in the talks subdirectory
      const dir = category === 'talks'
        ? path.join(baseDir, type, 'talks')
        : path.join(baseDir, type);

      if (existsSync(dir)) {
        const files = await readdir(dir);
        result[type] = files
          .filter((f) => f.endsWith('.png') && f !== 'talks') // Exclude 'talks' directory entry
          .map((f) => f.replace('.png', ''));
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing share images:', error);
    return NextResponse.json(
      { error: 'Failed to list share images' },
      { status: 500 }
    );
  }
}
