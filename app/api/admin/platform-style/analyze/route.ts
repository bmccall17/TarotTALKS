import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeAndStorePlatformStyle,
  parseStoredPattern,
  getPlatformStyle,
} from '@/lib/db/queries/admin-platform-style';

type Platform = 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

/**
 * POST /api/admin/platform-style/analyze
 * Body: { platform: Platform } or { all: true }
 *
 * Triggers analysis for one or all platforms
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validPlatforms: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];

    // Analyze all platforms
    if (body.all === true) {
      const results: Array<{
        platform: Platform;
        postsAnalyzed: number;
        success: boolean;
        error?: string;
      }> = [];

      for (const platform of validPlatforms) {
        try {
          const stored = await analyzeAndStorePlatformStyle(platform);
          results.push({
            platform,
            postsAnalyzed: stored.postsAnalyzed,
            success: true,
          });
        } catch (error) {
          results.push({
            platform,
            postsAnalyzed: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        message: 'Analysis complete',
        results,
      });
    }

    // Single platform analysis
    const platform = body.platform as Platform;
    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Valid platform is required' },
        { status: 400 }
      );
    }

    const stored = await analyzeAndStorePlatformStyle(platform);
    const pattern = parseStoredPattern(stored);

    // Fetch with example posts
    const withExamples = await getPlatformStyle(platform);

    return NextResponse.json({
      message: `Analyzed ${stored.postsAnalyzed} posts for ${platform}`,
      pattern,
      lastAnalyzedAt: stored.lastAnalyzedAt,
      examplePosts: withExamples?.examplePosts || [],
    });
  } catch (error) {
    console.error('Error analyzing platform style:', error);
    return NextResponse.json(
      { error: 'Failed to analyze platform style' },
      { status: 500 }
    );
  }
}
