import { NextRequest, NextResponse } from 'next/server';
import {
  getPlatformStyle,
  getPostsForAnalysis,
  updatePlatformStyleAiCache,
  parseStoredPattern,
} from '@/lib/db/queries/admin-platform-style';
import {
  analyzeStyleWithAI,
  generatePostsHash,
  isCacheValid,
  createCacheEntry,
  estimateOperationCost,
  type CachedInsight,
} from '@/lib/services/platform-style-ai';
import type { Platform } from '@/lib/services/platform-style-analyzer';

const VALID_PLATFORMS: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

/**
 * POST /api/admin/platform-style/ai-insights
 * Body: { platform: Platform, forceRefresh?: boolean }
 *
 * Generates AI-enhanced style insights for a platform.
 * Results are cached for 7 days or until posts change.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const platform = body.platform as Platform;
    const forceRefresh = body.forceRefresh === true;

    // Validate platform
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Valid platform is required', code: 'INVALID_PLATFORM' },
        { status: 400 }
      );
    }

    // Check if statistical analysis exists
    const stored = await getPlatformStyle(platform);
    if (!stored) {
      return NextResponse.json(
        { error: 'No analysis found for this platform. Run statistical analysis first.', code: 'NO_PATTERNS' },
        { status: 400 }
      );
    }

    // Get posts for hash comparison
    const posts = await getPostsForAnalysis(platform);
    const currentHash = generatePostsHash(posts);

    // Check cache (unless force refresh)
    if (!forceRefresh && stored.aiInsightsCache) {
      try {
        const cached = JSON.parse(stored.aiInsightsCache) as CachedInsight;
        if (isCacheValid(cached, currentHash)) {
          return NextResponse.json({
            insights: cached.insights,
            fromCache: true,
            expiresAt: cached.expiresAt,
          });
        }
      } catch {
        // Invalid cache, continue to regenerate
      }
    }

    // Check minimum posts requirement
    const postsWithNotes = posts.filter(p => p.notes && p.notes.trim().length > 0);
    if (postsWithNotes.length < 3) {
      return NextResponse.json(
        { error: `Need at least 3 posts for AI analysis (found ${postsWithNotes.length})`, code: 'INSUFFICIENT_DATA' },
        { status: 400 }
      );
    }

    // Generate fresh insights
    const pattern = parseStoredPattern(stored);
    const result = await analyzeStyleWithAI(posts, platform, pattern);

    if ('error' in result) {
      const isRateLimited = result.error.includes('Rate limit') || result.error.includes('quota');
      return NextResponse.json(
        { error: result.error, code: isRateLimited ? 'RATE_LIMITED' : 'AI_ERROR' },
        { status: isRateLimited ? 429 : 500 }
      );
    }

    // Cache the results
    const cacheEntry = createCacheEntry(result, currentHash);
    await updatePlatformStyleAiCache(platform, JSON.stringify(cacheEntry));

    return NextResponse.json({
      insights: result,
      fromCache: false,
      cost: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI insights' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/platform-style/ai-insights
 * Query: ?platform=bluesky
 *
 * Returns cached AI insights if available.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as Platform | null;

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Valid platform is required', code: 'INVALID_PLATFORM' },
        { status: 400 }
      );
    }

    const stored = await getPlatformStyle(platform);
    if (!stored || !stored.aiInsightsCache) {
      return NextResponse.json({
        insights: null,
        hasCache: false,
        estimatedCost: estimateOperationCost('ai-insights'),
      });
    }

    try {
      const cached = JSON.parse(stored.aiInsightsCache) as CachedInsight;
      const posts = await getPostsForAnalysis(platform);
      const currentHash = generatePostsHash(posts);
      const isValid = isCacheValid(cached, currentHash);

      return NextResponse.json({
        insights: isValid ? cached.insights : null,
        hasCache: isValid,
        isStale: !isValid,
        expiresAt: cached.expiresAt,
        estimatedCost: estimateOperationCost('ai-insights'),
      });
    } catch {
      return NextResponse.json({
        insights: null,
        hasCache: false,
        estimatedCost: estimateOperationCost('ai-insights'),
      });
    }
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI insights' },
      { status: 500 }
    );
  }
}
