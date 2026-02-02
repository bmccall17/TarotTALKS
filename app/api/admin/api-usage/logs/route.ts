import { NextRequest, NextResponse } from 'next/server';
import { getApiCallLogs } from '@/lib/db/queries/admin-api-usage';

/**
 * GET /api/admin/api-usage/logs
 *
 * Returns detailed API call logs for admin inspection.
 *
 * Query params:
 * - api: 'gemini' | 'youtube' (required)
 * - days: number (default 7, max 90)
 * - limit: number (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get and validate api parameter
    const apiName = searchParams.get('api');
    if (!apiName || (apiName !== 'gemini' && apiName !== 'youtube')) {
      return NextResponse.json(
        { error: 'api parameter must be "gemini" or "youtube"' },
        { status: 400 }
      );
    }

    // Get and validate days parameter
    const days = parseInt(searchParams.get('days') || '7', 10);
    const validDays = Math.min(Math.max(1, days), 90);

    // Get and validate limit parameter
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const validLimit = Math.min(Math.max(1, limit), 100);

    const logs = await getApiCallLogs(apiName, validDays, validLimit);

    return NextResponse.json({
      apiName,
      days: validDays,
      limit: validLimit,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Error fetching API logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API logs' },
      { status: 500 }
    );
  }
}
