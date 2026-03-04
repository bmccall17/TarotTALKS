import { NextRequest, NextResponse } from 'next/server';
import { getBrandConfig, updateBrandConfig } from '@/lib/db/queries/admin-content-assistant';

export const maxDuration = 30;

/**
 * GET /api/admin/content-assistant/brand-config
 * Returns the brand config (creates default if none exists)
 */
export async function GET() {
  try {
    const config = await getBrandConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching brand config:', error);
    return NextResponse.json({ error: 'Failed to fetch brand config' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/content-assistant/brand-config
 * Updates the brand config
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate JSON arrays if provided
    const jsonFields = ['keyMessagingPillars', 'contentFrameworks', 'ctaOptions', 'dmSequenceSteps'];
    for (const field of jsonFields) {
      if (body[field] !== undefined && typeof body[field] === 'string') {
        try {
          JSON.parse(body[field]);
        } catch {
          return NextResponse.json(
            { error: `Invalid JSON for ${field}` },
            { status: 400 }
          );
        }
      }
    }

    const config = await updateBrandConfig(body);
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error updating brand config:', error);
    return NextResponse.json({ error: 'Failed to update brand config' }, { status: 500 });
  }
}
