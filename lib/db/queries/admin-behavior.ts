import { db } from '@/lib/db';
import { behaviorEvents } from '@/lib/db/schema';
import { sql, countDistinct, and, gte, eq } from 'drizzle-orm';

// Default time range: 7 days
const DEFAULT_DAYS = 7;

function getDateCutoff(days: number = DEFAULT_DAYS): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

// ISO string version for use in db.execute(sql`...`) — Date objects fail with Drizzle raw SQL
function getDateCutoffIso(days: number = DEFAULT_DAYS): string {
  return getDateCutoff(days).toISOString();
}

// Filter condition to exclude test events using JSON extraction (avoids leading-wildcard LIKE scan)
function excludeTestEvents() {
  return sql`(${behaviorEvents.properties})::jsonb ->> 'is_test' IS DISTINCT FROM 'true'`;
}

export type SessionStats = {
  totalSessions: number;
  bounceRate: number;
  engagedSessions: number;
};

export type FlipDistribution = {
  flipCount: number;
  sessions: number;
  percentage: number;
};

export type FunnelStep = {
  step: string;
  sessions: number;
  percentage: number;
  dropoff: number;
};

export type ReadSpreadCTR = {
  eligible: number;
  clicked: number;
  ctr: number;
};

export type TimeToFirstFlip = {
  averageMs: number;
  medianMs: number;
};

export type DeviceBreakdown = {
  mobile: number;
  desktop: number;
  mobilePercentage: number;
  desktopPercentage: number;
};

export type DailySessionCount = {
  date: string;
  count: number;
};

export type BehaviorStats = {
  sessionStats: SessionStats;
  flipDistribution: FlipDistribution[];
  funnelData: FunnelStep[];
  readSpreadCTR: ReadSpreadCTR;
  timeToFirstFlip: TimeToFirstFlip;
  deviceBreakdown: DeviceBreakdown;
  dailySessions: DailySessionCount[];
};

/**
 * Get ALL behavior stats in minimal DB round-trips.
 *
 * Previous: 12 sequential queries × ~85ms round-trip = ~1050ms
 * Now: 4 queries × ~85ms = ~340ms
 *
 * Query 1: All single-row aggregate counts (session, device, CTR, funnel conversion)
 * Query 2: Flip distribution (home sessions) + funnel flip thresholds
 * Query 3: Time to first flip (DISTINCT ON)
 * Query 4: Daily session counts (GROUP BY date)
 */
export async function getAllBehaviorStats(days: number = DEFAULT_DAYS): Promise<BehaviorStats> {
  const cutoff = getDateCutoff(days);
  // ISO string for raw SQL queries (Date objects fail with Drizzle db.execute)
  const cutoffIso = cutoff.toISOString();

  // ── Query 1: All single-row counts in one table scan ──
  const q1 = db.execute<{
    total_sessions: number;
    engaged_sessions: number;
    spread_ready: number;
    read_spread_click: number;
    conversion: number;
    mobile: number;
    desktop: number;
    home_sessions: number;
  }>(sql`
    SELECT
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'session_start')::int AS total_sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'card_flip')::int AS engaged_sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'spread_ready')::int AS spread_ready,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'read_spread_click')::int AS read_spread_click,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name IN ('read_spread_click', 'talk_click', 'card_detail_click'))::int AS conversion,
      COUNT(*) FILTER (WHERE event_name = 'session_start' AND (properties::jsonb ->> 'device_class') = 'mobile')::int AS mobile,
      COUNT(*) FILTER (WHERE event_name = 'session_start' AND (properties::jsonb ->> 'device_class') IS DISTINCT FROM 'mobile')::int AS desktop,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'session_start' AND ((properties::jsonb ->> 'landing_page') = '/' OR (properties::jsonb ->> 'landing_page') IS NULL))::int AS home_sessions
    FROM behavior_events
    WHERE created_at >= ${cutoffIso}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);

  // ── Query 2: Flip distribution + funnel thresholds (CTE-based) ──
  const q2 = db.execute<{
    first_flip: number;
    second_flip: number;
    third_flip: number;
    flip_0: number;
    flip_1: number;
    flip_2: number;
    flip_3: number;
  }>(sql`
    WITH session_flips AS (
      SELECT session_id, COUNT(*)::int AS flip_count
      FROM behavior_events
      WHERE event_name = 'card_flip'
        AND created_at >= ${cutoffIso}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
      GROUP BY session_id
    ),
    home_sessions AS (
      SELECT DISTINCT session_id
      FROM behavior_events
      WHERE event_name = 'session_start'
        AND created_at >= ${cutoffIso}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND ((properties::jsonb ->> 'landing_page') = '/' OR (properties::jsonb ->> 'landing_page') IS NULL)
    ),
    home_flip_dist AS (
      SELECT COALESCE(LEAST(sf.flip_count, 3), 0)::int AS bucket
      FROM home_sessions hs
      LEFT JOIN session_flips sf ON sf.session_id = hs.session_id
    )
    SELECT
      COUNT(*) FILTER (WHERE sf.flip_count >= 1)::int AS first_flip,
      COUNT(*) FILTER (WHERE sf.flip_count >= 2)::int AS second_flip,
      COUNT(*) FILTER (WHERE sf.flip_count >= 3)::int AS third_flip,
      (SELECT COUNT(*)::int FROM home_flip_dist WHERE bucket = 0) AS flip_0,
      (SELECT COUNT(*)::int FROM home_flip_dist WHERE bucket = 1) AS flip_1,
      (SELECT COUNT(*)::int FROM home_flip_dist WHERE bucket = 2) AS flip_2,
      (SELECT COUNT(*)::int FROM home_flip_dist WHERE bucket = 3) AS flip_3
    FROM session_flips sf
  `);

  // ── Query 3: Time to first flip ──
  const q3 = db.execute<{ elapsed_ms: number }>(sql`
    SELECT elapsed_ms FROM (
      SELECT DISTINCT ON (session_id)
        ((properties::jsonb ->> 'elapsed_ms')::int) AS elapsed_ms
      FROM behavior_events
      WHERE event_name = 'card_flip'
        AND created_at >= ${cutoffIso}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND (properties::jsonb ->> 'cards_revealed_count') = '1'
        AND (properties::jsonb ->> 'elapsed_ms') IS NOT NULL
      ORDER BY session_id, timestamp ASC
    ) first_flips
    WHERE elapsed_ms > 0
  `);

  // ── Query 4: Daily session counts ──
  const q4 = db
    .select({
      date: sql<string>`DATE(${behaviorEvents.createdAt})`.as('date'),
      count: countDistinct(behaviorEvents.sessionId),
    })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    )
    .groupBy(sql`DATE(${behaviorEvents.createdAt})`)
    .orderBy(sql`DATE(${behaviorEvents.createdAt})`);

  // Execute all 4 queries (they queue on max:1 pool, but only 4 round-trips)
  const [countsResult, flipsResult, firstFlipResult, dailyResult] = await Promise.all([q1, q2, q3, q4]);

  // ── Assemble results ──
  const counts = countsResult[0];
  const totalSessions = Number(counts?.total_sessions ?? 0);
  const engagedSessions = Number(counts?.engaged_sessions ?? 0);
  const mobile = Number(counts?.mobile ?? 0);
  const desktop = Number(counts?.desktop ?? 0);
  const deviceTotal = mobile + desktop;
  const homeSessions = Number(counts?.home_sessions ?? 0);

  const flips = flipsResult[0];
  const firstFlip = Number(flips?.first_flip ?? 0);
  const secondFlip = Number(flips?.second_flip ?? 0);
  const thirdFlip = Number(flips?.third_flip ?? 0);

  // Session stats
  const sessionStats: SessionStats = {
    totalSessions,
    engagedSessions,
    bounceRate: totalSessions > 0
      ? ((totalSessions - engagedSessions) / totalSessions) * 100
      : 0,
  };

  // Flip distribution (home sessions)
  const distribution = [
    Number(flips?.flip_0 ?? 0),
    Number(flips?.flip_1 ?? 0),
    Number(flips?.flip_2 ?? 0),
    Number(flips?.flip_3 ?? 0),
  ];
  const flipDistribution: FlipDistribution[] = distribution.map((sessions, flipCount) => ({
    flipCount,
    sessions,
    percentage: homeSessions > 0 ? (sessions / homeSessions) * 100 : 0,
  }));

  // Funnel data
  const landed = totalSessions;
  const converted = Number(counts?.conversion ?? 0);
  const funnelSteps = [
    { step: 'Landed', sessions: landed },
    { step: '1st Flip', sessions: firstFlip },
    { step: '2nd Flip', sessions: secondFlip },
    { step: '3rd Flip', sessions: thirdFlip },
    { step: 'Conversion', sessions: converted },
  ];
  const funnelData: FunnelStep[] = funnelSteps.map((s, i) => {
    const prev = i > 0 ? funnelSteps[i - 1].sessions : s.sessions;
    return {
      ...s,
      percentage: landed > 0 ? (s.sessions / landed) * 100 : 0,
      dropoff: prev > 0 ? ((prev - s.sessions) / prev) * 100 : 0,
    };
  });

  // Read Spread CTR
  const eligible = Number(counts?.spread_ready ?? 0);
  const clicked = Number(counts?.read_spread_click ?? 0);
  const readSpreadCTR: ReadSpreadCTR = {
    eligible,
    clicked,
    ctr: eligible > 0 ? (clicked / eligible) * 100 : 0,
  };

  // Device breakdown
  const deviceBreakdown: DeviceBreakdown = {
    mobile,
    desktop,
    mobilePercentage: deviceTotal > 0 ? (mobile / deviceTotal) * 100 : 0,
    desktopPercentage: deviceTotal > 0 ? (desktop / deviceTotal) * 100 : 0,
  };

  // Time to first flip
  const times: number[] = firstFlipResult.map(r => Number(r.elapsed_ms));
  let averageMs = 0;
  let medianMs = 0;
  if (times.length > 0) {
    averageMs = times.reduce((a, b) => a + b, 0) / times.length;
    times.sort((a, b) => a - b);
    const mid = Math.floor(times.length / 2);
    medianMs = times.length % 2 === 0
      ? (times[mid - 1] + times[mid]) / 2
      : times[mid];
  }
  const timeToFirstFlip: TimeToFirstFlip = { averageMs, medianMs };

  // Daily sessions
  const dailySessions: DailySessionCount[] = dailyResult.map(row => ({
    date: String(row.date),
    count: row.count,
  }));

  return {
    sessionStats,
    flipDistribution,
    funnelData,
    readSpreadCTR,
    timeToFirstFlip,
    deviceBreakdown,
    dailySessions,
  };
}
