/**
 * Admin database queries for spreads management
 */

import { db } from '../index';
import { spreads, cards, talks } from '../schema';
import { eq, and, or, isNull, lt, desc, sql, count, inArray } from 'drizzle-orm';

export type SpreadStats = {
  total: number;
  shared: number;
  viewed: number;
  orphaned: number;
  orphanedOlderThan30Days: number;
};

export type SpreadListItem = {
  id: string;
  shortId: string;
  card1Name: string | null;
  card2Name: string | null;
  card3Name: string | null;
  talkTitle: string | null;
  viewCount: number;
  isShared: boolean;
  createdAt: Date;
  status: 'shared' | 'viewed' | 'orphan';
};

/**
 * Get spread statistics for admin dashboard
 */
export async function getSpreadStats(): Promise<SpreadStats> {
  // Total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(spreads);
  const total = Number(totalResult.count);

  // Shared count
  const [sharedResult] = await db
    .select({ count: count() })
    .from(spreads)
    .where(eq(spreads.isShared, true));
  const shared = Number(sharedResult.count);

  // Viewed count (has been viewed at least once, regardless of shared status)
  const [viewedResult] = await db
    .select({ count: count() })
    .from(spreads)
    .where(
      and(
        sql`COALESCE(${spreads.viewCount}, 0) > 0`,
        or(eq(spreads.isShared, false), isNull(spreads.isShared))
      )
    );
  const viewed = Number(viewedResult.count);

  // Orphaned count (never shared AND never viewed)
  const [orphanedResult] = await db
    .select({ count: count() })
    .from(spreads)
    .where(
      and(
        or(eq(spreads.isShared, false), isNull(spreads.isShared)),
        or(eq(spreads.viewCount, 0), isNull(spreads.viewCount))
      )
    );
  const orphaned = Number(orphanedResult.count);

  // Orphaned older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [orphanedOldResult] = await db
    .select({ count: count() })
    .from(spreads)
    .where(
      and(
        or(eq(spreads.isShared, false), isNull(spreads.isShared)),
        or(eq(spreads.viewCount, 0), isNull(spreads.viewCount)),
        lt(spreads.createdAt, thirtyDaysAgo)
      )
    );
  const orphanedOlderThan30Days = Number(orphanedOldResult.count);

  return {
    total,
    shared,
    viewed,
    orphaned,
    orphanedOlderThan30Days,
  };
}

/**
 * Get spreads list with filtering for admin
 */
export async function getSpreadsForAdmin(options: {
  filter?: 'all' | 'shared' | 'viewed' | 'orphaned';
  limit?: number;
  offset?: number;
}): Promise<SpreadListItem[]> {
  const { filter = 'all', limit = 50, offset = 0 } = options;

  // Build where clause based on filter
  let whereClause;
  switch (filter) {
    case 'shared':
      whereClause = eq(spreads.isShared, true);
      break;
    case 'viewed':
      whereClause = and(
        sql`COALESCE(${spreads.viewCount}, 0) > 0`,
        or(eq(spreads.isShared, false), isNull(spreads.isShared))
      );
      break;
    case 'orphaned':
      whereClause = and(
        or(eq(spreads.isShared, false), isNull(spreads.isShared)),
        or(eq(spreads.viewCount, 0), isNull(spreads.viewCount))
      );
      break;
    default:
      whereClause = undefined;
  }

  // Alias for cards to get names
  const card1 = db
    .select({ id: cards.id, name: cards.name })
    .from(cards)
    .as('card1');
  const card2 = db
    .select({ id: cards.id, name: cards.name })
    .from(cards)
    .as('card2');
  const card3 = db
    .select({ id: cards.id, name: cards.name })
    .from(cards)
    .as('card3');

  // Query with joins
  const result = await db
    .select({
      id: spreads.id,
      shortId: spreads.shortId,
      card1Id: spreads.card1Id,
      card2Id: spreads.card2Id,
      card3Id: spreads.card3Id,
      talkId: spreads.talkId,
      viewCount: spreads.viewCount,
      isShared: spreads.isShared,
      createdAt: spreads.createdAt,
    })
    .from(spreads)
    .where(whereClause)
    .orderBy(desc(spreads.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch card and talk names for each spread
  const spreadsWithDetails = await Promise.all(
    result.map(async (spread) => {
      // Get card names
      const cardIds = [spread.card1Id, spread.card2Id, spread.card3Id].filter(Boolean) as string[];
      const cardNames = cardIds.length > 0
        ? await db
            .select({ id: cards.id, name: cards.name })
            .from(cards)
            .where(inArray(cards.id, cardIds))
        : [];

      const cardNameMap = new Map(cardNames.map(c => [c.id, c.name]));

      // Get talk title
      let talkTitle: string | null = null;
      if (spread.talkId) {
        const [talk] = await db
          .select({ title: talks.title })
          .from(talks)
          .where(eq(talks.id, spread.talkId))
          .limit(1);
        talkTitle = talk?.title || null;
      }

      // Determine status
      let status: 'shared' | 'viewed' | 'orphan';
      if (spread.isShared) {
        status = 'shared';
      } else if ((spread.viewCount || 0) > 0) {
        status = 'viewed';
      } else {
        status = 'orphan';
      }

      return {
        id: spread.id,
        shortId: spread.shortId,
        card1Name: spread.card1Id ? cardNameMap.get(spread.card1Id) || null : null,
        card2Name: spread.card2Id ? cardNameMap.get(spread.card2Id) || null : null,
        card3Name: spread.card3Id ? cardNameMap.get(spread.card3Id) || null : null,
        talkTitle,
        viewCount: spread.viewCount || 0,
        isShared: spread.isShared || false,
        createdAt: spread.createdAt,
        status,
      };
    })
  );

  return spreadsWithDetails;
}

/**
 * Get count for filtered spreads (for pagination)
 */
export async function getSpreadsCount(filter?: 'all' | 'shared' | 'viewed' | 'orphaned'): Promise<number> {
  let whereClause;
  switch (filter) {
    case 'shared':
      whereClause = eq(spreads.isShared, true);
      break;
    case 'viewed':
      whereClause = and(
        sql`COALESCE(${spreads.viewCount}, 0) > 0`,
        or(eq(spreads.isShared, false), isNull(spreads.isShared))
      );
      break;
    case 'orphaned':
      whereClause = and(
        or(eq(spreads.isShared, false), isNull(spreads.isShared)),
        or(eq(spreads.viewCount, 0), isNull(spreads.viewCount))
      );
      break;
    default:
      whereClause = undefined;
  }

  const [result] = await db
    .select({ count: count() })
    .from(spreads)
    .where(whereClause);

  return Number(result.count);
}

/**
 * Delete orphaned spreads older than X days
 */
export async function cleanupOrphanedSpreads(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // First count what we're about to delete for audit
  const [countResult] = await db
    .select({ count: count() })
    .from(spreads)
    .where(
      and(
        or(eq(spreads.isShared, false), isNull(spreads.isShared)),
        or(eq(spreads.viewCount, 0), isNull(spreads.viewCount)),
        lt(spreads.createdAt, cutoffDate)
      )
    );
  const toDelete = Number(countResult.count);

  if (toDelete === 0) {
    return 0;
  }

  // Audit log
  console.log(
    `[AUDIT] ${new Date().toISOString()} | SPREADS_CLEANUP | ${JSON.stringify({
      daysOld,
      cutoffDate: cutoffDate.toISOString(),
      deletedCount: toDelete,
    })}`
  );

  // Delete orphaned spreads
  await db
    .delete(spreads)
    .where(
      and(
        or(eq(spreads.isShared, false), isNull(spreads.isShared)),
        or(eq(spreads.viewCount, 0), isNull(spreads.viewCount)),
        lt(spreads.createdAt, cutoffDate)
      )
    );

  return toDelete;
}

/**
 * Preview orphaned spreads that would be deleted (for confirmation)
 */
export async function previewOrphanedSpreads(daysOld: number, limit: number = 10): Promise<{
  total: number;
  sample: { shortId: string; createdAt: Date }[];
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const whereClause = and(
    or(eq(spreads.isShared, false), isNull(spreads.isShared)),
    or(eq(spreads.viewCount, 0), isNull(spreads.viewCount)),
    lt(spreads.createdAt, cutoffDate)
  );

  const [countResult] = await db
    .select({ count: count() })
    .from(spreads)
    .where(whereClause);

  const sample = await db
    .select({ shortId: spreads.shortId, createdAt: spreads.createdAt })
    .from(spreads)
    .where(whereClause)
    .orderBy(spreads.createdAt)
    .limit(limit);

  return {
    total: Number(countResult.count),
    sample,
  };
}
