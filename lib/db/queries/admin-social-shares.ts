import { db } from '../index';
import { socialShares, cards, talks } from '../schema';
import { eq, desc, ilike, or, and, sql, count, gte, lte } from 'drizzle-orm';

// Types
export type InsertShare = typeof socialShares.$inferInsert;
export type Share = typeof socialShares.$inferSelect;

export type ShareFilters = {
  platform?: 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';
  status?: 'draft' | 'posted' | 'verified' | 'discovered' | 'acknowledged';
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  sortBy?: 'postedAt' | 'engagement';
  excludeDiscovered?: boolean;
};

export type ShareWithRelations = Share & {
  card?: { id: string; name: string; slug: string; imageUrl: string } | null;
  talk?: { id: string; title: string; slug: string; speakerName: string; thumbnailUrl: string | null } | null;
};

/**
 * Get all shares with optional filters
 */
export async function getAllSharesForAdmin(filters?: ShareFilters): Promise<ShareWithRelations[]> {
  const conditions = [];

  if (filters?.platform) {
    conditions.push(eq(socialShares.platform, filters.platform));
  }

  if (filters?.status) {
    conditions.push(eq(socialShares.status, filters.status));
  }

  // By default, exclude discovered and acknowledged (mentions) from the main list
  if (filters?.excludeDiscovered !== false && !filters?.status) {
    conditions.push(sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`);
  }

  if (filters?.dateFrom) {
    conditions.push(gte(socialShares.postedAt, filters.dateFrom));
  }

  if (filters?.dateTo) {
    conditions.push(lte(socialShares.postedAt, filters.dateTo));
  }

  if (filters?.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(socialShares.notes, searchPattern),
        ilike(socialShares.speakerName, searchPattern),
        ilike(socialShares.speakerHandle, searchPattern),
        ilike(socialShares.authorHandle, searchPattern),
        ilike(socialShares.authorDisplayName, searchPattern)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;

  // Determine sort order
  const orderBy = filters?.sortBy === 'engagement'
    ? desc(sql`COALESCE(${socialShares.likeCount}, 0) + COALESCE(${socialShares.repostCount}, 0) + COALESCE(${socialShares.replyCount}, 0)`)
    : desc(socialShares.postedAt);

  const shares = await db
    .select()
    .from(socialShares)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit);

  // Get related cards and talks
  const cardIds = shares.filter(s => s.cardId).map(s => s.cardId as string);
  const talkIds = shares.filter(s => s.talkId).map(s => s.talkId as string);

  let cardsMap: Record<string, { id: string; name: string; slug: string; imageUrl: string }> = {};
  let talksMap: Record<string, { id: string; title: string; slug: string; speakerName: string; thumbnailUrl: string | null }> = {};

  if (cardIds.length > 0) {
    const cardResults = await db
      .select({ id: cards.id, name: cards.name, slug: cards.slug, imageUrl: cards.imageUrl })
      .from(cards)
      .where(sql`${cards.id} IN (${sql.join(cardIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    cardsMap = Object.fromEntries(cardResults.map(c => [c.id, c]));
  }

  if (talkIds.length > 0) {
    const talkResults = await db
      .select({ id: talks.id, title: talks.title, slug: talks.slug, speakerName: talks.speakerName, thumbnailUrl: talks.thumbnailUrl })
      .from(talks)
      .where(sql`${talks.id} IN (${sql.join(talkIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    talksMap = Object.fromEntries(talkResults.map(t => [t.id, t]));
  }

  return shares.map(share => ({
    ...share,
    card: share.cardId ? cardsMap[share.cardId] || null : null,
    talk: share.talkId ? talksMap[share.talkId] || null : null,
  }));
}

/**
 * Get single share by ID
 */
export async function getShareById(id: string): Promise<ShareWithRelations | null> {
  const [share] = await db
    .select()
    .from(socialShares)
    .where(eq(socialShares.id, id))
    .limit(1);

  if (!share) return null;

  let card = null;
  let talk = null;

  if (share.cardId) {
    const [cardResult] = await db
      .select({ id: cards.id, name: cards.name, slug: cards.slug, imageUrl: cards.imageUrl })
      .from(cards)
      .where(eq(cards.id, share.cardId))
      .limit(1);
    card = cardResult || null;
  }

  if (share.talkId) {
    const [talkResult] = await db
      .select({ id: talks.id, title: talks.title, slug: talks.slug, speakerName: talks.speakerName, thumbnailUrl: talks.thumbnailUrl })
      .from(talks)
      .where(eq(talks.id, share.talkId))
      .limit(1);
    talk = talkResult || null;
  }

  return { ...share, card, talk };
}

/**
 * Create a new share
 */
export async function createShare(data: InsertShare): Promise<Share> {
  const [result] = await db
    .insert(socialShares)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Update an existing share
 */
export async function updateShare(id: string, data: Partial<InsertShare>): Promise<Share | null> {
  const [result] = await db
    .update(socialShares)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(socialShares.id, id))
    .returning();

  return result || null;
}

/**
 * Delete a share
 */
export async function deleteShare(id: string): Promise<void> {
  await db.delete(socialShares).where(eq(socialShares.id, id));
}

/**
 * Get share statistics for dashboard
 */
export async function getShareStats(): Promise<{ today: number; thisWeek: number; total: number }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalResult] = await db.select({ count: count() }).from(socialShares);
  const [todayResult] = await db
    .select({ count: count() })
    .from(socialShares)
    .where(gte(socialShares.postedAt, todayStart));
  const [weekResult] = await db
    .select({ count: count() })
    .from(socialShares)
    .where(gte(socialShares.postedAt, weekStart));

  return {
    today: todayResult?.count || 0,
    thisWeek: weekResult?.count || 0,
    total: totalResult?.count || 0,
  };
}

/**
 * Resolve a TarotTALKS URL to card or talk
 */
export async function resolveSharedUrl(url: string): Promise<{
  type: 'card' | 'talk' | null;
  cardId?: string;
  talkId?: string;
  name?: string;
}> {
  // Match /cards/[slug] or /talks/[slug]
  const cardMatch = url.match(/tarottalks\.app\/cards\/([a-z0-9-]+)/i);
  const talkMatch = url.match(/tarottalks\.app\/talks\/([a-z0-9-]+)/i);

  if (cardMatch) {
    const slug = cardMatch[1];
    const [card] = await db
      .select({ id: cards.id, name: cards.name })
      .from(cards)
      .where(eq(cards.slug, slug))
      .limit(1);
    if (card) {
      return { type: 'card', cardId: card.id, name: card.name };
    }
  }

  if (talkMatch) {
    const slug = talkMatch[1];
    const [talk] = await db
      .select({ id: talks.id, title: talks.title, speakerName: talks.speakerName })
      .from(talks)
      .where(eq(talks.slug, slug))
      .limit(1);
    if (talk) {
      return { type: 'talk', talkId: talk.id, name: `${talk.title} (${talk.speakerName})` };
    }
  }

  return { type: null };
}

// ==========================================
// Phase 2-4: Metrics, Relationships, Mentions
// ==========================================

export type MetricsUpdate = {
  likeCount: number;
  repostCount: number;
  replyCount: number;
  source?: 'auto' | 'manual';
};

/**
 * Update metrics for a share
 * NOTE: metricsSource tracking requires migration 0007_multi_platform_signal_deck.sql
 */
export async function updateMetrics(id: string, metrics: MetricsUpdate): Promise<Share | null> {
  const [result] = await db
    .update(socialShares)
    .set({
      likeCount: metrics.likeCount,
      repostCount: metrics.repostCount,
      replyCount: metrics.replyCount,
      // NOTE: metricsSource requires migration - uncomment after running:
      // metricsSource: metrics.source || 'auto',
      metricsUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(socialShares.id, id))
    .returning();

  return result || null;
}

/**
 * Update relationship status for a share
 */
export async function updateRelationship(id: string, following: boolean | null): Promise<Share | null> {
  const [result] = await db
    .update(socialShares)
    .set({
      followingSpeaker: following,
      relationshipUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(socialShares.id, id))
    .returning();

  return result || null;
}

/**
 * Get top shares sorted by total engagement (likes + reposts + replies)
 */
export async function getTopShares(limit: number = 5): Promise<ShareWithRelations[]> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const shares = await db
    .select()
    .from(socialShares)
    .where(
      and(
        gte(socialShares.postedAt, weekStart),
        sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`
      )
    )
    .orderBy(
      desc(sql`COALESCE(${socialShares.likeCount}, 0) + COALESCE(${socialShares.repostCount}, 0) + COALESCE(${socialShares.replyCount}, 0)`)
    )
    .limit(limit);

  // Get related cards and talks
  const cardIds = shares.filter(s => s.cardId).map(s => s.cardId as string);
  const talkIds = shares.filter(s => s.talkId).map(s => s.talkId as string);

  let cardsMap: Record<string, { id: string; name: string; slug: string; imageUrl: string }> = {};
  let talksMap: Record<string, { id: string; title: string; slug: string; speakerName: string; thumbnailUrl: string | null }> = {};

  if (cardIds.length > 0) {
    const cardResults = await db
      .select({ id: cards.id, name: cards.name, slug: cards.slug, imageUrl: cards.imageUrl })
      .from(cards)
      .where(sql`${cards.id} IN (${sql.join(cardIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    cardsMap = Object.fromEntries(cardResults.map(c => [c.id, c]));
  }

  if (talkIds.length > 0) {
    const talkResults = await db
      .select({ id: talks.id, title: talks.title, slug: talks.slug, speakerName: talks.speakerName, thumbnailUrl: talks.thumbnailUrl })
      .from(talks)
      .where(sql`${talks.id} IN (${sql.join(talkIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    talksMap = Object.fromEntries(talkResults.map(t => [t.id, t]));
  }

  return shares.map(share => ({
    ...share,
    card: share.cardId ? cardsMap[share.cardId] || null : null,
    talk: share.talkId ? talksMap[share.talkId] || null : null,
  }));
}

/**
 * Get discovered mentions (status = 'discovered')
 */
export async function getDiscoveredMentions(limit: number = 50): Promise<Share[]> {
  return db
    .select()
    .from(socialShares)
    .where(eq(socialShares.status, 'discovered'))
    .orderBy(desc(socialShares.discoveredAt))
    .limit(limit);
}

export type MentionData = {
  platform: 'bluesky';
  postUrl: string;
  atUri: string;
  authorDid: string;
  authorHandle: string;
  authorDisplayName: string;
  sharedUrl?: string;
  cardId?: string;
  talkId?: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  notes?: string; // The actual post text
  discoveredAt: Date;
};

/**
 * Create a share from a discovered mention
 */
export async function createFromMention(data: MentionData): Promise<Share> {
  const [result] = await db
    .insert(socialShares)
    .values({
      platform: data.platform,
      postUrl: data.postUrl,
      status: 'discovered',
      postedAt: data.discoveredAt,
      atUri: data.atUri,
      authorDid: data.authorDid,
      authorHandle: data.authorHandle,
      authorDisplayName: data.authorDisplayName,
      sharedUrl: data.sharedUrl,
      cardId: data.cardId,
      talkId: data.talkId,
      notes: data.notes,
      likeCount: data.likeCount ?? 0,
      repostCount: data.repostCount ?? 0,
      replyCount: data.replyCount ?? 0,
      metricsUpdatedAt: new Date(),
      discoveredAt: data.discoveredAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Check if a mention already exists by AT URI or post URL.
 * Manually-logged shares may only have postUrl (no atUri),
 * so we check both to prevent duplicates.
 */
export async function mentionExistsByAtUri(atUri: string, postUrl?: string): Promise<boolean> {
  const conditions = [eq(socialShares.atUri, atUri)];
  if (postUrl) {
    conditions.push(eq(socialShares.postUrl, postUrl));
  }

  const [result] = await db
    .select({ id: socialShares.id })
    .from(socialShares)
    .where(or(...conditions))
    .limit(1);

  return !!result;
}

/**
 * Acknowledge a discovered mention
 */
export async function acknowledgeMention(id: string): Promise<Share | null> {
  const [result] = await db
    .update(socialShares)
    .set({
      status: 'acknowledged',
      updatedAt: new Date(),
    })
    .where(eq(socialShares.id, id))
    .returning();

  return result || null;
}

/**
 * Convert a discovered mention to a tracked share
 */
export async function convertMentionToShare(id: string): Promise<Share | null> {
  const [result] = await db
    .update(socialShares)
    .set({
      status: 'posted',
      updatedAt: new Date(),
    })
    .where(eq(socialShares.id, id))
    .returning();

  return result || null;
}

// ==========================================
// Unposted Cards Tracking
// ==========================================

export type UnpostedCard = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  sequenceIndex: number;
};

export type Platform = 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

/**
 * Get cards that have never been shared on social media
 * Optionally filter by platform to find cards not shared on a specific platform
 */
export async function getUnpostedCards(
  platform?: Platform,
  limit?: number
): Promise<UnpostedCard[]> {
  // Build the NOT EXISTS subquery based on whether platform filter is applied
  const platformCondition = platform
    ? sql`${socialShares.cardId} = ${cards.id} AND ${socialShares.platform} = ${platform}`
    : sql`${socialShares.cardId} = ${cards.id}`;

  const query = db
    .select({
      id: cards.id,
      name: cards.name,
      slug: cards.slug,
      imageUrl: cards.imageUrl,
      sequenceIndex: cards.sequenceIndex,
    })
    .from(cards)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${socialShares}
        WHERE ${platformCondition}
      )`
    )
    .orderBy(cards.sequenceIndex);

  if (limit) {
    return query.limit(limit);
  }

  return query;
}

/**
 * Get statistics about unposted cards for the dashboard
 */
export async function getUnpostedCardsStats(): Promise<{
  totalCards: number;
  unpostedOverall: number;
  unpostedByPlatform: Record<Platform, number>;
  sharedCards: number;
}> {
  // Get total card count
  const [totalResult] = await db.select({ count: count() }).from(cards);
  const totalCards = totalResult?.count || 0;

  // Get cards with no shares at all
  const [unpostedResult] = await db
    .select({ count: count() })
    .from(cards)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${socialShares}
        WHERE ${socialShares.cardId} = ${cards.id}
      )`
    );
  const unpostedOverall = unpostedResult?.count || 0;

  // Get unposted count per platform
  const platforms: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];
  const unpostedByPlatform: Record<Platform, number> = {} as Record<Platform, number>;

  for (const platform of platforms) {
    const [result] = await db
      .select({ count: count() })
      .from(cards)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${socialShares}
          WHERE ${socialShares.cardId} = ${cards.id}
          AND ${socialShares.platform} = ${platform}
        )`
      );
    unpostedByPlatform[platform] = result?.count || 0;
  }

  return {
    totalCards,
    unpostedOverall,
    unpostedByPlatform,
    sharedCards: totalCards - unpostedOverall,
  };
}
