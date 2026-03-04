import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/admin/health
 * Minimal DB health check — tests if the Drizzle DB connection works from API routes.
 * Returns timing info for diagnosis.
 */
export async function GET() {
  const start = Date.now();
  const timings: Record<string, number> = {};

  try {
    // Test 1: Simple SELECT 1 (no tables, no params)
    const t1 = Date.now();
    const ping = await db.execute<{ ok: number }>(sql`SELECT 1 AS ok`);
    timings.select1 = Date.now() - t1;

    // Test 2: Count from a small table (cards = 78 rows)
    const t2 = Date.now();
    const countResult = await db.execute<{ cnt: number }>(sql`SELECT COUNT(*)::int AS cnt FROM cards`);
    timings.countCards = Date.now() - t2;

    // Test 3: Query with ISO string date param (the pattern that was failing)
    const t3 = Date.now();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateResult = await db.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM behavior_events WHERE created_at >= ${cutoff}
    `);
    timings.dateQuery = Date.now() - t3;

    return NextResponse.json({
      status: 'ok',
      totalMs: Date.now() - start,
      timings,
      results: {
        ping: ping[0]?.ok,
        cards: countResult[0]?.cnt,
        recentEvents: dateResult[0]?.cnt,
      },
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
      error: error instanceof Error ? error.message : String(error),
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      },
    }, { status: 500 });
  }
}
