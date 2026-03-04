import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

import {
  getAllSharesForAdmin,
  createShare,
  getShareStats,
  resolveSharedUrl,
  type ShareFilters,
} from '@/lib/db/queries/admin-social-shares';

/**
 * GET /api/admin/social-shares
 * Query params:
 *   - platform: filter by platform
 *   - status: filter by status
 *   - search: search in notes, speaker name/handle
 *   - dateFrom / dateTo: date range (ISO strings)
 *   - limit: pagination limit (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters: ShareFilters = {};

    const platform = searchParams.get('platform');
    if (platform && ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'].includes(platform)) {
      filters.platform = platform as ShareFilters['platform'];
    }

    const status = searchParams.get('status');
    if (status && ['draft', 'posted', 'verified', 'discovered', 'acknowledged'].includes(status)) {
      filters.status = status as ShareFilters['status'];
    }

    const sortBy = searchParams.get('sortBy');
    if (sortBy && ['postedAt', 'engagement'].includes(sortBy)) {
      filters.sortBy = sortBy as ShareFilters['sortBy'];
    }

    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }

    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom) {
      filters.dateFrom = new Date(dateFrom);
    }

    const dateTo = searchParams.get('dateTo');
    if (dateTo) {
      filters.dateTo = new Date(dateTo);
    }

    const limit = searchParams.get('limit');
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    const shares = await getAllSharesForAdmin(filters);
    const stats = await getShareStats();

    return NextResponse.json({ shares, stats });
  } catch (error) {
    console.error('Error fetching shares:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shares' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/social-shares
 * Body: InsertShare
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    // If sharedUrl is provided, try to resolve card/talk
    if (body.sharedUrl && !body.cardId && !body.talkId) {
      const resolved = await resolveSharedUrl(body.sharedUrl);
      if (resolved.cardId) {
        body.cardId = resolved.cardId;
      }
      if (resolved.talkId) {
        body.talkId = resolved.talkId;
      }
    }

    // Convert date strings to Date objects
    if (body.postedAt && typeof body.postedAt === 'string') {
      body.postedAt = new Date(body.postedAt);
    }
    if (body.metricsUpdatedAt && typeof body.metricsUpdatedAt === 'string') {
      body.metricsUpdatedAt = new Date(body.metricsUpdatedAt);
    }
    if (body.relationshipUpdatedAt && typeof body.relationshipUpdatedAt === 'string') {
      body.relationshipUpdatedAt = new Date(body.relationshipUpdatedAt);
    }

    const share = await createShare(body);

    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
}
