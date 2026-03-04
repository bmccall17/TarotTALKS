import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

import {
  getAllPlatformStyles,
  getPlatformStyle,
  getPlatformStyleSummary,
  parseStoredPattern,
} from '@/lib/db/queries/admin-platform-style';

/**
 * GET /api/admin/platform-style
 * Query params:
 *   - platform: get specific platform (optional)
 *   - summary: if "true", return summary stats only
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const summaryOnly = searchParams.get('summary') === 'true';

    // Summary mode - return quick stats
    if (summaryOnly) {
      const summary = await getPlatformStyleSummary();
      return NextResponse.json(summary);
    }

    // Single platform mode
    if (platform) {
      const validPlatforms = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json(
          { error: 'Invalid platform' },
          { status: 400 }
        );
      }

      const stored = await getPlatformStyle(platform as 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other');

      if (!stored) {
        return NextResponse.json({
          pattern: null,
          message: 'No analysis found for this platform. Click "Analyze Now" to generate patterns.'
        });
      }

      const pattern = parseStoredPattern(stored);
      return NextResponse.json({
        pattern,
        lastAnalyzedAt: stored.lastAnalyzedAt,
        examplePosts: stored.examplePosts || [],
      });
    }

    // All platforms mode
    const allStored = await getAllPlatformStyles();
    const patterns = allStored.map(stored => ({
      ...parseStoredPattern(stored),
      lastAnalyzedAt: stored.lastAnalyzedAt,
    }));

    return NextResponse.json({ patterns });
  } catch (error) {
    console.error('Error fetching platform styles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform styles' },
      { status: 500 }
    );
  }
}
