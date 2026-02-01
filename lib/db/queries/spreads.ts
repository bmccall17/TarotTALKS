/**
 * Database queries for spreads (Read My Spread feature)
 */

import { db } from '../index';
import { spreads, cards, talks, cardTalkMappings } from '../schema';
import { eq, and, or, isNull, inArray, desc } from 'drizzle-orm';
import type { SpreadCard, SpreadTalk, CardTalkMapping, FocusType, PrivacyLevel, MatchReason } from '@/lib/spread-reading/types';

/**
 * Generate a unique short ID for spread permalinks
 */
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique short ID with collision checking
 */
async function generateUniqueShortId(): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const shortId = generateShortId();
    const existing = await db
      .select({ shortId: spreads.shortId })
      .from(spreads)
      .where(eq(spreads.shortId, shortId))
      .limit(1);

    if (existing.length === 0) {
      return shortId;
    }
    attempts++;
  }
  // Fallback to longer ID (16 chars)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get cards by their IDs with data needed for spread reading
 */
export async function getCardsForSpread(cardIds: string[]): Promise<SpreadCard[]> {
  if (cardIds.length === 0) return [];

  const result = await db
    .select({
      id: cards.id,
      slug: cards.slug,
      name: cards.name,
      summary: cards.summary,
      keywords: cards.keywords,
      themesJson: cards.themesJson,
      archetypesJson: cards.archetypesJson,
      imageUrl: cards.imageUrl,
    })
    .from(cards)
    .where(inArray(cards.id, cardIds));

  // Sort by original order
  const cardMap = new Map(result.map(c => [c.id, c]));
  return cardIds
    .map(id => cardMap.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map(c => ({
      ...c,
      keywords: c.keywords ? JSON.parse(c.keywords) : [],
    }));
}

/**
 * Get all active talks with data needed for scoring
 */
export async function getTalksForScoring(): Promise<SpreadTalk[]> {
  const result = await db
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      speakerName: talks.speakerName,
      description: talks.description,
      thumbnailUrl: talks.thumbnailUrl,
      durationSeconds: talks.durationSeconds,
      themesJson: talks.themesJson,
      coreMessage: talks.coreMessage,
    })
    .from(talks)
    .where(or(eq(talks.isDeleted, false), isNull(talks.isDeleted)));

  return result;
}

/**
 * Get card-talk mappings for specific cards
 */
export async function getMappingsForCards(cardIds: string[]): Promise<CardTalkMapping[]> {
  if (cardIds.length === 0) return [];

  const result = await db
    .select({
      cardId: cardTalkMappings.cardId,
      talkId: cardTalkMappings.talkId,
      isPrimary: cardTalkMappings.isPrimary,
      strength: cardTalkMappings.strength,
      rationaleShort: cardTalkMappings.rationaleShort,
    })
    .from(cardTalkMappings)
    .where(inArray(cardTalkMappings.cardId, cardIds));

  return result;
}

/**
 * Get a talk by ID with full data
 */
export async function getTalkById(talkId: string): Promise<SpreadTalk | null> {
  const [result] = await db
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      speakerName: talks.speakerName,
      description: talks.description,
      thumbnailUrl: talks.thumbnailUrl,
      durationSeconds: talks.durationSeconds,
      themesJson: talks.themesJson,
      coreMessage: talks.coreMessage,
    })
    .from(talks)
    .where(eq(talks.id, talkId))
    .limit(1);

  return result || null;
}

/**
 * Create a new spread record
 */
export async function createSpread(params: {
  cardIds: string[]; // 2-3 card IDs in position order
  talkId: string;
  focusType?: FocusType;
  focusText?: string;
  rationale: string;
  rationaleSource: 'template' | 'ai';
  aiModel?: string;
  score: number;
  matchReasons: MatchReason[];
  privacyLevel?: PrivacyLevel;
}): Promise<{ id: string; shortId: string }> {
  const shortId = await generateUniqueShortId();

  const [result] = await db
    .insert(spreads)
    .values({
      shortId,
      card1Id: params.cardIds[0] || null,
      card2Id: params.cardIds[1] || null,
      card3Id: params.cardIds[2] || null,
      talkId: params.talkId,
      focusType: params.focusType || null,
      focusText: params.focusText || null,
      rationale: params.rationale,
      rationaleSource: params.rationaleSource,
      aiModel: params.aiModel || null,
      score: params.score,
      matchReasons: params.matchReasons,
      privacyLevel: params.privacyLevel || 'full',
    })
    .returning({ id: spreads.id, shortId: spreads.shortId });

  return result;
}

/**
 * Get a spread by short ID (for public pages)
 */
export async function getSpreadByShortId(shortId: string) {
  const [spread] = await db
    .select()
    .from(spreads)
    .where(eq(spreads.shortId, shortId))
    .limit(1);

  if (!spread) return null;

  // Get cards
  const cardIds = [spread.card1Id, spread.card2Id, spread.card3Id].filter((id): id is string => id !== null);
  const spreadCards = await getCardsForSpread(cardIds);

  // Get talk
  const talk = spread.talkId ? await getTalkById(spread.talkId) : null;

  return {
    ...spread,
    cards: spreadCards,
    talk,
    matchReasons: spread.matchReasons as MatchReason[] || [],
  };
}

/**
 * Get recent spreads (for admin/analytics)
 */
export async function getRecentSpreads(limit: number = 50) {
  return db
    .select()
    .from(spreads)
    .orderBy(desc(spreads.createdAt))
    .limit(limit);
}

/**
 * Count spreads (for admin/analytics)
 */
export async function countSpreads(): Promise<number> {
  const [result] = await db
    .select({ count: spreads.id })
    .from(spreads);

  // This is a workaround - count will be returned differently
  return 0; // We'll fix this with proper count
}
