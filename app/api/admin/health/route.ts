import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/admin/health
 * DB health check + behavior_events diagnostics.
 */
export const maxDuration = 60;

export async function GET() {
  const start = Date.now();
  const timings: Record<string, number> = {};
  const diagnostics: Record<string, unknown> = {};

  try {
    // Test 1: Simple SELECT 1
    const t1 = Date.now();
    const ping = await db.execute<{ ok: number }>(sql`SELECT 1 AS ok`);
    timings.select1 = Date.now() - t1;

    // Test 2: Count cards
    const t2 = Date.now();
    const countResult = await db.execute<{ cnt: number }>(sql`SELECT COUNT(*)::int AS cnt FROM cards`);
    timings.countCards = Date.now() - t2;

    // Test 3: Count behavior_events total
    const t3 = Date.now();
    const beTotal = await db.execute<{ cnt: number }>(sql`SELECT COUNT(*)::int AS cnt FROM behavior_events`);
    timings.countBehaviorEvents = Date.now() - t3;
    diagnostics.behaviorEventsTotal = beTotal[0]?.cnt;

    // Test 4: Count behavior_events in last 7 days (uses index)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const t4 = Date.now();
    const be7d = await db.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM behavior_events WHERE created_at >= ${cutoff}
    `);
    timings.countBehavior7d = Date.now() - t4;
    diagnostics.behaviorEvents7d = be7d[0]?.cnt;

    // Test 5: Count with event_name + created_at (composite index pattern)
    const t5 = Date.now();
    const beIdx = await db.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM behavior_events
      WHERE event_name = 'session_start' AND created_at >= ${cutoff}
    `);
    timings.countSessionStart7d = Date.now() - t5;
    diagnostics.sessionStart7d = beIdx[0]?.cnt;

    // Test 6: The exact problematic pattern — COUNT DISTINCT + JSON extraction
    const t6 = Date.now();
    const beJson = await db.execute<{ cnt: number }>(sql`
      SELECT COUNT(DISTINCT session_id)::int AS cnt
      FROM behavior_events
      WHERE event_name = 'session_start'
        AND created_at >= ${cutoff}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    `);
    timings.countDistinctWithJson = Date.now() - t6;
    diagnostics.sessionsExclTest = beJson[0]?.cnt;

    // Test 7: Check which indexes exist on behavior_events
    const indexes = await db.execute<{ indexname: string; indexdef: string }>(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'behavior_events'
      ORDER BY indexname
    `);
    diagnostics.indexes = indexes.map(i => ({ name: i.indexname, def: i.indexdef }));

    // Test 8: EXPLAIN the slow query pattern (first few lines)
    const t8 = Date.now();
    const explain = await db.execute<{ 'QUERY PLAN': string }>(sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT COUNT(DISTINCT session_id)::int AS cnt
      FROM behavior_events
      WHERE event_name = 'session_start'
        AND created_at >= ${cutoff}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    `);
    timings.explainAnalyze = Date.now() - t8;
    diagnostics.queryPlan = explain.map(r => r['QUERY PLAN']);

    return NextResponse.json({
      status: 'ok',
      totalMs: Date.now() - start,
      timings,
      diagnostics,
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      totalMs: Date.now() - start,
      timings,
      diagnostics,
      error: error instanceof Error ? error.message : String(error),
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      },
    }, { status: 500 });
  }
}
