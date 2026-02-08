import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { deleteMapping, setMappingAsPrimary } from '@/lib/db/queries/admin-mappings';
import { db } from '@/lib/db';
import { cards, cardTalkMappings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/mappings/[id]
 * Delete a mapping
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      );
    }

    // Get card slug before deleting to revalidate the page
    const cardData = await db
      .select({ slug: cards.slug })
      .from(cardTalkMappings)
      .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
      .where(eq(cardTalkMappings.id, id))
      .limit(1);

    await deleteMapping(id);

    // Revalidate the card detail page
    if (cardData.length > 0) {
      revalidatePath(`/cards/${cardData[0].slug}`);
    }
    revalidateTag('cards', 'max');
    revalidateTag('talks', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete mapping' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/mappings/[id]
 * Update a mapping (e.g., set as primary)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      );
    }

    // If setting as primary
    if (body.setAsPrimary === true) {
      const mapping = await setMappingAsPrimary(id);

      // Revalidate the card detail page to bust the cache
      const cardData = await db
        .select({ slug: cards.slug })
        .from(cardTalkMappings)
        .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
        .where(eq(cardTalkMappings.id, id))
        .limit(1);

      if (cardData.length > 0) {
        revalidatePath(`/cards/${cardData[0].slug}`);
      }
      revalidateTag('cards', 'max');
      revalidateTag('talks', 'max');

      return NextResponse.json({ mapping });
    }

    return NextResponse.json(
      { error: 'No valid action specified' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update mapping' },
      { status: 500 }
    );
  }
}
