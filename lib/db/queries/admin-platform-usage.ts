import { db } from '@/lib/db';
import { cards, talks, behaviorEvents } from '@/lib/db/schema';
import { sql, countDistinct, eq, not, like, and, gte } from 'drizzle-orm';

// --- Billing Cycle (16th to 16th) ---

export type BillingCycleInfo = {
  start: string;
  end: string;
  daysPassed: number;
  daysRemaining: number;
  daysTotal: number;
};

export function getBillingCycleInfo(): BillingCycleInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  let start: Date;
  let end: Date;

  if (day >= 16) {
    // Current cycle: 16th of this month → 16th of next month
    start = new Date(year, month, 16);
    end = new Date(year, month + 1, 16);
  } else {
    // Current cycle: 16th of last month → 16th of this month
    start = new Date(year, month - 1, 16);
    end = new Date(year, month, 16);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysTotal = Math.round((end.getTime() - start.getTime()) / msPerDay);
  const daysPassed = Math.round((now.getTime() - start.getTime()) / msPerDay);
  const daysRemaining = Math.max(0, daysTotal - daysPassed);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  return {
    start: fmt(start),
    end: fmt(end),
    daysPassed,
    daysRemaining,
    daysTotal,
  };
}

// --- Database Size ---

export type DatabaseSize = {
  bytes: number;
  mb: number;
  limitMb: number;
  percent: number;
};

export async function getDatabaseSize(): Promise<DatabaseSize> {
  const LIMIT_MB = 500;

  try {
    // Try pg_database_size first (may fail on Supabase pooled connections)
    const result = await db.execute(
      sql`SELECT pg_database_size(current_database()) as size_bytes`
    );
    const bytes = Number(result[0]?.size_bytes ?? 0);
    if (bytes > 0) {
      const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
      const percent = Math.round((mb / LIMIT_MB) * 1000) / 10;
      return { bytes, mb, limitMb: LIMIT_MB, percent };
    }
  } catch (e) {
    console.warn('pg_database_size() failed, falling back to table size sum:', e);
  }

  // Fallback: sum sizes of all tables in public schema
  try {
    const result = await db.execute(
      sql`SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(tablename))), 0) as size_bytes
          FROM pg_tables WHERE schemaname = 'public'`
    );
    const bytes = Number(result[0]?.size_bytes ?? 0);
    const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
    const percent = Math.round((mb / LIMIT_MB) * 1000) / 10;
    return { bytes, mb, limitMb: LIMIT_MB, percent };
  } catch (e) {
    console.warn('Table size sum also failed:', e);
    return { bytes: 0, mb: 0, limitMb: LIMIT_MB, percent: 0 };
  }
}

// --- Image Source Count (Vercel Image Optimization) ---

export type ImageSourceCount = {
  cards: number;
  talks: number;
  total: number;
  limit: number;
  percent: number;
};

export async function getImageSourceCount(): Promise<ImageSourceCount> {
  const LIMIT = 1000;

  // Count distinct card image URLs
  const cardResult = await db
    .select({ count: countDistinct(cards.imageUrl) })
    .from(cards);

  // Count distinct non-null talk thumbnail URLs (not deleted)
  const talkResult = await db
    .select({ count: countDistinct(talks.thumbnailUrl) })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        sql`${talks.thumbnailUrl} IS NOT NULL`
      )
    );

  const cardCount = cardResult[0]?.count ?? 0;
  const talkCount = talkResult[0]?.count ?? 0;
  const total = cardCount + talkCount;
  const percent = Math.round((total / LIMIT) * 1000) / 10;

  return {
    cards: cardCount,
    talks: talkCount,
    total,
    limit: LIMIT,
    percent,
  };
}

// --- Session Trend (today vs 7-day average) ---

// Filter condition to exclude test events
function excludeTestEvents() {
  return not(like(behaviorEvents.properties, '%"is_test":true%'));
}

export type SessionTrend = {
  today: number;
  avgDaily: number;
  trend: 'up' | 'down' | 'stable';
};

export async function getSessionTrend(): Promise<SessionTrend> {
  const now = new Date();

  // Today's start (UTC)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 7 days ago for average
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Today's sessions
  const todayResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, todayStart),
        excludeTestEvents()
      )
    );

  const today = todayResult[0]?.count ?? 0;

  // Last 7 days sessions (excluding today)
  const weekResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, sevenDaysAgo),
        sql`${behaviorEvents.createdAt} < ${todayStart}`,
        excludeTestEvents()
      )
    );

  const weekSessions = weekResult[0]?.count ?? 0;
  const avgDaily = Math.round((weekSessions / 7) * 10) / 10;

  // Determine trend (10% threshold)
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (avgDaily > 0) {
    const ratio = today / avgDaily;
    if (ratio > 1.1) trend = 'up';
    else if (ratio < 0.9) trend = 'down';
  }

  return { today, avgDaily, trend };
}

// --- Combined fetch ---

export type PlatformUsageData = {
  billingCycle: BillingCycleInfo;
  dbSize: DatabaseSize;
  imageSources: ImageSourceCount;
  sessionTrend: SessionTrend;
};

async function safeQuery<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`Platform usage query failed [${label}]:`, e);
    return fallback;
  }
}

export async function getAllPlatformUsage(): Promise<PlatformUsageData> {
  const billingCycle = getBillingCycleInfo();

  const [dbSize, imageSources, sessionTrend] = await Promise.all([
    safeQuery(getDatabaseSize, { bytes: 0, mb: 0, limitMb: 500, percent: 0 }, 'dbSize'),
    safeQuery(getImageSourceCount, { cards: 0, talks: 0, total: 0, limit: 1000, percent: 0 }, 'imageSources'),
    safeQuery(getSessionTrend, { today: 0, avgDaily: 0, trend: 'stable' as const }, 'sessionTrend'),
  ]);

  return { billingCycle, dbSize, imageSources, sessionTrend };
}
