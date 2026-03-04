/**
 * Admin Portal Performance Diagnostic Script
 *
 * Runs against the live Supabase DB to measure:
 * 1. Connection latency
 * 2. Table row counts
 * 3. Existing indexes on key tables
 * 4. EXPLAIN ANALYZE on actual admin queries
 * 5. End-to-end timing of each query function
 *
 * Usage: npx tsx scripts/diagnose-admin-perf.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import postgres from 'postgres';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('No POSTGRES_URL or DATABASE_URL found in .env.local');
  process.exit(1);
}

const sql = postgres(connectionString, {
  prepare: false,
  connect_timeout: 10,
  max: 1,
});

// Utility: time a query and return [result, durationMs]
async function timed<T>(label: string, fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  return [result, ms];
}

function header(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function row(label: string, value: string | number, warn?: boolean) {
  const flag = warn ? ' ⚠️' : '';
  console.log(`  ${label.padEnd(40)} ${String(value).padStart(10)}${flag}`);
}

async function main() {
  console.log('🔍 Admin Portal Performance Diagnostics');
  console.log(`   Time: ${new Date().toISOString()}`);

  // ──────────────────────────────────────────────
  // 1. Connection latency
  // ──────────────────────────────────────────────
  header('1. CONNECTION LATENCY');

  const [, connectMs] = await timed('connect', () => sql`SELECT 1 as ok`);
  row('Initial connection', `${connectMs}ms`, connectMs > 2000);

  // Warm connection - measure pure query round-trip
  const [, pingMs] = await timed('ping', () => sql`SELECT 1 as ok`);
  row('Warm ping (SELECT 1)', `${pingMs}ms`, pingMs > 100);

  // ──────────────────────────────────────────────
  // 2. Table row counts
  // ──────────────────────────────────────────────
  header('2. TABLE ROW COUNTS');

  const tables = ['behavior_events', 'api_usage_events', 'cards', 'talks', 'card_talk_mappings', 'themes', 'social_shares'];
  for (const table of tables) {
    const [result, ms] = await timed(table, () =>
      sql.unsafe(`SELECT COUNT(*)::int as cnt FROM ${table}`)
    );
    const cnt = result[0]?.cnt ?? '?';
    row(`${table}`, `${cnt} rows (${ms}ms)`, ms > 1000);
  }

  // ──────────────────────────────────────────────
  // 3. Existing indexes on key tables
  // ──────────────────────────────────────────────
  header('3. INDEXES ON behavior_events');

  const [beIndexes] = await timed('indexes', () => sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'behavior_events'
    ORDER BY indexname
  `);
  for (const idx of beIndexes) {
    console.log(`  📌 ${idx.indexname}`);
    console.log(`     ${idx.indexdef}`);
  }

  header('3b. INDEXES ON api_usage_events');

  const [apiIndexes] = await timed('indexes', () => sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'api_usage_events'
    ORDER BY indexname
  `);
  for (const idx of apiIndexes) {
    console.log(`  📌 ${idx.indexname}`);
    console.log(`     ${idx.indexdef}`);
  }

  // ──────────────────────────────────────────────
  // 4. EXPLAIN ANALYZE on actual admin queries
  // ──────────────────────────────────────────────
  header('4. EXPLAIN ANALYZE — Key Queries');

  const cutoff7d = new Date();
  cutoff7d.setDate(cutoff7d.getDate() - 7);

  // Query A: Session count (the most basic behavior query)
  console.log('\n  --- Query A: Session count (7d) ---');
  const [explainA, msA] = await timed('session_count', () => sql`
    EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT)
    SELECT COUNT(DISTINCT session_id)
    FROM behavior_events
    WHERE event_name = 'session_start'
      AND created_at >= ${cutoff7d}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  for (const line of explainA) {
    console.log(`    ${line['QUERY PLAN']}`);
  }
  row('Total time', `${msA}ms`, msA > 500);

  // Query B: Device breakdown (new SQL version)
  console.log('\n  --- Query B: Device breakdown (7d) ---');
  const [explainB, msB] = await timed('device_breakdown', () => sql`
    EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT)
    SELECT
      COUNT(*) FILTER (WHERE properties::jsonb ->> 'device_class' = 'mobile')::int AS mobile,
      COUNT(*) FILTER (WHERE properties::jsonb ->> 'device_class' IS DISTINCT FROM 'mobile')::int AS desktop
    FROM behavior_events
    WHERE event_name = 'session_start'
      AND created_at >= ${cutoff7d}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  for (const line of explainB) {
    console.log(`    ${line['QUERY PLAN']}`);
  }
  row('Total time', `${msB}ms`, msB > 500);

  // Query C: API health (consolidated)
  console.log('\n  --- Query C: API health - gemini (7d) ---');
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  const [explainC, msC] = await timed('api_health', () => sql`
    EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT)
    SELECT
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE success = true)::int AS successful_calls,
      COUNT(*) FILTER (WHERE error_type = 'rate_limit')::int AS rate_limit_hits,
      COUNT(*) FILTER (WHERE error_type = 'quota_exceeded')::int AS quota_exceeded_hits,
      COUNT(*) FILTER (WHERE success = false AND created_at >= ${oneHourAgo})::int AS recent_errors
    FROM api_usage_events
    WHERE api_name = 'gemini'
      AND created_at >= ${cutoff7d}
  `);
  for (const line of explainC) {
    console.log(`    ${line['QUERY PLAN']}`);
  }
  row('Total time', `${msC}ms`, msC > 500);

  // Query D: The old LIKE pattern (for comparison)
  console.log('\n  --- Query D: OLD LIKE pattern (comparison) ---');
  const [explainD, msD] = await timed('old_like', () => sql`
    EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT)
    SELECT COUNT(DISTINCT session_id)
    FROM behavior_events
    WHERE event_name = 'session_start'
      AND created_at >= ${cutoff7d}
      AND NOT (properties LIKE '%"is_test":true%')
  `);
  for (const line of explainD) {
    console.log(`    ${line['QUERY PLAN']}`);
  }
  row('Total time', `${msD}ms`, msD > 500);

  // Query E: Flip distribution CTE
  console.log('\n  --- Query E: Flip distribution CTE (7d) ---');
  const [explainE, msE] = await timed('flip_dist', () => sql`
    EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT)
    WITH home_sessions AS (
      SELECT DISTINCT session_id
      FROM behavior_events
      WHERE event_name = 'session_start'
        AND created_at >= ${cutoff7d}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND (properties::jsonb ->> 'landing_page' = '/' OR properties::jsonb ->> 'landing_page' IS NULL)
    ),
    flip_counts AS (
      SELECT hs.session_id, LEAST(COUNT(be.id), 3) AS flips
      FROM home_sessions hs
      LEFT JOIN behavior_events be
        ON be.session_id = hs.session_id
        AND be.event_name = 'card_flip'
        AND be.created_at >= ${cutoff7d}
        AND (be.properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
      GROUP BY hs.session_id
    )
    SELECT flips AS flip_bucket, COUNT(*)::int AS session_count
    FROM flip_counts
    GROUP BY flips
    ORDER BY flips
  `);
  for (const line of explainE) {
    console.log(`    ${line['QUERY PLAN']}`);
  }
  row('Total time', `${msE}ms`, msE > 1000);

  // Query F: pg_database_size (dashboard uses this)
  console.log('\n  --- Query F: pg_database_size ---');
  const [explainF, msF] = await timed('db_size', async () => {
    try {
      return await sql`SELECT pg_database_size(current_database()) as size_bytes`;
    } catch (e) {
      return [{ size_bytes: 'FAILED', error: String(e) }];
    }
  });
  console.log(`    Result: ${JSON.stringify(explainF[0])}`);
  row('Total time', `${msF}ms`, msF > 2000);

  // Query G: pg_stat_user_tables row counts (dashboard uses this)
  console.log('\n  --- Query G: pg_stat_user_tables ---');
  const [explainG, msG] = await timed('row_counts', async () => {
    try {
      return await sql`
        SELECT relname as name, n_live_tup as count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
      `;
    } catch (e) {
      return [{ error: String(e) }];
    }
  });
  console.log(`    Result: ${JSON.stringify(explainG.slice(0, 5))}...`);
  row('Total time', `${msG}ms`, msG > 2000);

  // ──────────────────────────────────────────────
  // 5. End-to-end timing of full function equivalents
  // ──────────────────────────────────────────────
  header('5. SIMULATED FULL PAGE LOADS');

  // Simulate behavior page: all 7 queries that getAllBehaviorStats runs
  console.log('\n  --- Behavior page (sequential) ---');
  const behaviorStart = performance.now();

  const [, t1] = await timed('getSessionStats', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getSessionStats (q1)', `${t1}ms`);

  const [, t1b] = await timed('getSessionStats engaged', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name = 'card_flip' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getSessionStats (q2)', `${t1b}ms`);

  const [, t2] = await timed('getFlipDistribution count', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    AND (properties::jsonb ->> 'landing_page' = '/' OR properties::jsonb ->> 'landing_page' IS NULL)
  `);
  row('getFlipDistribution (q1)', `${t2}ms`);

  const [, t2b] = await timed('getFlipDistribution CTE', () => sql`
    WITH home_sessions AS (
      SELECT DISTINCT session_id FROM behavior_events
      WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
      AND (properties::jsonb ->> 'landing_page' = '/' OR properties::jsonb ->> 'landing_page' IS NULL)
    ),
    flip_counts AS (
      SELECT hs.session_id, LEAST(COUNT(be.id), 3) AS flips
      FROM home_sessions hs
      LEFT JOIN behavior_events be ON be.session_id = hs.session_id
        AND be.event_name = 'card_flip' AND be.created_at >= ${cutoff7d}
        AND (be.properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
      GROUP BY hs.session_id
    )
    SELECT flips AS flip_bucket, COUNT(*)::int AS session_count
    FROM flip_counts GROUP BY flips ORDER BY flips
  `);
  row('getFlipDistribution (q2 CTE)', `${t2b}ms`);

  const [, t3] = await timed('getFunnelData landed', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getFunnelData (q1)', `${t3}ms`);

  const [, t3b] = await timed('getFunnelData flips', () => sql`
    SELECT session_id, COUNT(id) as flip_count FROM behavior_events
    WHERE event_name = 'card_flip' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    GROUP BY session_id
  `);
  row('getFunnelData (q2)', `${t3b}ms`);

  const [, t3c] = await timed('getFunnelData conversion', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name IN ('read_spread_click', 'talk_click', 'card_detail_click')
    AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getFunnelData (q3)', `${t3c}ms`);

  const [, t4] = await timed('getReadSpreadCTR eligible', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name = 'spread_ready' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getReadSpreadCTR (q1)', `${t4}ms`);

  const [, t4b] = await timed('getReadSpreadCTR clicked', () => sql`
    SELECT COUNT(DISTINCT session_id) FROM behavior_events
    WHERE event_name = 'read_spread_click' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getReadSpreadCTR (q2)', `${t4b}ms`);

  const [, t5] = await timed('getTimeToFirstFlip', () => sql`
    SELECT elapsed_ms FROM (
      SELECT DISTINCT ON (session_id)
        ((properties::jsonb ->> 'elapsed_ms')::int) AS elapsed_ms
      FROM behavior_events
      WHERE event_name = 'card_flip'
        AND created_at >= ${cutoff7d}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND (properties::jsonb ->> 'cards_revealed_count') = '1'
        AND (properties::jsonb ->> 'elapsed_ms') IS NOT NULL
      ORDER BY session_id, timestamp ASC
    ) first_flips WHERE elapsed_ms > 0
  `);
  row('getTimeToFirstFlip', `${t5}ms`);

  const [, t6] = await timed('getDeviceBreakdown', () => sql`
    SELECT
      COUNT(*) FILTER (WHERE properties::jsonb ->> 'device_class' = 'mobile')::int AS mobile,
      COUNT(*) FILTER (WHERE properties::jsonb ->> 'device_class' IS DISTINCT FROM 'mobile')::int AS desktop
    FROM behavior_events
    WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('getDeviceBreakdown', `${t6}ms`);

  const [, t7] = await timed('getDailySessionCounts', () => sql`
    SELECT DATE(created_at) as date, COUNT(DISTINCT session_id) as count
    FROM behavior_events
    WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    GROUP BY DATE(created_at) ORDER BY DATE(created_at)
  `);
  row('getDailySessionCounts', `${t7}ms`);

  const behaviorTotal = Math.round(performance.now() - behaviorStart);
  console.log(`\n  📊 BEHAVIOR PAGE TOTAL (sequential): ${behaviorTotal}ms`);
  row('Target', '<500ms', behaviorTotal > 500);

  // Simulate api-usage queries
  console.log('\n  --- API Usage page ---');
  const apiStart = performance.now();

  const [, a1] = await timed('gemini health', () => sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE success = true)::int AS ok
    FROM api_usage_events WHERE api_name = 'gemini' AND created_at >= ${cutoff7d}
  `);
  row('getApiHealthStatus(gemini)', `${a1}ms`);

  const [, a2] = await timed('youtube health', () => sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE success = true)::int AS ok
    FROM api_usage_events WHERE api_name = 'youtube' AND created_at >= ${cutoff7d}
  `);
  row('getApiHealthStatus(youtube)', `${a2}ms`);

  const [, a3] = await timed('attribution', () => sql`
    SELECT COUNT(*) FILTER (WHERE api_name = 'gemini')::int AS g,
           COUNT(*) FILTER (WHERE api_name = 'youtube')::int AS y
    FROM api_usage_events WHERE source = 'spread_reading' AND created_at >= ${cutoff7d}
  `);
  row('getReadSpreadAttribution', `${a3}ms`);

  const apiTotal = Math.round(performance.now() - apiStart);
  console.log(`\n  📊 API USAGE TOTAL: ${apiTotal}ms`);

  // Simulate dashboard SSR queries
  console.log('\n  --- Dashboard SSR queries ---');
  const dashStart = performance.now();

  const [, d1] = await timed('cards count', () => sql`SELECT COUNT(*)::int FROM cards`);
  row('count(cards)', `${d1}ms`);

  const [, d2] = await timed('mappings count', () => sql`SELECT COUNT(*)::int FROM card_talk_mappings`);
  row('count(card_talk_mappings)', `${d2}ms`);

  const [, d3] = await timed('themes count', () => sql`SELECT COUNT(*)::int FROM themes`);
  row('count(themes)', `${d3}ms`);

  const [, d4] = await timed('talks stats', () => sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE is_deleted = true)::int as deleted,
      COUNT(*) FILTER (WHERE youtube_url IS NOT NULL)::int as with_yt,
      COUNT(*) FILTER (WHERE thumbnail_url IS NULL AND is_deleted = false)::int as no_thumb
    FROM talks
  `);
  row('getTalksStats (consolidated)', `${d4}ms`);

  const [, d5] = await timed('unmapped cards', () => sql`
    SELECT COUNT(*)::int FROM cards WHERE NOT EXISTS (
      SELECT 1 FROM card_talk_mappings WHERE card_talk_mappings.card_id = cards.id AND is_primary = true
    )
  `);
  row('cards without primary mapping', `${d5}ms`);

  const [, d6] = await timed('unmapped talks', () => sql`
    SELECT COUNT(*)::int FROM talks WHERE is_deleted = false AND NOT EXISTS (
      SELECT 1 FROM card_talk_mappings WHERE card_talk_mappings.talk_id = talks.id
    )
  `);
  row('unmapped talks', `${d6}ms`);

  const [, d7] = await timed('db_size', async () => {
    try { return await sql`SELECT pg_database_size(current_database())`; }
    catch { return [{ error: 'failed' }]; }
  });
  row('pg_database_size', `${d7}ms`, d7 > 2000);

  const [, d8] = await timed('row_counts', async () => {
    try { return await sql`SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public'`; }
    catch { return [{ error: 'failed' }]; }
  });
  row('pg_stat_user_tables', `${d8}ms`, d8 > 2000);

  const [, d9] = await timed('session_trend today', () => sql`
    SELECT COUNT(DISTINCT session_id)::int FROM behavior_events
    WHERE event_name = 'session_start'
    AND created_at >= ${new Date(new Date().setHours(0,0,0,0))}
    AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('sessionTrend (today)', `${d9}ms`);

  const dashTotal = Math.round(performance.now() - dashStart);
  console.log(`\n  📊 DASHBOARD SSR TOTAL (OLD — ${9} sequential queries): ${dashTotal}ms`);
  row('Target', '<2000ms', dashTotal > 2000);

  // ──────────────────────────────────────────────
  // 6. NEW CONSOLIDATED QUERY PATTERNS
  // ──────────────────────────────────────────────
  header('6. NEW CONSOLIDATED PATTERNS');

  // Behavior page: 4 queries instead of 12
  console.log('\n  --- Behavior page (NEW — 4 queries) ---');
  const newBehStart = performance.now();

  const [, nb1] = await timed('Q1: all counts', () => sql`
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
    WHERE created_at >= ${cutoff7d}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
  `);
  row('Q1: all counts (single scan)', `${nb1}ms`);

  const [, nb2] = await timed('Q2: flips + funnel', () => sql`
    WITH session_flips AS (
      SELECT session_id, COUNT(*)::int AS flip_count
      FROM behavior_events
      WHERE event_name = 'card_flip' AND created_at >= ${cutoff7d}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
      GROUP BY session_id
    ),
    home_sessions AS (
      SELECT DISTINCT session_id FROM behavior_events
      WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND ((properties::jsonb ->> 'landing_page') = '/' OR (properties::jsonb ->> 'landing_page') IS NULL)
    ),
    home_flip_dist AS (
      SELECT COALESCE(LEAST(sf.flip_count, 3), 0)::int AS bucket
      FROM home_sessions hs LEFT JOIN session_flips sf ON sf.session_id = hs.session_id
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
  row('Q2: flips + funnel CTE', `${nb2}ms`);

  const [, nb3] = await timed('Q3: time to first flip', () => sql`
    SELECT elapsed_ms FROM (
      SELECT DISTINCT ON (session_id)
        ((properties::jsonb ->> 'elapsed_ms')::int) AS elapsed_ms
      FROM behavior_events
      WHERE event_name = 'card_flip' AND created_at >= ${cutoff7d}
        AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
        AND (properties::jsonb ->> 'cards_revealed_count') = '1'
        AND (properties::jsonb ->> 'elapsed_ms') IS NOT NULL
      ORDER BY session_id, timestamp ASC
    ) first_flips WHERE elapsed_ms > 0
  `);
  row('Q3: time to first flip', `${nb3}ms`);

  const [, nb4] = await timed('Q4: daily sessions', () => sql`
    SELECT DATE(created_at) as date, COUNT(DISTINCT session_id)::int as count
    FROM behavior_events
    WHERE event_name = 'session_start' AND created_at >= ${cutoff7d}
      AND (properties::jsonb ->> 'is_test' IS DISTINCT FROM 'true')
    GROUP BY DATE(created_at) ORDER BY DATE(created_at)
  `);
  row('Q4: daily sessions', `${nb4}ms`);

  const newBehTotal = Math.round(performance.now() - newBehStart);
  console.log(`\n  📊 BEHAVIOR PAGE (NEW — 4 queries): ${newBehTotal}ms`);
  row('Improvement', `${behaviorTotal}ms → ${newBehTotal}ms (${Math.round((1 - newBehTotal / behaviorTotal) * 100)}% faster)`);

  // Dashboard: 1 mega query + 3 functions
  console.log('\n  --- Dashboard (NEW — 1 mega query) ---');
  const newDashStart = performance.now();

  const [, nd1] = await timed('mega counts', () => sql`
    SELECT
      (SELECT COUNT(*)::int FROM cards) AS cards_count,
      (SELECT COUNT(*)::int FROM card_talk_mappings) AS mappings_count,
      (SELECT COUNT(*)::int FROM card_talk_mappings WHERE is_primary = true) AS primary_mappings,
      (SELECT COUNT(*)::int FROM themes) AS themes_count,
      (SELECT COUNT(*)::int FROM card_themes) AS card_themes_count,
      (SELECT COUNT(*)::int FROM talk_themes) AS talk_themes_count,
      (SELECT COUNT(*)::int FROM cards WHERE NOT EXISTS (
        SELECT 1 FROM card_talk_mappings WHERE card_talk_mappings.card_id = cards.id AND is_primary = true
      )) AS cards_without_primary,
      (SELECT COUNT(*)::int FROM talks WHERE is_deleted = false AND NOT EXISTS (
        SELECT 1 FROM card_talk_mappings WHERE card_talk_mappings.talk_id = talks.id
      )) AS unmapped_talks
  `);
  row('Mega query (8 subselects)', `${nd1}ms`);

  const [, nd2] = await timed('talks stats', () => sql`
    SELECT
      COUNT(*) FILTER (WHERE is_deleted = false)::int AS total,
      COUNT(*) FILTER (WHERE is_deleted = true)::int AS deleted,
      COUNT(*) FILTER (WHERE is_deleted = false AND youtube_video_id IS NOT NULL)::int AS with_youtube,
      COUNT(*) FILTER (WHERE is_deleted = false AND thumbnail_url IS NULL)::int AS without_thumbnail
    FROM talks
  `);
  row('getTalksStats (1 query)', `${nd2}ms`);

  const newDashTotal = Math.round(performance.now() - newDashStart);
  console.log(`\n  📊 DASHBOARD (NEW — 2 queries shown): ${newDashTotal}ms`);
  row('Improvement', `${dashTotal}ms → ${newDashTotal}ms (${Math.round((1 - newDashTotal / dashTotal) * 100)}% faster)`);

  // ──────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────
  header('SUMMARY');
  row('Connection latency', `${pingMs}ms`);
  row('Behavior OLD (12 queries)', `${behaviorTotal}ms`, behaviorTotal > 500);
  row('Behavior NEW (4 queries)', `${newBehTotal}ms`, newBehTotal > 500);
  row('Dashboard OLD (9 queries)', `${dashTotal}ms`, dashTotal > 2000);
  row('Dashboard NEW (2 queries)', `${newDashTotal}ms`, newDashTotal > 500);
  row('API usage (all queries)', `${apiTotal}ms`, apiTotal > 300);

  console.log('\n  Key: ⚠️ = exceeds target threshold\n');

  await sql.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
