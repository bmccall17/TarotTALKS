import { db } from '../index';
import { talks, cardTalkMappings, cards } from '../schema';
import { eq, desc, ilike, or, and, sql, count, inArray } from 'drizzle-orm';
import { generateSlug } from '../seed-data/helpers';

// Type for creating a new talk
export type InsertTalk = typeof talks.$inferInsert;

// Reusable filter for active (non-deleted) talks for public queries
export const activeFilter = eq(talks.isDeleted, false);

/**
 * Get all talks for admin (optionally include soft-deleted)
 */
export async function getAllTalksForAdmin(includeDeleted: boolean = false) {
  const whereClause = includeDeleted ? undefined : activeFilter;

  const allTalks = await db
    .select({
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
      speakerTwitterHandle: talks.speakerTwitterHandle,
      speakerBlueskyHandle: talks.speakerBlueskyHandle,
      isDeleted: talks.isDeleted,
      deletedAt: talks.deletedAt,
      shareImageUrl: talks.shareImageUrl,
      createdAt: talks.createdAt,
      updatedAt: talks.updatedAt,
    })
    .from(talks)
    .where(whereClause)
    .orderBy(desc(talks.createdAt));

  // Get all mappings with card info for these talks
  const talkIds = allTalks.map(t => t.id);

  if (talkIds.length === 0) {
    return [];
  }

  const allMappings = await db
    .select({
      talkId: cardTalkMappings.talkId,
      isPrimary: cardTalkMappings.isPrimary,
      cardImageUrl: cards.imageUrl,
      cardName: cards.name,
      cardSlug: cards.slug,
      cardId: cards.id,
    })
    .from(cardTalkMappings)
    .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
    .where(inArray(cardTalkMappings.talkId, talkIds))
    .orderBy(desc(cardTalkMappings.isPrimary));

  // Group mappings by talk
  const mappingsByTalk = allMappings.reduce((acc, mapping) => {
    if (!acc[mapping.talkId]) {
      acc[mapping.talkId] = [];
    }
    acc[mapping.talkId].push(mapping);
    return acc;
  }, {} as Record<string, typeof allMappings>);

  // Attach mappings to talks
  return allTalks.map(talk => ({
    ...talk,
    mappings: mappingsByTalk[talk.id] || [],
  }));
}

/**
 * Get a single talk by ID for admin (includes deleted)
 */
export async function getTalkByIdForAdmin(id: string) {
  // First get the talk
  const [talk] = await db
    .select()
    .from(talks)
    .where(eq(talks.id, id))
    .limit(1);

  if (!talk) return null;

  // Then get mappings separately (simpler query, more reliable)
  const mappings = await db
    .select({
      id: cardTalkMappings.id,
      cardId: cardTalkMappings.cardId,
      cardName: cards.name,
      cardSlug: cards.slug,
      cardImageUrl: cards.imageUrl,
      isPrimary: cardTalkMappings.isPrimary,
      strength: cardTalkMappings.strength,
      rationaleShort: cardTalkMappings.rationaleShort,
    })
    .from(cardTalkMappings)
    .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
    .where(eq(cardTalkMappings.talkId, id))
    .orderBy(desc(cardTalkMappings.isPrimary), desc(cardTalkMappings.strength));

  return {
    ...talk,
    mappings,
  };
}

/**
 * Search talks by title or speaker name (for admin)
 */
export async function searchTalksForAdmin(query: string, includeDeleted: boolean = false) {
  const searchPattern = `%${query}%`;
  const whereClause = and(
    or(
      ilike(talks.title, searchPattern),
      ilike(talks.speakerName, searchPattern)
    ),
    includeDeleted ? undefined : activeFilter
  );

  const matchedTalks = await db
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      speakerName: talks.speakerName,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      thumbnailUrl: talks.thumbnailUrl,
      year: talks.year,
      language: talks.language,
      isDeleted: talks.isDeleted,
      speakerTwitterHandle: talks.speakerTwitterHandle,
      speakerBlueskyHandle: talks.speakerBlueskyHandle,
      shareImageUrl: talks.shareImageUrl,
    })
    .from(talks)
    .where(whereClause)
    .orderBy(desc(talks.createdAt))
    .limit(50);

  // Get all mappings with card info for these talks
  const talkIds = matchedTalks.map(t => t.id);

  if (talkIds.length === 0) {
    return [];
  }

  const allMappings = await db
    .select({
      talkId: cardTalkMappings.talkId,
      isPrimary: cardTalkMappings.isPrimary,
      cardImageUrl: cards.imageUrl,
      cardName: cards.name,
      cardSlug: cards.slug,
      cardId: cards.id,
    })
    .from(cardTalkMappings)
    .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
    .where(inArray(cardTalkMappings.talkId, talkIds))
    .orderBy(desc(cardTalkMappings.isPrimary));

  // Group mappings by talk
  const mappingsByTalk = allMappings.reduce((acc, mapping) => {
    if (!acc[mapping.talkId]) {
      acc[mapping.talkId] = [];
    }
    acc[mapping.talkId].push(mapping);
    return acc;
  }, {} as Record<string, typeof allMappings>);

  // Attach mappings to talks
  return matchedTalks.map(talk => ({
    ...talk,
    mappings: mappingsByTalk[talk.id] || [],
  }));
}

/**
 * Create a new talk with slug collision handling (RED FLAG #4 FIX)
 */
export async function createTalk(data: Omit<InsertTalk, 'slug'>) {
  // Generate slug from speaker name and title
  let slug = generateSlug(`${data.speakerName} ${data.title}`);

  // Check for existing slug and handle collision
  const existing = await db
    .select({ slug: talks.slug })
    .from(talks)
    .where(eq(talks.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    // Append timestamp to make unique
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const result = await db
    .insert(talks)
    .values({
      ...data,
      slug,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0];
}

/**
 * Update an existing talk
 */
export async function updateTalk(id: string, data: Partial<InsertTalk>) {
  const result = await db
    .update(talks)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(talks.id, id))
    .returning();

  return result[0];
}

/**
 * Soft delete a talk (sets isDeleted=true, deletedAt=now())
 */
export async function softDeleteTalk(id: string) {
  const result = await db
    .update(talks)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(talks.id, id))
    .returning();

  return result[0];
}

/**
 * Restore a soft-deleted talk
 */
export async function restoreTalk(id: string) {
  const result = await db
    .update(talks)
    .set({
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(talks.id, id))
    .returning();

  return result[0];
}

/**
 * Hard delete a talk (actually removes from DB, cascades to mappings)
 * YELLOW FLAG #5: Audit logging
 */
export async function hardDeleteTalk(id: string) {
  // Get talk info for audit log before deleting
  const talk = await db
    .select({ title: talks.title, speakerName: talks.speakerName })
    .from(talks)
    .where(eq(talks.id, id))
    .limit(1);

  if (talk.length === 0) {
    throw new Error('Talk not found');
  }

  // Audit log (YELLOW FLAG #5 FIX)
  console.log(
    `[AUDIT] ${new Date().toISOString()} | TALK_HARD_DELETED | ${JSON.stringify({
      talkId: id,
      talkTitle: talk[0].title,
      speaker: talk[0].speakerName,
    })}`
  );

  // Hard delete (CASCADE will delete related mappings)
  await db.delete(talks).where(eq(talks.id, id));

  return { success: true };
}

/**
 * Get a talk by its YouTube video ID (for deduplication)
 */
export async function getTalkByYouTubeId(youtubeVideoId: string) {
  const result = await db
    .select()
    .from(talks)
    .where(eq(talks.youtubeVideoId, youtubeVideoId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get statistics for the admin dashboard
 * Runs queries sequentially to avoid connection pool exhaustion on Vercel Postgres
 */
export async function getTalksStats() {
  const totalResult = await db.select({ count: count() }).from(talks).where(activeFilter);
  const deletedResult = await db.select({ count: count() }).from(talks).where(eq(talks.isDeleted, true));
  const withYoutubeResult = await db.select({ count: count() }).from(talks).where(
    and(
      activeFilter,
      sql`${talks.youtubeVideoId} IS NOT NULL`
    )
  );
  const withoutThumbnailResult = await db.select({ count: count() }).from(talks).where(
    and(
      activeFilter,
      sql`${talks.thumbnailUrl} IS NULL`
    )
  );

  return {
    total: totalResult[0]?.count || 0,
    deleted: deletedResult[0]?.count || 0,
    withYoutubeId: withYoutubeResult[0]?.count || 0,
    withoutThumbnail: withoutThumbnailResult[0]?.count || 0,
  };
}
