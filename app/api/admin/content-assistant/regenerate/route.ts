import { NextRequest, NextResponse } from 'next/server';
import {
  getBrandConfig,
  getTopPerformingPosts,
  getCalendarItem,
  updateCalendarItem,
} from '@/lib/db/queries/admin-content-assistant';
import { getPlatformStyle, parseStoredPattern } from '@/lib/db/queries/admin-platform-style';
import {
  regenerateSinglePost,
  type VoiceContext,
  type ContentType,
  type Framework,
} from '@/lib/services/content-assistant';
import type { AIStyleInsights, CachedInsight } from '@/lib/services/platform-style-ai';
import type { Platform } from '@/lib/services/platform-style-analyzer';

/**
 * POST /api/admin/content-assistant/regenerate
 * Regenerate a single calendar item
 *
 * Body: { itemId: string, customInstructions?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, customInstructions } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const item = await getCalendarItem(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Calendar item not found' }, { status: 404 });
    }

    const platform = item.platform as Platform;

    // Build voice context
    const [brandConfig, topPerformers] = await Promise.all([
      getBrandConfig(),
      getTopPerformingPosts(platform, 3),
    ]);

    let stylePattern = null;
    let aiInsights: AIStyleInsights | null = null;

    const stored = await getPlatformStyle(platform);
    if (stored) {
      stylePattern = parseStoredPattern(stored);
      if (stored.aiInsightsCache) {
        try {
          const cached = JSON.parse(stored.aiInsightsCache) as CachedInsight;
          aiInsights = cached.insights;
        } catch { /* ignore */ }
      }
    }

    const voice: VoiceContext = {
      brandConfig,
      stylePattern,
      aiInsights,
      topPerformers,
    };

    const result = await regenerateSinglePost(
      platform,
      item.contentType as ContentType,
      (item.frameworkUsed || '3_things') as Framework,
      voice,
      customInstructions,
      item.card?.name,
      item.talk?.title,
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Update the calendar item
    const updated = await updateCalendarItem(itemId, {
      hook: result.hook,
      body: result.body,
      cta: result.cta,
      hashtags: JSON.stringify(result.hashtags),
      status: 'generated',
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error regenerating post:', error);
    return NextResponse.json({ error: 'Failed to regenerate post' }, { status: 500 });
  }
}
