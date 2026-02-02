import { NextRequest, NextResponse } from 'next/server';
import {
  getThemeByIdForAdmin,
  updateTheme,
  deleteTheme,
} from '@/lib/db/queries/admin-themes';

/**
 * GET /api/admin/themes/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const theme = await getThemeByIdForAdmin(id);

    if (!theme) {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Error fetching theme:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/themes/[id]
 * Body: Partial theme data
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const theme = await updateTheme(id, body);

    if (!theme) {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Error updating theme:', error);
    return NextResponse.json(
      { error: 'Failed to update theme' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/themes/[id]
 * Hard delete (cascades to cardThemes/talkThemes)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTheme(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting theme:', error);
    if (error instanceof Error && error.message === 'Theme not found') {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete theme' },
      { status: 500 }
    );
  }
}
