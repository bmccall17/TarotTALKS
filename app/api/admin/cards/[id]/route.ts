import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { getCardForAdmin, updateCard } from '@/lib/db/queries/admin-cards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const card = await getCardForAdmin(id);

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateCard(id, body);

    if (!updated) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    revalidateTag('cards', 'max');
    if (updated.slug) {
      revalidatePath(`/cards/${updated.slug}`);
    }
    revalidatePath('/cards');
    return NextResponse.json({ card: updated });
  } catch (error) {
    console.error('Error updating card:', error);
    return NextResponse.json(
      { error: 'Failed to update card' },
      { status: 500 }
    );
  }
}
