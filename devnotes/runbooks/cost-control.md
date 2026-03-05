# Cost Control Runbook

**Last updated:** Mar 5, 2026

How to monitor costs, diagnose spikes, and pull emergency levers. TarotTALKS runs on free/low-cost tiers across multiple services.

---

## Weekly Audit (5 minutes)

Run this every Monday or whenever you're checking in on the project.

### 1. Vercel Usage
- Dashboard > Usage tab
- Check: Function Execution, Image Optimization, Bandwidth
- **Red flag:** Image Optimization > 0 (should be disabled on most routes)
- **Red flag:** Function Execution spike (compare to previous week)

### 2. Supabase Usage
- Dashboard > Settings > Usage
- Check: Database Size (free tier: 500MB), Egress bandwidth
- **Red flag:** Egress climbing fast (image serving, API calls)

### 3. Gemini API Costs
- Check via admin: `https://tarottalks.app/admin` (API Usage section)
- Or run in Supabase SQL Editor:
```sql
SELECT api_name, COUNT(*), SUM(cost_usd)::numeric(10,4) as total_cost
FROM api_usage_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY api_name
ORDER BY total_cost DESC;
```

### 4. YouTube Quota
- Google Cloud Console > APIs & Services > YouTube Data API v3 > Quotas
- Free tier: 10,000 units/day
- **Red flag:** Approaching daily limit consistently

---

## Service Cost Map

| Service | Free Tier Limit | Cost Driver | Circuit Breaker |
|---------|----------------|-------------|-----------------|
| **Vercel** | 100GB bandwidth, 100hrs functions | Function execution, image optimization | ISR caching, `unoptimized` images |
| **Supabase** | 500MB DB, 2GB egress | Storage, API calls, egress | Image proxy, query caching |
| **Gemini** | 15 RPM (free), $88/mo budget (paid) | Input/output tokens | `gemini.ts` daily budget check |
| **YouTube** | 10,000 units/day | Search & video metadata calls | Quota tracking (no hard cap) |
| **Replicate** | None (pay per use) | GPU time for upscaling | **NONE — risk area** |

---

## Diagnosing a Cost Spike

### Vercel spike?
1. Check Usage tab — which metric is high?
2. **Function Execution high:** Check if listing pages are still SSR (`revalidate = 0`). Check for missing ISR on detail pages.
3. **Image Optimization high:** Search codebase for `<Image>` without `unoptimized`. Should be disabled on high-traffic routes.
4. **Bandwidth high:** Check if Supabase images are being proxied through Vercel instead of served directly.

### Supabase spike?
1. Check egress — are images being served from Supabase instead of CDN?
2. Check DB size — has `behavior_events` or `api_usage_events` grown large?
3. Cleanup query:
```sql
-- Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Gemini spike?
1. Check `https://tarottalks.app/admin` API Usage section
2. Circuit breaker should auto-disable at daily limit
3. Config is in `lib/services/gemini.ts`

---

## Emergency Cost Cuts

If you need to reduce costs immediately:

### Level 1: Quick (no code changes)
- Pause Vercel deployment (stops new function invocations)
- Disable Gemini budget in env var (set daily limit to 0)

### Level 2: Code changes
- Set ALL image components to `unoptimized={true}` in `next.config.ts`
- Increase ISR `revalidate` times (less frequent regeneration)
- Disable Replicate upscaling calls

### Level 3: Nuclear
- Disable AI features entirely (comment out Gemini calls)
- Set all pages to static with manual rebuild
- Disable Bluesky cron job

---

## Caching Architecture (Current)

| Route Type | Cache Strategy | Duration |
|------------|---------------|----------|
| Card/Talk/Theme detail pages | ISR | 1-24 hours |
| Card/Talk/Theme listing pages | SSR (no cache) | Every request |
| OG/Twitter images | ISR | 24 hours |
| Instagram images | No cache | On-demand |
| Search API | CDN cache | 60s + 5min stale |
| Admin pages | No cache | Every request |
| Behavior API | CDN cache | 5min + 1min stale |

**Known issue:** Listing pages (`/cards`, `/talks`, `/themes`) still SSR every request because ISR triggers build-time rendering that times out on Supabase queries. See `devnotes/vercel-optimizations-feb-2026.md` for details and possible fixes.

---

## File Reference

| File | Purpose |
|------|---------|
| `devnotes/cost-control-workflow.md` | Original cost strategy doc |
| `devnotes/vercel-optimizations-feb-2026.md` | Vercel optimization details |
| `devnotes/Image Optimization Cost Elimination Plan.md` | Image cost reduction plan |
| `lib/services/gemini.ts` | Gemini circuit breaker |
| `lib/db/queries/api-usage.ts` | API usage tracking |
| `next.config.ts` | Image optimization settings |
