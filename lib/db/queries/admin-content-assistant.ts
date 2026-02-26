import { db } from '../index';
import { contentBrandConfig, contentCalendarItems, socialShares, cards, talks } from '../schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export type BrandConfig = typeof contentBrandConfig.$inferSelect;
export type InsertBrandConfig = typeof contentBrandConfig.$inferInsert;

export type CalendarItem = typeof contentCalendarItems.$inferSelect;
export type InsertCalendarItem = typeof contentCalendarItems.$inferInsert;

export type CalendarItemWithRelations = CalendarItem & {
  card?: { id: string; name: string; slug: string; imageUrl: string } | null;
  talk?: { id: string; title: string; slug: string; speakerName: string } | null;
};

type Platform = 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

// ============================================================================
// Brand Config (singleton)
// ============================================================================

/**
 * Get the brand config (creates default if none exists)
 */
export async function getBrandConfig(): Promise<BrandConfig> {
  const [existing] = await db
    .select()
    .from(contentBrandConfig)
    .limit(1);

  if (existing) return existing;

  // Create default
  const [created] = await db
    .insert(contentBrandConfig)
    .values({
      offerDescription: '',
      audiencePersona: '',
      keyMessagingPillars: '[]',
      brandToneDescription: '',
      contentFrameworks: '["3_things", "hook_story_offer", "pas", "open_loop", "before_after"]',
      ctaOptions: '[]',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

/**
 * Update brand config
 */
export async function updateBrandConfig(data: Partial<InsertBrandConfig>): Promise<BrandConfig> {
  const existing = await getBrandConfig();

  const [result] = await db
    .update(contentBrandConfig)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(contentBrandConfig.id, existing.id))
    .returning();

  return result;
}

// ============================================================================
// Calendar Items
// ============================================================================

/**
 * Get calendar items for a specific week and platform
 */
export async function getCalendarItems(
  weekStartDate: string,
  platform: Platform
): Promise<CalendarItemWithRelations[]> {
  const items = await db
    .select()
    .from(contentCalendarItems)
    .where(
      and(
        eq(contentCalendarItems.weekStartDate, weekStartDate),
        eq(contentCalendarItems.platform, platform)
      )
    )
    .orderBy(contentCalendarItems.dayOfWeek);

  return attachRelations(items);
}

/**
 * Get a single calendar item by ID
 */
export async function getCalendarItem(id: string): Promise<CalendarItemWithRelations | null> {
  const [item] = await db
    .select()
    .from(contentCalendarItems)
    .where(eq(contentCalendarItems.id, id))
    .limit(1);

  if (!item) return null;

  const [withRelations] = await attachRelations([item]);
  return withRelations || null;
}

/**
 * Create multiple calendar items (batch insert for a week)
 */
export async function createCalendarItems(items: InsertCalendarItem[]): Promise<CalendarItem[]> {
  if (items.length === 0) return [];

  const results = await db
    .insert(contentCalendarItems)
    .values(items.map(item => ({
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    })))
    .returning();

  return results;
}

/**
 * Update a single calendar item
 */
export async function updateCalendarItem(
  id: string,
  data: Partial<InsertCalendarItem>
): Promise<CalendarItem | null> {
  const [result] = await db
    .update(contentCalendarItems)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(contentCalendarItems.id, id))
    .returning();

  return result || null;
}

/**
 * Delete a calendar item
 */
export async function deleteCalendarItem(id: string): Promise<void> {
  await db.delete(contentCalendarItems).where(eq(contentCalendarItems.id, id));
}

/**
 * Delete all items for a week/platform (used before regenerating)
 */
export async function deleteWeekItems(weekStartDate: string, platform: Platform): Promise<number> {
  const deleted = await db
    .delete(contentCalendarItems)
    .where(
      and(
        eq(contentCalendarItems.weekStartDate, weekStartDate),
        eq(contentCalendarItems.platform, platform),
        // Only delete non-pushed items
        sql`${contentCalendarItems.status} != 'pushed'`
      )
    )
    .returning();

  return deleted.length;
}

/**
 * Get top-performing posts for a platform (used as exemplars in prompts)
 */
export async function getTopPerformingPosts(
  platform: Platform,
  limit: number = 3
): Promise<Array<{ notes: string; engagement: number }>> {
  const posts = await db
    .select({
      notes: socialShares.notes,
      engagement: sql<number>`COALESCE(${socialShares.likeCount}, 0) + COALESCE(${socialShares.repostCount}, 0) + COALESCE(${socialShares.replyCount}, 0)`,
    })
    .from(socialShares)
    .where(
      and(
        eq(socialShares.platform, platform),
        sql`${socialShares.notes} IS NOT NULL AND ${socialShares.notes} != ''`,
        sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`
      )
    )
    .orderBy(desc(sql`COALESCE(${socialShares.likeCount}, 0) + COALESCE(${socialShares.repostCount}, 0) + COALESCE(${socialShares.replyCount}, 0)`))
    .limit(limit);

  return posts.filter(p => p.notes !== null) as Array<{ notes: string; engagement: number }>;
}

/**
 * Get random cards for content generation (diverse selection)
 */
export async function getRandomCards(count: number = 7): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  keywords: string;
  summary: string;
}>> {
  return db
    .select({
      id: cards.id,
      name: cards.name,
      slug: cards.slug,
      keywords: cards.keywords,
      summary: cards.summary,
    })
    .from(cards)
    .orderBy(sql`RANDOM()`)
    .limit(count);
}

/**
 * Get random talks for content generation
 */
export async function getRandomTalks(count: number = 7): Promise<Array<{
  id: string;
  title: string;
  slug: string;
  speakerName: string;
  description: string | null;
}>> {
  return db
    .select({
      id: talks.id,
      title: talks.title,
      slug: talks.slug,
      speakerName: talks.speakerName,
      description: talks.description,
    })
    .from(talks)
    .where(eq(talks.isDeleted, false))
    .orderBy(sql`RANDOM()`)
    .limit(count);
}

/**
 * Get calendar item counts by status for a week/platform
 */
export async function getWeekStats(
  weekStartDate: string,
  platform: Platform
): Promise<Record<string, number>> {
  const results = await db
    .select({
      status: contentCalendarItems.status,
      count: count(),
    })
    .from(contentCalendarItems)
    .where(
      and(
        eq(contentCalendarItems.weekStartDate, weekStartDate),
        eq(contentCalendarItems.platform, platform)
      )
    )
    .groupBy(contentCalendarItems.status);

  return Object.fromEntries(results.map(r => [r.status, r.count]));
}

// ============================================================================
// Helpers
// ============================================================================

async function attachRelations(items: CalendarItem[]): Promise<CalendarItemWithRelations[]> {
  const cardIds = items.filter(i => i.cardId).map(i => i.cardId as string);
  const talkIds = items.filter(i => i.talkId).map(i => i.talkId as string);

  let cardsMap: Record<string, { id: string; name: string; slug: string; imageUrl: string }> = {};
  let talksMap: Record<string, { id: string; title: string; slug: string; speakerName: string }> = {};

  if (cardIds.length > 0) {
    const cardResults = await db
      .select({ id: cards.id, name: cards.name, slug: cards.slug, imageUrl: cards.imageUrl })
      .from(cards)
      .where(sql`${cards.id} IN (${sql.join(cardIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    cardsMap = Object.fromEntries(cardResults.map(c => [c.id, c]));
  }

  if (talkIds.length > 0) {
    const talkResults = await db
      .select({ id: talks.id, title: talks.title, slug: talks.slug, speakerName: talks.speakerName })
      .from(talks)
      .where(sql`${talks.id} IN (${sql.join(talkIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    talksMap = Object.fromEntries(talkResults.map(t => [t.id, t]));
  }

  return items.map(item => ({
    ...item,
    card: item.cardId ? cardsMap[item.cardId] || null : null,
    talk: item.talkId ? talksMap[item.talkId] || null : null,
  }));
}
