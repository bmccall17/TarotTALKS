import { NextRequest, NextResponse } from 'next/server';
import {
  getFullPostDataFromUrl,
  extractTarotTalksUrl,
  isBlueskyUrl,
} from '@/lib/services/bluesky';
import { resolveSharedUrl } from '@/lib/db/queries/admin-social-shares';

/**
 * POST /api/admin/social-shares/fetch-post
 * Fetch post data from a Bluesky URL
 *
 * Body: { postUrl: string, platform: "bluesky" }
 *
 * Returns:
 * - text: Full post text
 * - createdAt: ISO timestamp
 * - authorHandle, authorDisplayName
 * - sharedUrl: Extracted TarotTALKS URL (from facets or text)
 * - cardId, talkId, contentName: Resolved content reference
 * - metrics: { likeCount, repostCount, replyCount }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postUrl, platform } = body;

    if (!postUrl) {
      return NextResponse.json(
        { success: false, error: 'Post URL is required' },
        { status: 400 }
      );
    }

    // Currently only Bluesky is supported
    if (platform !== 'bluesky') {
      return NextResponse.json(
        { success: false, error: 'Only Bluesky is supported for auto-fetch' },
        { status: 400 }
      );
    }

    if (!isBlueskyUrl(postUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Bluesky URL format' },
        { status: 400 }
      );
    }

    // Fetch post data from Bluesky
    console.log('[FetchPost] Fetching post data for:', postUrl);
    const postData = await getFullPostDataFromUrl(postUrl);

    if (!postData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not fetch post from Bluesky. The post may have been deleted or is private.',
        },
        { status: 404 }
      );
    }

    console.log('[FetchPost] Got post data, extracting TarotTALKS URL...');
    console.log('[FetchPost] Text:', postData.text.substring(0, 100) + '...');
    console.log('[FetchPost] Facets:', postData.facets?.length || 0);

    // Extract TarotTALKS URL from facets (rich text) or text
    const sharedUrl = extractTarotTalksUrl(postData.text, postData.facets);
    console.log('[FetchPost] Extracted sharedUrl:', sharedUrl);

    // Resolve to card/talk if we found a TarotTALKS URL
    let cardId: string | null = null;
    let talkId: string | null = null;
    let contentName: string | null = null;

    if (sharedUrl) {
      const resolved = await resolveSharedUrl(sharedUrl);
      console.log('[FetchPost] Resolved URL:', resolved);

      if (resolved.type === 'card') {
        cardId = resolved.cardId || null;
        contentName = resolved.name || null;
      } else if (resolved.type === 'talk') {
        talkId = resolved.talkId || null;
        contentName = resolved.name || null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        text: postData.text,
        createdAt: postData.createdAt,
        authorHandle: postData.authorHandle,
        authorDisplayName: postData.authorDisplayName,
        sharedUrl,
        cardId,
        talkId,
        contentName,
        metrics: {
          likeCount: postData.likeCount,
          repostCount: postData.repostCount,
          replyCount: postData.replyCount,
        },
      },
    });
  } catch (error) {
    console.error('[FetchPost] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch post data' },
      { status: 500 }
    );
  }
}
