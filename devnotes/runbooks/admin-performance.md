# Admin Portal Diagnostics Runbook

**Last updated:** Mar 4, 2026 (v1.6.7)

A practical guide for diagnosing admin portal performance issues. Written after the v1.6.7 incident where 11 of 12 API routes silently timed out.

---

## Quick Start: "The Admin Portal Is Slow"

### Step 1: Run the Diagnostics Script

Open browser DevTools console on any `https://tarottalks.app/admin/*` page and paste:

```js
fetch('/admin-diagnostics.js').then(r => r.text()).then(eval)
```

Or paste the contents of `public/admin-diagnostics.js` directly.

**What to look for:**
- **25/26 PASS** is the healthy baseline (Calendar always "fails" — it needs a `?week=` param)
- **TIMEOUT** = route exceeded 35s, something is hanging
- **FAIL** = route returned an error (read the error hint)
- **SLOW** (>2s) = working but degraded

### Step 2: Hit the Health Check

```
https://tarottalks.app/api/admin/health
```

This tests:
- DB connectivity (SELECT 1)
- Table access (COUNT on cards and behavior_events)
- Index existence (checks for `idx_events_name_created`)
- Query plan (EXPLAIN ANALYZE on a behavior query)

**Healthy output:** `"status": "ok"`, total <500ms, index shows in diagnostics.

### Step 3: If Behavior Queries Are Suspect

```
https://tarottalks.app/api/admin/health/behavior-debug
```

Runs each behavior query individually with timing. If all pass here but `/api/admin/behavior` times out, the issue is likely **stale Vercel builds** (see below).

---

## The Three Traps (What Went Wrong in v1.6.7)

### Trap 1: Drizzle ORM Silently Hangs on Date Objects

**The bug:** Passing a JavaScript `Date` object as a parameter to Drizzle's `db.execute(sql`...`)` or even `gte(column, dateObject)` causes the query to **hang forever**. No error. No timeout. Just silence until Vercel kills the function.

**Why it's insidious:** It works fine in some contexts (e.g., `apiUsageEvents` table) but hangs on others (e.g., `behaviorEvents`). There's no consistent error message to Google.

**The fix:** Always convert Date objects to ISO strings before passing to Drizzle:

```ts
// BAD - may silently hang
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
db.execute(sql`SELECT * FROM events WHERE created_at >= ${cutoff}`);
gte(behaviorEvents.createdAt, cutoff)

// GOOD - always works
const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
db.execute(sql`SELECT * FROM events WHERE created_at >= ${cutoffIso}`);
sql`${behaviorEvents.createdAt} >= ${cutoffIso}`
```

**How to check:** Search for Date objects being passed directly into SQL:
```bash
grep -rn "new Date" lib/db/queries/
# Look for any Date() result passed directly into sql`` or gte()/lte()
```

### Trap 2: Vercel Function Timeouts

**The bug:** Vercel Hobby plan defaults to **10 seconds** per serverless function. Admin routes with cold starts + DB connection setup can exceed this, especially if the DB pool needs to initialize.

**The fix:** All admin API routes now have `export const maxDuration = 30` at the top of the file. Max allowed on Hobby is 60s.

**How to check:** If you add a new admin API route, make sure it includes:
```ts
export const maxDuration = 30;
```

Routes that have this today:
- `app/api/admin/behavior/route.ts`
- `app/api/admin/api-usage/route.ts`
- `app/api/admin/api-usage/logs/route.ts`
- `app/api/admin/platform-usage/route.ts`
- `app/api/admin/validation/route.ts`
- `app/api/admin/social-shares/route.ts`
- `app/api/admin/social-shares/unposted/route.ts`
- `app/api/admin/mentions/route.ts`
- `app/api/admin/spreads/stats/route.ts`
- `app/api/admin/platform-style/route.ts`
- `app/api/admin/content-assistant/brand-config/route.ts`
- `app/api/admin/health/route.ts` (60s)
- `app/api/admin/health/behavior-debug/route.ts` (60s)

### Trap 3: Stale Vercel Function Builds

**The bug:** After deploying new code, Vercel can still serve **cached old function code** from a previous build. Your fix is deployed but not running. This is the most confusing one — you'll see the new code in the repo, the deployment succeeded, but the endpoint behaves like old code.

**How to detect:** The behavior and platform-usage routes include version headers:
```
X-Version: 2026-03-04-v3
X-Timing-Ms: 76
```

Check these in DevTools Network tab. If `X-Version` is missing or old, Vercel is serving stale code.

**How to fix:**
1. Hit the specific endpoint URL directly in a new tab (forces Vercel to rebuild that function)
2. Or trigger a fresh deployment (Vercel dashboard → Deployments → Redeploy)

### Trap 4: Promise.all Timeout Starvation on max:1 Pool (v1.7.0)

**The bug:** The connection pool is `max: 1`. When `Promise.all` submits 4 queries, they serialize through the single connection. But all 4 timeout clocks start simultaneously at `t=0`. If query 1 takes 5s, query 2 only has 3s left on its 8s timer before it even starts running — queries 3-4 have even less. They timeout waiting in the queue, not because they're slow.

**Symptoms:** Route returns partial data (first query succeeds, rest return fallback zeros) or 504 timeout. behavior-debug passes because it runs queries sequentially.

**The fix (applied in v1.7.0):**
- Changed `Promise.all` to sequential `await` in `admin-behavior.ts` and `admin-platform-usage.ts`
- On `max: 1`, `Promise.all` was never truly parallel — sequential gives each query its own fresh timeout window
- Added `withTimeout()` wrappers (10s for behavior, 8s for platform-usage) so no single query can hang the route

**Rule:** On a `max: 1` pool, never use `Promise.all` with per-query timeouts — use sequential execution instead.

---

## Database Health Checklist

If queries are slow (not hanging), check these:

### Index: `idx_events_name_created`

The critical composite index for all behavior queries. Verify it exists:

```sql
-- Run in Supabase SQL Editor
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'behavior_events';
```

Expected: `idx_events_name_created` on `(event_name, created_at DESC)`

If missing, recreate:
```sql
CREATE INDEX IF NOT EXISTS idx_events_name_created
  ON behavior_events(event_name, created_at DESC);
```

### Table Size

The health endpoint reports row counts. As of v1.6.7, `behavior_events` had ~1,164 rows. If this grows to 100K+, the queries may need further optimization (pagination, materialized views, etc.).

### Connection Pool

The app uses `max: 1` connection per serverless instance with pgbouncer (`prepare: false`). Queries queue on a single connection per function invocation. This is correct for Supabase + Vercel serverless. Don't increase `max` — it will exhaust pgbouncer's pool.

---

## Patterns to Avoid in Admin Queries

| Pattern | Problem | Use Instead |
|---------|---------|-------------|
| `gte(col, new Date())` | May silently hang | `sql\`col >= ${date.toISOString()}\`` |
| `LIKE '%keyword%'` | Full table scan | `col::jsonb ->> 'key'` for JSON fields |
| Fetch all rows → filter in JS | Transfers entire dataset | Filter/aggregate in SQL |
| Missing `maxDuration` export | 10s timeout on Vercel Hobby | `export const maxDuration = 30` |

---

## Diagnostic Endpoints Reference

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `/api/admin/health` | DB connectivity, index check, EXPLAIN | First thing when admin is slow |
| `/api/admin/health/behavior-debug` | Individual query timing | When behavior page specifically hangs |
| `/admin-diagnostics.js` | All 26 endpoints tested | Full portal health check |

---

## Timeline: How v1.6.7 Was Diagnosed

For future reference, this is how the debugging unfolded:

1. **Symptom:** Admin pages loading forever, blank content areas
2. **Diagnostics script:** 13/25 passing — all DB-backed API routes failing
3. **Added `maxDuration = 30`:** Jumped to 23/26 — most routes just needed more time
4. **Health check:** DB is fine, 1,164 rows, index exists, queries run in <1ms
5. **Behavior-debug:** All queries complete in 258ms individually — not a query problem
6. **Root cause found:** Two remaining routes had Drizzle Date object bugs causing infinite hangs
7. **Fixed Date bugs, deployed:** Still 23/26 — stale Vercel builds serving old code!
8. **Hit endpoints directly:** Forced Vercel rebuild → 25/26 passing, avg 149ms

Key lesson: **the problem had three layers** (timeout limits, Date serialization, stale builds). Fixing just one wouldn't have solved it. The diagnostic tools let us isolate each layer independently.
