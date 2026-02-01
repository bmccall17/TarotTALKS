import { NextResponse } from 'next/server';
import {
  getDiscoveredMentions,
  createFromMention,
  mentionExistsByAtUri,
  resolveSharedUrl,
} from '@/lib/db/queries/admin-social-shares';
import { searchMentions, extractTarotTalksUrl } from '@/lib/services/bluesky';

/**
 * GET /api/admin/mentions
 * List discovered mentions
 */
export async function GET() {
  try {
    const mentions = await getDiscoveredMentions();
    return NextResponse.json({ mentions });
  } catch (error) {
    console.error('Error fetching mentions:', error);
    return NextResponse.json({ error: 'Failed to fetch mentions' }, { status: 500 });
  }
}

/**
 * POST /api/admin/mentions
 * Scan for new mentions on Bluesky
 *
 * Body: { limit?: number }
 */
export async function POST(request: Request) {
  try {
    // Check if Bluesky credentials are configured
    if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_APP_PASSWORD) {
      return NextResponse.json(
        {
          error: 'Bluesky credentials not configured',
          message: 'Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD environment variables to enable mention scanning.',
          newMentions: 0,
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 100;

    // Search Bluesky for mentions
    const mentions = await searchMentions(limit);

    if (mentions.length === 0) {
      return NextResponse.json({
        message: 'No mentions found. This could mean no posts contain "tarottalks.app" or there was an authentication issue.',
        newMentions: 0,
        skipped: 0,
      });
    }

    let newCount = 0;
    let skippedCount = 0;

    for (const mention of mentions) {
      // Skip if we already have this mention
      const exists = await mentionExistsByAtUri(mention.uri);
      if (exists) {
        skippedCount++;
        continue;
      }

      // Try to extract TarotTALKS URL from facets (rich text) or post text
      const sharedUrl = extractTarotTalksUrl(mention.text, mention.facets) || undefined;
      let cardId: string | undefined;
      let talkId: string | undefined;

      if (sharedUrl) {
        const resolved = await resolveSharedUrl(sharedUrl);
        if (resolved.type === 'card') {
          cardId = resolved.cardId;
        } else if (resolved.type === 'talk') {
          talkId = resolved.talkId;
        }
      }

      // Create the mention record
      await createFromMention({
        platform: 'bluesky',
        postUrl: mention.postUrl,
        atUri: mention.uri,
        authorDid: mention.authorDid,
        authorHandle: mention.authorHandle,
        authorDisplayName: mention.authorDisplayName,
        sharedUrl,
        cardId,
        talkId,
        notes: mention.text, // Save the actual post text
        likeCount: mention.likeCount,
        repostCount: mention.repostCount,
        replyCount: mention.replyCount,
        discoveredAt: new Date(),
      });

      newCount++;
    }

    return NextResponse.json({
      message: `Scan complete`,
      newMentions: newCount,
      skipped: skippedCount,
      total: mentions.length,
    });
  } catch (error) {
    console.error('Error scanning mentions:', error);
    return NextResponse.json({ error: 'Failed to scan mentions' }, { status: 500 });
  }
}
