import { NextRequest, NextResponse } from 'next/server';
import { listShareImages } from '@/lib/supabase/share-image-storage';

type Category = 'cards' | 'talks' | 'spreads';

/**
 * GET /api/admin/share-images/list?category=cards|talks|spreads
 * Lists share images in the Supabase share-images bucket per type folder.
 * Returns slugs that have images for each type.
 */
export async function GET(request: NextRequest) {
  try {
    const category = (request.nextUrl.searchParams.get('category') || 'cards') as Category;

    const [opengraph, twitter, instagram, instagramCardOnly] = await Promise.all([
      listShareImages(category, 'opengraph'),
      listShareImages(category, 'twitter'),
      listShareImages(category, 'instagram'),
      category === 'cards' ? listShareImages(category, 'instagram-card-only') : Promise.resolve([]),
    ]);

    return NextResponse.json({
      opengraph,
      twitter,
      instagram,
      instagramCardOnly,
    });
  } catch (error) {
    console.error('[SHARE-IMAGE] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list share images' },
      { status: 500 }
    );
  }
}
