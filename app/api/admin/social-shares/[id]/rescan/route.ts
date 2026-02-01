import { NextResponse } from 'next/server';
import { getShareById, updateShare, resolveSharedUrl } from '@/lib/db/queries/admin-social-shares';
import { getFullPostDataFromUrl, extractTarotTalksUrl } from '@/lib/services/bluesky';

/**
 * POST /api/admin/social-shares/[id]/rescan
 * Rescan a share to refresh all data from the platform:
 * - Metrics (likes, reposts, replies)
 * - Post text (saved as notes)
 * - TarotTALKS URL extraction (sharedUrl, cardId, talkId)
 * - Posted date (from actual post creation time)
 * - Status updated to 'verified'
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const share = await getShareById(id);
    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    if (!share.postUrl) {
      return NextResponse.json(
        { error: 'No post URL to rescan' },
        { status: 400 }
      );
    }

    // Currently only Bluesky is supported for automatic rescanning
    if (share.platform !== 'bluesky') {
      return NextResponse.json(
        { error: 'Automatic rescan only supported for Bluesky. Edit manually for other platforms.' },
        { status: 400 }
      );
    }

    // Get full post data from Bluesky
    console.log('[Rescan] Fetching post data for URL:', share.postUrl);
    const postData = await getFullPostDataFromUrl(share.postUrl);

    if (!postData) {
      console.error('[Rescan] Could not fetch post data from Bluesky');
      return NextResponse.json(
        { error: 'Could not fetch post data from Bluesky. The post may have been deleted.' },
        { status: 404 }
      );
    }

    console.log('[Rescan] Got post data:', {
      text: postData.text.substring(0, 100) + '...',
      authorHandle: postData.authorHandle,
      createdAt: postData.createdAt,
      metrics: { likes: postData.likeCount, reposts: postData.repostCount, replies: postData.replyCount }
    });

    // Extract TarotTALKS URL from facets (rich text) or post text
    const sharedUrl = extractTarotTalksUrl(postData.text, postData.facets) || undefined;
    console.log('[Rescan] Extracted TarotTALKS URL:', sharedUrl || 'NO MATCH');
    let cardId: string | undefined;
    let talkId: string | undefined;

    if (sharedUrl) {
      console.log('[Rescan] Resolving TarotTALKS URL:', sharedUrl);
      const resolved = await resolveSharedUrl(sharedUrl);
      console.log('[Rescan] Resolved to:', resolved);
      if (resolved.type === 'card') {
        cardId = resolved.cardId;
      } else if (resolved.type === 'talk') {
        talkId = resolved.talkId;
      }
    }

    // Build update payload
    const updatePayload: Parameters<typeof updateShare>[1] = {
      // Metrics
      likeCount: postData.likeCount,
      repostCount: postData.repostCount,
      replyCount: postData.replyCount,
      metricsUpdatedAt: new Date(),
      // Post content as notes
      notes: postData.text,
      // Posted date from actual post
      postedAt: new Date(postData.createdAt),
      // Author info
      authorDid: postData.authorDid,
      authorHandle: postData.authorHandle,
      authorDisplayName: postData.authorDisplayName,
      // Update status to verified
      status: 'verified',
    };

    // Add TarotTALKS URL if found
    if (sharedUrl) {
      updatePayload.sharedUrl = sharedUrl;
    }
    if (cardId) {
      updatePayload.cardId = cardId;
    }
    if (talkId) {
      updatePayload.talkId = talkId;
    }

    // Update the share
    console.log('[Rescan] Updating share with payload:', {
      ...updatePayload,
      notes: updatePayload.notes ? updatePayload.notes.substring(0, 50) + '...' : null
    });
    const updated = await updateShare(id, updatePayload);
    console.log('[Rescan] Update complete, share ID:', updated?.id);

    return NextResponse.json({
      share: updated,
      extracted: {
        sharedUrl: sharedUrl || null,
        cardId: cardId || null,
        talkId: talkId || null,
        notes: postData.text,
        postedAt: postData.createdAt,
      },
      metrics: {
        likeCount: postData.likeCount,
        repostCount: postData.repostCount,
        replyCount: postData.replyCount,
      },
      message: 'Share rescanned and verified successfully',
    });
  } catch (error) {
    console.error('Error rescanning share:', error);
    return NextResponse.json({ error: 'Failed to rescan share' }, { status: 500 });
  }
}
