import { db } from '../index';
import { talks, cardTalkMappings, cards } from '../schema';
import { eq, desc, or, isNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

async function _getAllTalks() {
  // Single query: fetch all talks with their mapped cards via LEFT JOIN
  const rows = await db
    .select({
      talk: talks,
      card: cards,
      isPrimary: cardTalkMappings.isPrimary,
      strength: cardTalkMappings.strength,
    })
    .from(talks)
    .leftJoin(cardTalkMappings, eq(cardTalkMappings.talkId, talks.id))
    .leftJoin(cards, eq(cardTalkMappings.cardId, cards.id))
    .where(or(eq(talks.isDeleted, false), isNull(talks.isDeleted)))
    .orderBy(desc(talks.year), talks.title);

  // Deduplicate: pick best card per talk (isPrimary first, then highest strength)
  const talkMap = new Map<string, {
    talk: typeof rows[0]['talk'];
    primaryCard: typeof rows[0]['card'];
    bestIsPrimary: boolean;
    bestStrength: number;
  }>();

  for (const row of rows) {
    const existing = talkMap.get(row.talk.id);
    const rowIsPrimary = row.isPrimary ?? false;
    const rowStrength = row.strength ?? 0;

    if (!existing) {
      talkMap.set(row.talk.id, {
        talk: row.talk,
        primaryCard: row.card,
        bestIsPrimary: rowIsPrimary,
        bestStrength: rowStrength,
      });
    } else if (row.card) {
      // Replace if: new card is primary and existing isn't, or both same primary status but higher strength
      const dominated = (rowIsPrimary && !existing.bestIsPrimary) ||
        (rowIsPrimary === existing.bestIsPrimary && rowStrength > existing.bestStrength);
      if (dominated) {
        existing.primaryCard = row.card;
        existing.bestIsPrimary = rowIsPrimary;
        existing.bestStrength = rowStrength;
      }
    }
  }

  return Array.from(talkMap.values()).map(({ talk, primaryCard }) => ({
    ...talk,
    primaryCard: primaryCard || null,
  }));
}

export const getAllTalks = unstable_cache(_getAllTalks, ['all-talks'], {
  revalidate: 3600,
  tags: ['talks'],
});

export async function getTalkBySlug(slug: string) {
  const [talk] = await db
    .select()
    .from(talks)
    .where(eq(talks.slug, slug))
    .limit(1);

  // Don't return soft-deleted talks
  if (talk?.isDeleted) {
    return undefined;
  }

  return talk;
}

export async function getTalkWithMappedCards(slug: string) {
  const talk = await getTalkBySlug(slug);
  if (!talk) return null;

  const mappedCards = await db
    .select({
      card: cards,
      mapping: cardTalkMappings,
    })
    .from(cardTalkMappings)
    .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
    .where(eq(cardTalkMappings.talkId, talk.id))
    .orderBy(desc(cardTalkMappings.strength));

  return {
    ...talk,
    mappedCards,
  };
}
