import { NextRequest, NextResponse } from 'next/server';
import {
  getBrandConfig,
  getTopPerformingPosts,
  getRandomCards,
  getRandomTalks,
} from '@/lib/db/queries/admin-content-assistant';
import { getPlatformStyle, parseStoredPattern } from '@/lib/db/queries/admin-platform-style';
import { generateWeekStrategy, type VoiceContext } from '@/lib/services/content-assistant';
import type { AIStyleInsights, CachedInsight } from '@/lib/services/platform-style-ai';
import type { Platform } from '@/lib/services/platform-style-analyzer';

const VALID_PLATFORMS: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

/**
 * POST /api/admin/content-assistant/generate-week/strategy
 * Step 1: AI plans 7-day calendar (topics, types, hooks)
 *
 * Body: { platform: string, weekStartDate: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const platform = body.platform as Platform;
    const weekStartDate = body.weekStartDate as string;

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'Valid platform is required' }, { status: 400 });
    }

    if (!weekStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return NextResponse.json({ error: 'Valid weekStartDate (YYYY-MM-DD) is required' }, { status: 400 });
    }

    // Build voice context
    const [brandConfig, topPerformers, contentCards, contentTalks] = await Promise.all([
      getBrandConfig(),
      getTopPerformingPosts(platform, 3),
      getRandomCards(7),
      getRandomTalks(7),
    ]);

    // Get platform style data (may not exist for all platforms)
    let stylePattern = null;
    let aiInsights: AIStyleInsights | null = null;

    const stored = await getPlatformStyle(platform);
    if (stored) {
      stylePattern = parseStoredPattern(stored);
      if (stored.aiInsightsCache) {
        try {
          const cached = JSON.parse(stored.aiInsightsCache) as CachedInsight;
          aiInsights = cached.insights;
        } catch { /* ignore invalid cache */ }
      }
    }

    const voice: VoiceContext = {
      brandConfig,
      stylePattern,
      aiInsights,
      topPerformers,
    };

    const result = await generateWeekStrategy(
      platform,
      weekStartDate,
      voice,
      contentCards,
      contentTalks,
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      strategy: result.items,
      cost: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    });
  } catch (error) {
    console.error('Error generating strategy:', error);
    return NextResponse.json({ error: 'Failed to generate strategy' }, { status: 500 });
  }
}
