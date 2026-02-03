import { NextRequest, NextResponse } from 'next/server';
import { getCardTagPackData } from '@/lib/db/queries/admin-cards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getCardTagPackData(id);

    if (!data) {
      return NextResponse.json(
        { error: 'Card not found or has no primary mapping' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching card TagPack data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TagPack data' },
      { status: 500 }
    );
  }
}
