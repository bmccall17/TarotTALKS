import { db } from '../index';
import { cards, cardTalkMappings, talks } from '../schema';
import { eq, desc, sql, and, or, isNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

async function _getAllCards() {
  return db
    .select({
      id: cards.id,
      slug: cards.slug,
      name: cards.name,
      arcanaType: cards.arcanaType,
      suit: cards.suit,
      number: cards.number,
      sequenceIndex: cards.sequenceIndex,
      imageUrl: cards.imageUrl,
      keywords: cards.keywords,
      summary: cards.summary,
    })
    .from(cards)
    .orderBy(cards.sequenceIndex);
}

export const getAllCards = unstable_cache(_getAllCards, ['all-cards'], {
  revalidate: 3600,
  tags: ['cards'],
});

export async function getCardBySlug(slug: string) {
  const [card] = await db
    .select()
    .from(cards)
    .where(eq(cards.slug, slug))
    .limit(1);

  return card;
}

export async function getCardWithMappings(slug: string) {
  const card = await getCardBySlug(slug);
  if (!card) return null;

  const mappings = await db
    .select({
      talk: {
        id: talks.id,
        slug: talks.slug,
        title: talks.title,
        speakerName: talks.speakerName,
        tedUrl: talks.tedUrl,
        youtubeUrl: talks.youtubeUrl,
        youtubeVideoId: talks.youtubeVideoId,
        description: talks.description,
        durationSeconds: talks.durationSeconds,
        eventName: talks.eventName,
        year: talks.year,
        thumbnailUrl: talks.thumbnailUrl,
        language: talks.language,
        isDeleted: talks.isDeleted,
      },
      mapping: cardTalkMappings,
    })
    .from(cardTalkMappings)
    .innerJoin(talks, eq(cardTalkMappings.talkId, talks.id))
    .where(
      and(
        eq(cardTalkMappings.cardId, card.id),
        // Filter out soft-deleted talks
        or(eq(talks.isDeleted, false), isNull(talks.isDeleted))
      )
    )
    .orderBy(
      desc(cardTalkMappings.isPrimary),
      desc(cardTalkMappings.strength)
    );

  return {
    ...card,
    mappings,
  };
}

export async function getCardsByArcana(arcanaType: 'major' | 'minor') {
  return db
    .select()
    .from(cards)
    .where(eq(cards.arcanaType, arcanaType))
    .orderBy(cards.sequenceIndex);
}

export async function getCardsBySuit(suit: 'wands' | 'cups' | 'swords' | 'pentacles') {
  return db
    .select()
    .from(cards)
    .where(eq(cards.suit, suit))
    .orderBy(cards.number);
}
