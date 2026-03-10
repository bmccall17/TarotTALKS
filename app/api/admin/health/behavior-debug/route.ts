import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { behaviorEvents } from '@/lib/db/schema';
import { sql, countDistinct, eq, and } from 'drizzle-orm';

export const maxDuration = 60;

/**
 * GET /api/admin/health/behavior-debug
 * Runs each behavior query individually to find which one hangs.
 */
export async function GET() {
  const routeStart = Date.now();
  const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timings: Record<string, number> = {};
  const results: Record<string, unknown> = {};

  try {
    // Q1: Aggregate counts (raw SQL)
    const t1 = Date.now();
    const r1 = await db.execute<{ total_sessions: number }>(sql`
      SELECT
        COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'session_start')::int AS total_sessions,
        COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'card_flip')::int AS engaged_sessions
      FROM behavior_events
      WHERE created_at >= ${cutoffIso}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    `);
    timings.q1_aggregates = Date.now() - t1;
    results.q1 = r1[0];

    // Q2: Flip distribution CTE (raw SQL)
    const t2 = Date.now();
    const r2 = await db.execute<{ first_flip: number }>(sql`
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
    timings.q2_flips = Date.now() - t2;
    results.q2 = r2[0];

    // Q3: Time to first flip (raw SQL)
    const t3 = Date.now();
    const r3 = await db.execute<{ elapsed_ms: number }>(sql`
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
    timings.q3_firstFlip = Date.now() - t3;
    results.q3_count = r3.length;

    // Q4: Daily session counts (Drizzle query builder - NO Date objects)
    const t4 = Date.now();
    const r4 = await db
      .select({
        date: sql<string>`DATE(${behaviorEvents.createdAt})`.as('date'),
        count: countDistinct(behaviorEvents.sessionId),
      })
      .from(behaviorEvents)
      .where(
        and(
          eq(behaviorEvents.eventName, 'session_start'),
          sql`${behaviorEvents.createdAt} >= ${cutoffIso}`,
          sql`(${behaviorEvents.properties})::jsonb ->> 'is_test' IS DISTINCT FROM 'true'`
        )
      )
      .groupBy(sql`DATE(${behaviorEvents.createdAt})`)
      .orderBy(sql`DATE(${behaviorEvents.createdAt})`);
    timings.q4_daily = Date.now() - t4;
    results.q4_rows = r4.length;

    // Q5: All 4 via Promise.all (like the actual route does)
    const t5 = Date.now();
    await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS c FROM behavior_events WHERE created_at >= ${cutoffIso}`),
      db.execute(sql`SELECT COUNT(*)::int AS c FROM behavior_events WHERE event_name = 'card_flip' AND created_at >= ${cutoffIso}`),
      db.execute(sql`SELECT COUNT(*)::int AS c FROM behavior_events WHERE event_name = 'session_start' AND created_at >= ${cutoffIso}`),
      db.select({ count: countDistinct(behaviorEvents.sessionId) }).from(behaviorEvents).where(sql`created_at >= ${cutoffIso}`),
    ]);
    timings.q5_promiseAll = Date.now() - t5;

    return NextResponse.json({
      status: 'ok',
      totalMs: Date.now() - routeStart,
      timings,
      results,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timings,
      results,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    }, { status: 500 });
  }
}
