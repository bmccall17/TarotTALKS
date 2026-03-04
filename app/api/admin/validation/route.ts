import { NextRequest, NextResponse } from 'next/server';
import { getValidationIssues, getValidationSummary } from '@/lib/db/queries/admin-validation';

// Allow up to 30s for cold start + DB connection + 12 sequential queries
export const maxDuration = 30;

/**
 * GET /api/admin/validation
 * Query params:
 *   - summary: Get only the summary counts (faster)
 *   - full: Get full validation issues with details
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get('summary') === 'true';

    if (summaryOnly) {
      const summary = await getValidationSummary();
      return NextResponse.json({ summary });
    }

    // Get full validation issues
    const issues = await getValidationIssues();
    const summary = {
      critical: issues.duplicateYoutubeIds.length,
      important:
        issues.missingBothUrls.length +
        issues.missingThumbnails.length +
        issues.externalThumbnails.length +
        issues.shortDescriptions.length,
      mappings:
        issues.cardsWithoutPrimaryMapping.length +
        issues.talksNotMappedToAnyCard.length +
        issues.mappingsMissingLongRationale.length,
      info: issues.softDeletedTalks.length,
    };

    return NextResponse.json({ issues, summary });
  } catch (error) {
    console.error('Error fetching validation issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation issues' },
      { status: 500 }
    );
  }
}
