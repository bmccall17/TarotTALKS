import { db } from '@/lib/db';
import { behaviorEvents } from '@/lib/db/schema';
import { sql, count, countDistinct, and, gte, eq } from 'drizzle-orm';

// Default time range: 7 days
const DEFAULT_DAYS = 7;

function getDateCutoff(days: number = DEFAULT_DAYS): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
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

export async function getSessionStats(days: number = DEFAULT_DAYS): Promise<SessionStats> {
  const cutoff = getDateCutoff(days);

  // Total sessions (distinct session_start events, excluding test events)
  const totalResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );

  const totalSessions = totalResult[0]?.count ?? 0;

  // Sessions with at least one card flip (engaged, excluding test events)
  const engagedResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'card_flip'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );

  const engagedSessions = engagedResult[0]?.count ?? 0;

  // Bounce rate = sessions with 0 flips / total sessions
  const bounceRate = totalSessions > 0
    ? ((totalSessions - engagedSessions) / totalSessions) * 100
    : 0;

  return {
    totalSessions,
    bounceRate,
    engagedSessions,
  };
}

export type FlipDistribution = {
  flipCount: number;
  sessions: number;
  percentage: number;
};

export async function getFlipDistribution(days: number = DEFAULT_DAYS): Promise<FlipDistribution[]> {
  const cutoff = getDateCutoff(days);

  // Get home page session IDs in SQL (filter landing_page via JSON extraction)
  const homeSessionsResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents(),
        sql`((${behaviorEvents.properties})::jsonb ->> 'landing_page' = '/' OR (${behaviorEvents.properties})::jsonb ->> 'landing_page' IS NULL)`
      )
    );

  const totalSessions = homeSessionsResult[0]?.count ?? 0;

  if (totalSessions === 0) {
    return [
      { flipCount: 0, sessions: 0, percentage: 0 },
      { flipCount: 1, sessions: 0, percentage: 0 },
      { flipCount: 2, sessions: 0, percentage: 0 },
      { flipCount: 3, sessions: 0, percentage: 0 },
    ];
  }

  // Count flips per home-page session in SQL, capped at 3
  const flipCountsResult = await db.execute<{ flip_bucket: number; session_count: number }>(sql`
    WITH home_sessions AS (
      SELECT DISTINCT session_id
      FROM behavior_events
      WHERE event_name = 'session_start'
        AND created_at >= ${cutoff}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND (properties::jsonb ->> 'landing_page' = '/' OR properties::jsonb ->> 'landing_page' IS NULL)
    ),
    flip_counts AS (
      SELECT hs.session_id, LEAST(COUNT(be.id), 3) AS flips
      FROM home_sessions hs
      LEFT JOIN behavior_events be
        ON be.session_id = hs.session_id
        AND be.event_name = 'card_flip'
        AND be.created_at >= ${cutoff}
        AND (be.properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
      GROUP BY hs.session_id
    )
    SELECT flips AS flip_bucket, COUNT(*)::int AS session_count
    FROM flip_counts
    GROUP BY flips
    ORDER BY flips
  `);

  // Build distribution array from SQL results
  const distribution = [0, 0, 0, 0];
  for (const row of flipCountsResult) {
    const bucket = Number(row.flip_bucket);
    if (bucket >= 0 && bucket <= 3) {
      distribution[bucket] = Number(row.session_count);
    }
  }

  return distribution.map((sessions, flipCount) => ({
    flipCount,
    sessions,
    percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
  }));
}

export type FunnelStep = {
  step: string;
  sessions: number;
  percentage: number;
  dropoff: number;
};

export async function getFunnelData(days: number = DEFAULT_DAYS): Promise<FunnelStep[]> {
  const cutoff = getDateCutoff(days);

  // Landed (session_start, excluding test events)
  const landedResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );
  const landed = landedResult[0]?.count ?? 0;

  // Get flip counts per session (excluding test events)
  const flipCountsResult = await db
    .select({
      sessionId: behaviorEvents.sessionId,
      flipCount: count(behaviorEvents.id),
    })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'card_flip'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    )
    .groupBy(behaviorEvents.sessionId);

  // Count sessions by flip threshold
  let firstFlip = 0;
  let secondFlip = 0;
  let thirdFlip = 0;

  for (const row of flipCountsResult) {
    if (row.flipCount >= 1) firstFlip++;
    if (row.flipCount >= 2) secondFlip++;
    if (row.flipCount >= 3) thirdFlip++;
  }

  // Conversion (read_spread_click OR talk_click, excluding test events)
  const conversionResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        sql`${behaviorEvents.eventName} IN ('read_spread_click', 'talk_click', 'card_detail_click')`,
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );
  const converted = conversionResult[0]?.count ?? 0;

  const steps = [
    { step: 'Landed', sessions: landed },
    { step: '1st Flip', sessions: firstFlip },
    { step: '2nd Flip', sessions: secondFlip },
    { step: '3rd Flip', sessions: thirdFlip },
    { step: 'Conversion', sessions: converted },
  ];

  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].sessions : s.sessions;
    return {
      ...s,
      percentage: landed > 0 ? (s.sessions / landed) * 100 : 0,
      dropoff: prev > 0 ? ((prev - s.sessions) / prev) * 100 : 0,
    };
  });
}

export type ReadSpreadCTR = {
  eligible: number;
  clicked: number;
  ctr: number;
};

export async function getReadSpreadCTR(days: number = DEFAULT_DAYS): Promise<ReadSpreadCTR> {
  const cutoff = getDateCutoff(days);

  // Eligible = sessions with spread_ready event (excluding test events)
  const eligibleResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'spread_ready'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );
  const eligible = eligibleResult[0]?.count ?? 0;

  // Clicked = sessions with read_spread_click event (excluding test events)
  const clickedResult = await db
    .select({ count: countDistinct(behaviorEvents.sessionId) })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'read_spread_click'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );
  const clicked = clickedResult[0]?.count ?? 0;

  return {
    eligible,
    clicked,
    ctr: eligible > 0 ? (clicked / eligible) * 100 : 0,
  };
}

export type TimeToFirstFlip = {
  averageMs: number;
  medianMs: number;
};

export async function getTimeToFirstFlip(days: number = DEFAULT_DAYS): Promise<TimeToFirstFlip> {
  const cutoff = getDateCutoff(days);

  // Extract elapsed_ms for first flips directly in SQL using DISTINCT ON
  const result = await db.execute<{ elapsed_ms: number }>(sql`
    SELECT elapsed_ms FROM (
      SELECT DISTINCT ON (session_id)
        ((properties::jsonb ->> 'elapsed_ms')::int) AS elapsed_ms
      FROM behavior_events
      WHERE event_name = 'card_flip'
        AND created_at >= ${cutoff}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND (properties::jsonb ->> 'cards_revealed_count') = '1'
        AND (properties::jsonb ->> 'elapsed_ms') IS NOT NULL
      ORDER BY session_id, timestamp ASC
    ) first_flips
    WHERE elapsed_ms > 0
  `);

  const times: number[] = result.map(r => Number(r.elapsed_ms));

  if (times.length === 0) {
    return { averageMs: 0, medianMs: 0 };
  }

  // Average
  const averageMs = times.reduce((a, b) => a + b, 0) / times.length;

  // Median
  times.sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  const medianMs = times.length % 2 === 0
    ? (times[mid - 1] + times[mid]) / 2
    : times[mid];

  return { averageMs, medianMs };
}

export type DeviceBreakdown = {
  mobile: number;
  desktop: number;
  mobilePercentage: number;
  desktopPercentage: number;
};

export async function getDeviceBreakdown(days: number = DEFAULT_DAYS): Promise<DeviceBreakdown> {
  const cutoff = getDateCutoff(days);

  // Count device classes directly in SQL using FILTER
  const result = await db.execute<{ mobile: number; desktop: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE properties::jsonb ->> 'device_class' = 'mobile')::int AS mobile,
      COUNT(*) FILTER (WHERE properties::jsonb ->> 'device_class' IS DISTINCT FROM 'mobile')::int AS desktop
    FROM behavior_events
    WHERE event_name = 'session_start'
      AND created_at >= ${cutoff}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);

  const mobile = Number(result[0]?.mobile ?? 0);
  const desktop = Number(result[0]?.desktop ?? 0);
  const total = mobile + desktop;

  return {
    mobile,
    desktop,
    mobilePercentage: total > 0 ? (mobile / total) * 100 : 0,
    desktopPercentage: total > 0 ? (desktop / total) * 100 : 0,
  };
}

// Daily session counts for traffic chart
export type DailySessionCount = {
  date: string;
  count: number;
};

export async function getDailySessionCounts(days: number = DEFAULT_DAYS): Promise<DailySessionCount[]> {
  const cutoff = getDateCutoff(days);

  const result = await db
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

  return result.map(row => ({
    date: String(row.date),
    count: row.count,
  }));
}

// Combined function to get all behavior stats in one call
export type BehaviorStats = {
  sessionStats: SessionStats;
  flipDistribution: FlipDistribution[];
  funnelData: FunnelStep[];
  readSpreadCTR: ReadSpreadCTR;
  timeToFirstFlip: TimeToFirstFlip;
  deviceBreakdown: DeviceBreakdown;
  dailySessions: DailySessionCount[];
};

export async function getAllBehaviorStats(days: number = DEFAULT_DAYS): Promise<BehaviorStats> {
  const [
    sessionStats,
    flipDistribution,
    funnelData,
    readSpreadCTR,
    timeToFirstFlip,
    deviceBreakdown,
    dailySessions,
  ] = await Promise.all([
    getSessionStats(days),
    getFlipDistribution(days),
    getFunnelData(days),
    getReadSpreadCTR(days),
    getTimeToFirstFlip(days),
    getDeviceBreakdown(days),
    getDailySessionCounts(days),
  ]);

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
