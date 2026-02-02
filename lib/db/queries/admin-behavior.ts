import { db } from '@/lib/db';
import { behaviorEvents } from '@/lib/db/schema';
import { sql, count, countDistinct, max, and, gte, eq, not, like } from 'drizzle-orm';

// Default time range: 7 days
const DEFAULT_DAYS = 7;

function getDateCutoff(days: number = DEFAULT_DAYS): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

// Filter condition to exclude test events (where properties contains "is_test":true)
function excludeTestEvents() {
  return not(like(behaviorEvents.properties, '%"is_test":true%'));
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

  // Get all sessions that started on the home page in the time range (excluding test events)
  // We only count home page sessions because only they have the card flip ritual
  const allSessionsResult = await db
    .select({
      sessionId: behaviorEvents.sessionId,
      properties: behaviorEvents.properties,
    })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    )
    .groupBy(behaviorEvents.sessionId, behaviorEvents.properties);

  // Filter to only home page landings
  const homePageSessions = allSessionsResult.filter(row => {
    try {
      const props = JSON.parse(row.properties ?? '{}');
      // Home page is "/" - exclude direct landings on /cards/*, /talks/*, etc.
      return props.landing_page === '/' || props.landing_page === undefined;
    } catch {
      // Include sessions without valid JSON (legacy data before landing_page was added)
      return true;
    }
  });

  const totalSessions = homePageSessions.length;

  if (totalSessions === 0) {
    return [
      { flipCount: 0, sessions: 0, percentage: 0 },
      { flipCount: 1, sessions: 0, percentage: 0 },
      { flipCount: 2, sessions: 0, percentage: 0 },
      { flipCount: 3, sessions: 0, percentage: 0 },
    ];
  }

  // Get max flips per session (excluding test events)
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

  // Build map of session -> flip count
  const sessionFlips = new Map<string, number>();
  for (const row of flipCountsResult) {
    // Cap at 3 since we only have 3 cards
    sessionFlips.set(row.sessionId, Math.min(row.flipCount, 3));
  }

  // Count sessions by flip count (only home page sessions)
  const distribution = [0, 0, 0, 0]; // indices 0, 1, 2, 3

  for (const session of homePageSessions) {
    const flips = sessionFlips.get(session.sessionId) ?? 0;
    distribution[flips]++;
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

  // Get first flip elapsed_ms for each session (excluding test events)
  const result = await db
    .select({
      sessionId: behaviorEvents.sessionId,
      properties: behaviorEvents.properties,
    })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'card_flip'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    )
    .orderBy(behaviorEvents.timestamp);

  // Extract elapsed_ms from first flip per session
  const sessionFirstFlip = new Map<string, number>();

  for (const row of result) {
    if (sessionFirstFlip.has(row.sessionId)) continue; // Already have first flip

    try {
      const props = JSON.parse(row.properties ?? '{}');
      if (props.cards_revealed_count === 1 && typeof props.elapsed_ms === 'number') {
        sessionFirstFlip.set(row.sessionId, props.elapsed_ms);
      }
    } catch {
      // Skip invalid JSON
    }
  }

  const times = Array.from(sessionFirstFlip.values()).filter(t => t > 0);

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

  // Get session_start events with device_class (excluding test events)
  const result = await db
    .select({
      sessionId: behaviorEvents.sessionId,
      properties: behaviorEvents.properties,
    })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.eventName, 'session_start'),
        gte(behaviorEvents.createdAt, cutoff),
        excludeTestEvents()
      )
    );

  let mobile = 0;
  let desktop = 0;

  for (const row of result) {
    try {
      const props = JSON.parse(row.properties ?? '{}');
      if (props.device_class === 'mobile') {
        mobile++;
      } else {
        desktop++;
      }
    } catch {
      desktop++; // Default to desktop on parse error
    }
  }

  const total = mobile + desktop;

  return {
    mobile,
    desktop,
    mobilePercentage: total > 0 ? (mobile / total) * 100 : 0,
    desktopPercentage: total > 0 ? (desktop / total) * 100 : 0,
  };
}

// Combined function to get all behavior stats in one call
export type BehaviorStats = {
  sessionStats: SessionStats;
  flipDistribution: FlipDistribution[];
  funnelData: FunnelStep[];
  readSpreadCTR: ReadSpreadCTR;
  timeToFirstFlip: TimeToFirstFlip;
  deviceBreakdown: DeviceBreakdown;
};

export async function getAllBehaviorStats(days: number = DEFAULT_DAYS): Promise<BehaviorStats> {
  const [
    sessionStats,
    flipDistribution,
    funnelData,
    readSpreadCTR,
    timeToFirstFlip,
    deviceBreakdown,
  ] = await Promise.all([
    getSessionStats(days),
    getFlipDistribution(days),
    getFunnelData(days),
    getReadSpreadCTR(days),
    getTimeToFirstFlip(days),
    getDeviceBreakdown(days),
  ]);

  return {
    sessionStats,
    flipDistribution,
    funnelData,
    readSpreadCTR,
    timeToFirstFlip,
    deviceBreakdown,
  };
}
