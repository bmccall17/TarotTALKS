import { NextRequest, NextResponse } from 'next/server';
import {
  getAllThemesForAdmin,
  searchThemesForAdmin,
  createTheme,
} from '@/lib/db/queries/admin-themes';

/**
 * GET /api/admin/themes
 * Query params:
 *   - category: string (optional) - filter by category
 *   - search: string (optional) - search by name/description
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('search');

    let themes;
    if (searchQuery) {
      themes = await searchThemesForAdmin(searchQuery);
    } else {
      themes = await getAllThemesForAdmin(category || undefined);
    }

    return NextResponse.json({ themes });
  } catch (error) {
    console.error('Error fetching themes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch themes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/themes
 * Body: { name, shortDescription, longDescription?, category? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.shortDescription) {
      return NextResponse.json(
        { error: 'Name and short description are required' },
        { status: 400 }
      );
    }

    const theme = await createTheme(body);

    return NextResponse.json({ theme }, { status: 201 });
  } catch (error) {
    console.error('Error creating theme:', error);
    return NextResponse.json(
      { error: 'Failed to create theme' },
      { status: 500 }
    );
  }
}
