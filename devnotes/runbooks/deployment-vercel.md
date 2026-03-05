# Deployment & Vercel Runbook

**Last updated:** Mar 5, 2026

How Vercel deployment works, common pitfalls, and configuration reference.

---

## Deployment Basics

- **Platform:** Vercel (Hobby plan)
- **Framework:** Next.js (App Router)
- **Deploy method:** Git push to main (auto-deploy)
- **Domain:** https://tarottalks.app

---

## Vercel Hobby Plan Limits

| Resource | Limit |
|----------|-------|
| Function timeout (default) | **10 seconds** |
| Function timeout (max with `maxDuration`) | **60 seconds** |
| Build timeout | 60 seconds per function |
| Bandwidth | 100 GB/month |
| Function execution | 100 hours/month |
| Image optimization | 1,000 source images/month |

---

## The `maxDuration` Requirement

Vercel Hobby defaults to **10 seconds** per serverless function. Any route that touches the database on cold start can exceed this.

**Every admin API route must have:**
```ts
export const maxDuration = 30; // seconds
```

At the top of the route file, as a module-level export. If you create a new admin API route, add this or it will timeout.

Current routes with `maxDuration = 30`:
- All `/api/admin/*` routes
- Diagnostic routes use `maxDuration = 60`

---

## Stale Builds

**Problem:** After deploying new code, Vercel can serve cached old function code. Your fix is live in the repo but the endpoint runs old logic.

**How to detect:**
- Check `X-Version` header on behavior/platform-usage API responses
- If the header is missing or shows an old date, the build is stale

**How to fix:**
1. Hit the specific endpoint URL directly in a new browser tab (forces Vercel to rebuild that function)
2. Or: Vercel Dashboard > Deployments > Redeploy (forces full rebuild)
3. Or: Push a trivial commit to trigger a new deployment

---

## Build Failures

### Listing pages timeout during build
The `/cards`, `/talks`, `/themes` listing pages can't use ISR (`revalidate > 0`) because Next.js tries to pre-render them at build time. The Supabase queries exceed Vercel's 60-second build timeout.

**Current workaround:** These pages use `revalidate = 0` (SSR every request).

**Detail pages work** because we emptied `generateStaticParams()` so they skip build-time rendering and generate on first request.

See `devnotes/vercel-optimizations-feb-2026.md` for possible future fixes (unstable_cache, build timeout increase, etc.).

### Bluesky cron job build timeout
The Bluesky auto-refresh cron route was skipped from static generation to avoid build failures.

---

## Caching Quick Reference

### ISR (Incremental Static Regeneration)
```ts
export const revalidate = 3600; // regenerate at most every hour
```
Page is served from cache, regenerated in background when stale.

### Force-dynamic (no cache)
```ts
export const dynamic = 'force-dynamic';
// or
export const revalidate = 0;
```
Function runs on every request. Used for admin pages and listing pages.

### API response caching
```ts
return NextResponse.json(data, {
  headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
});
```
Cached at Vercel's CDN edge for 5 minutes, serves stale for 1 more minute while revalidating.

---

## Environment Variables

Managed in Vercel Dashboard > Project > Settings > Environment Variables.

Key variables:
| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | Supabase DB connection (pgbouncer) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key |
| `ADMIN_TOKEN` | Admin portal authentication |
| `YOUTUBE_API_KEY` | YouTube Data API |
| `GOOGLE_GEMINI_API_KEY` | Gemini AI |
| `REPLICATE_API_TOKEN` | Replicate image upscaling |

---

## Drizzle ORM Gotchas (Deployment-Relevant)

These cause silent failures that only show up in production:

1. **Date objects hang in SQL templates** — Always use `.toISOString()`, never pass `new Date()` directly
2. **`gte(column, dateObject)` can hang** — Use `sql\`column >= ${isoString}\`` instead
3. **`prepare: false` is required** — pgbouncer in transaction mode doesn't support prepared statements

See `devnotes/runbooks/admin-performance.md` for full details.

---

## File Reference

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js + image optimization config |
| `vercel.json` | Vercel project config (if exists) |
| `lib/db/index.ts` | Database connection setup |
| `devnotes/vercel-optimizations-feb-2026.md` | Full optimization history |
| `devnotes/runbooks/admin-performance.md` | Admin-specific performance guide |
