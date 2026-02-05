import { NextRequest, NextResponse } from 'next/server';
import {
  getPlatformStyle,
  parseStoredPattern,
} from '@/lib/db/queries/admin-platform-style';
import {
  generateDraft,
  estimateOperationCost,
  type DraftGenerationInput,
  type CachedInsight,
} from '@/lib/services/platform-style-ai';
import type { Platform } from '@/lib/services/platform-style-analyzer';

const VALID_PLATFORMS: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

/**
 * POST /api/admin/platform-style/generate-draft
 * Body: {
 *   platform: Platform,
 *   cardName?: string,
 *   cardSlug?: string,
 *   talkTitle?: string,
 *   speakerName?: string,
 *   speakerHandle?: string,
 *   customContext?: string
 * }
 *
 * Generates a platform-specific post draft matching learned style patterns.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const platform = body.platform as Platform;

    // Validate platform
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Valid platform is required', code: 'INVALID_PLATFORM' },
        { status: 400 }
      );
    }

    // Validate we have something to write about
    if (!body.cardName && !body.talkTitle && !body.customContext) {
      return NextResponse.json(
        { error: 'Provide cardName, talkTitle, or customContext', code: 'MISSING_CONTENT' },
        { status: 400 }
      );
    }

    // Get statistical patterns (required)
    const stored = await getPlatformStyle(platform);
    if (!stored) {
      return NextResponse.json(
        { error: 'No style patterns found. Run statistical analysis first.', code: 'NO_PATTERNS' },
        { status: 400 }
      );
    }
    const pattern = parseStoredPattern(stored);

    // Get AI insights (optional but enhances quality)
    let aiInsights = null;
    if (stored.aiInsightsCache) {
      try {
        const cached = JSON.parse(stored.aiInsightsCache) as CachedInsight;
        aiInsights = cached.insights;
      } catch {
        // Invalid cache, continue without AI insights
      }
    }

    // Build input
    const input: DraftGenerationInput = {
      platform,
      cardName: body.cardName,
      cardSlug: body.cardSlug,
      talkTitle: body.talkTitle,
      speakerName: body.speakerName,
      speakerHandle: body.speakerHandle,
      customContext: body.customContext,
    };

    // Generate draft
    const result = await generateDraft(input, pattern, aiInsights);

    if ('error' in result) {
      const isRateLimited = result.error.includes('Rate limit') || result.error.includes('quota');
      return NextResponse.json(
        { error: result.error, code: isRateLimited ? 'RATE_LIMITED' : 'AI_ERROR' },
        { status: isRateLimited ? 429 : 500 }
      );
    }

    return NextResponse.json({
      draft: result.draft,
      characterCount: result.characterCount,
      complianceIndicators: result.complianceIndicators,
      hasAiInsights: !!aiInsights,
      cost: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    });
  } catch (error) {
    console.error('Error generating draft:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/platform-style/generate-draft
 * Query: ?platform=bluesky
 *
 * Returns cost estimate for draft generation.
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
    const hasPatterns = !!stored;
    const hasAiInsights = !!(stored?.aiInsightsCache);

    return NextResponse.json({
      platform,
      hasPatterns,
      hasAiInsights,
      estimatedCost: estimateOperationCost('generate-draft'),
    });
  } catch (error) {
    console.error('Error fetching draft info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft info' },
      { status: 500 }
    );
  }
}
