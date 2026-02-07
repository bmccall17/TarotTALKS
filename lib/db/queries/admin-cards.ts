import { db } from '@/lib/db';
import { cards, cardTalkMappings, talks } from '@/lib/db/schema';
import { eq, ilike, or, desc, sql, inArray, and } from 'drizzle-orm';
import { formatTagPack } from '@/lib/utils/social-handles';

export async function getAllCardsForAdmin(searchQuery?: string) {
  const query = db
    .select({
      id: cards.id,
      slug: cards.slug,
      name: cards.name,
      arcanaType: cards.arcanaType,
      suit: cards.suit,
      number: cards.number,
      imageUrl: cards.imageUrl,
      summary: cards.summary,
      shareImageUrl: cards.shareImageUrl,
    })
    .from(cards);

  if (searchQuery) {
    query.where(
      or(
        ilike(cards.name, `%${searchQuery}%`),
        ilike(cards.slug, `%${searchQuery}%`)
      )
    );
  }

  const allCards = await query.orderBy(cards.sequenceIndex);

  // Get all mappings with talk info for these cards
  const cardIds = allCards.map(c => c.id);

  if (cardIds.length === 0) {
    return [];
  }

  const allMappings = await db
    .select({
      cardId: cardTalkMappings.cardId,
      isPrimary: cardTalkMappings.isPrimary,
      talkThumbnailUrl: talks.thumbnailUrl,
      talkTitle: talks.title,
      talkSlug: talks.slug,
      talkId: talks.id,
    })
    .from(cardTalkMappings)
    .innerJoin(talks, eq(cardTalkMappings.talkId, talks.id))
    .where(inArray(cardTalkMappings.cardId, cardIds))
    .orderBy(desc(cardTalkMappings.isPrimary));

  // Group mappings by card
  const mappingsByCard = allMappings.reduce((acc, mapping) => {
    if (!acc[mapping.cardId]) {
      acc[mapping.cardId] = [];
    }
    acc[mapping.cardId].push(mapping);
    return acc;
  }, {} as Record<string, typeof allMappings>);

  // Attach mappings to cards
  return allCards.map(card => ({
    ...card,
    mappings: mappingsByCard[card.id] || [],
  }));
}

export async function getCardForAdmin(cardId: string) {
  const [card] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);

  if (!card) return null;

  // Get all mappings for this card with talk details
  const mappings = await db
    .select({
      id: cardTalkMappings.id,
      talkId: cardTalkMappings.talkId,
      isPrimary: cardTalkMappings.isPrimary,
      strength: cardTalkMappings.strength,
      rationaleShort: cardTalkMappings.rationaleShort,
      rationaleLong: cardTalkMappings.rationaleLong,
      talkSlug: talks.slug,
      talkTitle: talks.title,
      talkSpeakerName: talks.speakerName,
      talkThumbnailUrl: talks.thumbnailUrl,
      talkYear: talks.year,
      talkIsDeleted: talks.isDeleted,
    })
    .from(cardTalkMappings)
    .innerJoin(talks, eq(cardTalkMappings.talkId, talks.id))
    .where(eq(cardTalkMappings.cardId, cardId))
    .orderBy(desc(cardTalkMappings.isPrimary), desc(cardTalkMappings.strength));

  return {
    ...card,
    mappings,
  };
}

export async function updateCard(
  cardId: string,
  data: {
    name?: string;
    summary?: string;
    keywords?: string;
    uprightMeaning?: string | null;
    reversedMeaning?: string | null;
    symbolism?: string | null;
    adviceWhenDrawn?: string | null;
    journalingPrompts?: string | null;
    astrologicalCorrespondence?: string | null;
    numerologicalSignificance?: string | null;
  }
) {
  const [updated] = await db
    .update(cards)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId))
    .returning();

  return updated;
}

/**
 * Get TagPack data for a card's primary mapping
 * Used to pre-populate the Share form with talk info
 */
export async function getCardTagPackData(cardId: string): Promise<{
  tagPackText: string;
  speakerName: string;
  speakerHandle: string;
  talkId: string;
} | null> {
  // Get the card with its primary mapping and talk
  const results = await db
    .select({
      cardName: cards.name,
      cardSlug: cards.slug,
      talkId: talks.id,
      talkTitle: talks.title,
      talkEventName: talks.eventName,
      talkYear: talks.year,
      speakerName: talks.speakerName,
      speakerTwitterHandle: talks.speakerTwitterHandle,
      speakerBlueskyHandle: talks.speakerBlueskyHandle,
      speakerLinkedInHandle: talks.speakerLinkedInHandle,
      speakerInstagramHandle: talks.speakerInstagramHandle,
      rationaleShort: cardTalkMappings.rationaleShort,
      isPrimary: cardTalkMappings.isPrimary,
    })
    .from(cards)
    .innerJoin(cardTalkMappings, eq(cardTalkMappings.cardId, cards.id))
    .innerJoin(talks, eq(cardTalkMappings.talkId, talks.id))
    .where(and(eq(cards.id, cardId), eq(talks.isDeleted, false)))
    .orderBy(desc(cardTalkMappings.isPrimary), desc(cardTalkMappings.strength));

  if (results.length === 0) return null;

  // Get primary mapping or first one
  const mapping = results.find((r) => r.isPrimary) || results[0];

  // Build TagPack text (similar to TagPackCopyButton format)
  const lines: string[] = [];

  // Talk title & event
  if (mapping.talkTitle) {
    const eventInfo = [mapping.talkEventName, mapping.talkYear].filter(Boolean).join(' ');
    lines.push(`"${mapping.talkTitle}"${eventInfo ? ` (${eventInfo})` : ''}`);
  }

  // Card link
  const cardUrl = `https://tarottalks.app/cards/${mapping.cardSlug}`;
  lines.push(`🃏 ${mapping.cardName}: ${cardUrl}`);

  // Rationale
  if (mapping.rationaleShort) {
    lines.push(`💡 ${mapping.rationaleShort}`);
  }

  // Speaker tags - prefer Bluesky, fallback to Twitter
  const speakerHandle = mapping.speakerBlueskyHandle || mapping.speakerTwitterHandle || '';
  if (speakerHandle) {
    const platform = mapping.speakerBlueskyHandle ? 'bluesky' : 'twitter';
    const tagPack = formatTagPack(platform, speakerHandle, true);
    lines.push(tagPack);
  }

  // LinkedIn handle
  if (mapping.speakerLinkedInHandle) {
    const linkedInTag = formatTagPack('linkedin', mapping.speakerLinkedInHandle, false);
    lines.push(`🔗 ${linkedInTag}`);
  }

  // Instagram handle
  if (mapping.speakerInstagramHandle) {
    const instagramTag = formatTagPack('instagram', mapping.speakerInstagramHandle, false);
    lines.push(`📷 ${instagramTag}`);
  }

  return {
    tagPackText: lines.join('\n'),
    speakerName: mapping.speakerName || '',
    speakerHandle: speakerHandle,
    talkId: mapping.talkId,
  };
}
