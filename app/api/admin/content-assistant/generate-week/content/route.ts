import { NextRequest, NextResponse } from 'next/server';
import {
  getBrandConfig,
  getTopPerformingPosts,
  createCalendarItems,
  deleteWeekItems,
} from '@/lib/db/queries/admin-content-assistant';
import { getPlatformStyle, parseStoredPattern } from '@/lib/db/queries/admin-platform-style';
import {
  generateWeekContent,
  type VoiceContext,
  type StrategyItem,
} from '@/lib/services/content-assistant';
import type { AIStyleInsights, CachedInsight } from '@/lib/services/platform-style-ai';
import type { Platform } from '@/lib/services/platform-style-analyzer';

const VALID_PLATFORMS: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

/**
 * POST /api/admin/content-assistant/generate-week/content
 * Step 2: AI writes all 7 post bodies from the strategy
 *
 * Body: { platform, weekStartDate, strategy: StrategyItem[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const platform = body.platform as Platform;
    const weekStartDate = body.weekStartDate as string;
    const strategy = body.strategy as StrategyItem[];

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'Valid platform is required' }, { status: 400 });
    }

    if (!weekStartDate) {
      return NextResponse.json({ error: 'weekStartDate is required' }, { status: 400 });
    }

    if (!strategy || !Array.isArray(strategy) || strategy.length === 0) {
      return NextResponse.json({ error: 'Strategy array is required' }, { status: 400 });
    }

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

    const result = await generateWeekContent(platform, strategy, voice);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Generate batch ID
    const batchId = `cl_${Date.now().toString(36)}`;
    const totalCost = result.costUsd;

    // Delete existing non-pushed items for this week/platform
    await deleteWeekItems(weekStartDate, platform);

    // Save to database
    const calendarItems = result.posts.map(post => ({
      weekStartDate,
      dayOfWeek: post.dayOfWeek,
      contentType: post.contentType,
      platform: platform as 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other',
      hook: post.hook,
      body: post.body,
      cta: post.cta,
      hashtags: JSON.stringify(post.hashtags),
      cardId: post.cardId || null,
      talkId: post.talkId || null,
      status: 'generated',
      frameworkUsed: post.framework,
      aiGenerationCost: totalCost / result.posts.length,
      generationBatchId: batchId,
    }));

    const saved = await createCalendarItems(calendarItems);

    return NextResponse.json({
      items: saved,
      batchId,
      cost: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}
