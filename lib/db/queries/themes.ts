import { db } from '../index';
import { themes, cardThemes, talkThemes, cards, talks } from '../schema';
import { eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

async function _getAllThemes() {
  // Single query with correlated subqueries for counts (eliminates N+1)
  const allThemes = await db
    .select({
      id: themes.id,
      slug: themes.slug,
      name: themes.name,
      description: themes.shortDescription,
      cardsCount: sql<number>`(SELECT count(*) FROM card_themes WHERE card_themes.theme_id = ${themes.id})`,
      talksCount: sql<number>`(SELECT count(*) FROM talk_themes WHERE talk_themes.theme_id = ${themes.id})`,
    })
    .from(themes)
    .orderBy(themes.name);

  return allThemes.map((theme) => ({
    ...theme,
    cardsCount: Number(theme.cardsCount),
    talksCount: Number(theme.talksCount),
  }));
}

export const getAllThemes = unstable_cache(_getAllThemes, ['all-themes'], {
  revalidate: 86400,
  tags: ['themes'],
});

export async function getThemeBySlug(slug: string) {
  const [theme] = await db
    .select()
    .from(themes)
    .where(eq(themes.slug, slug))
    .limit(1);

  return theme;
}

export async function getThemeWithCardsAndTalks(slug: string) {
  const [themeData] = await db
    .select({
      id: themes.id,
      slug: themes.slug,
      name: themes.name,
      description: themes.shortDescription,
    })
    .from(themes)
    .where(eq(themes.slug, slug))
    .limit(1);

  if (!themeData) return null;
  const theme = themeData;

  // Get cards for this theme
  const themeCards = await db
    .select({
      card: cards,
    })
    .from(cardThemes)
    .innerJoin(cards, eq(cardThemes.cardId, cards.id))
    .where(eq(cardThemes.themeId, theme.id))
    .orderBy(cards.sequenceIndex);

  // Get talks for this theme
  const themeTalks = await db
    .select({
      talk: talks,
    })
    .from(talkThemes)
    .innerJoin(talks, eq(talkThemes.talkId, talks.id))
    .where(eq(talkThemes.themeId, theme.id))
    .orderBy(talks.title);

  return {
    ...theme,
    cards: themeCards.map((tc) => tc.card),
    talks: themeTalks.map((tt) => tt.talk),
  };
}
