# Vercel Usage Reduction & Optimization (Feb 2026)

## Context
We investigated a spike in Vercel paid service usage (specifically "Function Execution", "Source Image" optimization, and "Fast Origin Transfer") that began around Jan 29th.
We need to investigate the issue, identify all the locations where these functions are called and then make a plan for alternatives so they are called minimally and within the monthly limits!

## Identified Issues
1.  **Dynamic OpenGraph Images**: The `opengraph-image.tsx` was configured with `revalidate = 0` (no caching). This meant every link share or bot crawl triggered a serverless function execution and image generation, leading to high usage.
2.  ALREADY TURNED THIS OFF **Speed Insights**: This was enabled globally in `layout.tsx`, contributing to usage limits without critical benefit. 

## Applied Fixes

### 1. Cached OpenGraph Images
**File**: `app/talks/[slug]/opengraph-image.tsx`
- **Change**: Set `revalidate = 86400` (24 hours).
- **Impact**: Images are now cached by Vercel for 24 hours. This drastically reduces function invocations from social bots and link previews.

```typescript
export const runtime = 'nodejs';
export const revalidate = 86400; // Cache for 24 hours
```

### 2. Disabled Speed Insights
**File**: `app/layout.tsx`
- **Change**: Commented out `<SpeedInsights />`.
- **Status**: `<AnalyticsProvider />` remains **enabled** (as it does not incur the same cost penalties), but Speed Insights is disabled to save on usage.

```tsx
        <InstallBanner />
        <BottomNav />
        <AnalyticsProvider />      {/* Kept Enabled */}
        {/* <SpeedInsights /> */}  {/* Disabled to save costs */}
      </body>
```

---

## Phase 2 Implementation (Feb 6, 2026)

Full optimization pass across all remaining uncached routes.

### Applied: Phase 1 — OG/Twitter Image Caching (5 files)
All dynamic image routes now have `revalidate = 86400` (24h cache):
- `app/cards/[slug]/opengraph-image.tsx`
- `app/cards/[slug]/twitter-image.tsx`
- `app/talks/[slug]/twitter-image.tsx`
- `app/spreads/[id]/opengraph-image.tsx`
- `app/spreads/[id]/twitter-image.tsx`

Instagram routes intentionally left uncached for admin rendering flexibility.

### Applied: Phase 2 — Detail Pages ISR (3 `[slug]` pages)
Switched from `revalidate = 0` (SSR every request) to ISR:
- `app/cards/[slug]/page.tsx` → `revalidate = 86400` (24h)
- `app/talks/[slug]/page.tsx` → `revalidate = 3600` (1h)
- `app/themes/[slug]/page.tsx` → `revalidate = 86400` (24h)

Also emptied `generateStaticParams()` in all three files (returns `[]`) so nothing pre-renders at build time — pages generate on first request, then ISR caches them.

### Applied: Phase 3 — Search API Cache Headers
- `app/api/search/route.ts` → `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

---

## KNOWN WORKAROUND: Listing Pages Still SSR (revalidate = 0)

**Status:** UNRESOLVED — needs revisit

**Files affected:**
- `app/cards/page.tsx` — still `revalidate = 0`
- `app/talks/page.tsx` — still `revalidate = 0`
- `app/themes/page.tsx` — still `revalidate = 0`

**What happened:** The original plan called for caching these at 24h/1h ISR. When deployed, Vercel's build failed because:
1. Listing pages are NOT dynamic routes (no `[slug]`)
2. With `revalidate > 0`, Next.js MUST pre-render them at build time
3. The `getAllCards()`/`getAllTalks()`/`getAllThemes()` queries hit Supabase during the build
4. Supabase queries exceeded Vercel's 60-second build function timeout

**Why this didn't affect `[slug]` pages:** We emptied `generateStaticParams()` so those pages skip build-time rendering and generate on-demand. Listing pages don't have that escape hatch — they're non-dynamic routes that Next.js always tries to pre-render under ISR.

**Current impact:** These 3 pages remain SSR (function execution on every visit). They're lightweight grid/list pages (no image generation), so the cost is lower than the OG image routes, but it's still unnecessary function execution.

**Possible future fixes to explore:**
1. **`unstable_cache` wrapper** — Cache the DB query results server-side (e.g., `unstable_cache(getAllTalks, ['all-talks'], { revalidate: 3600 })`). Page stays SSR but the expensive DB call is cached.
2. **Vercel build timeout increase** — Check if the Vercel plan allows longer build function timeouts (Pro allows custom config).
3. **Supabase connection pooling / edge** — Faster DB connection from Vercel's build environment might bring queries under 60s.
4. **Static export with revalidation webhook** — Pre-build a static JSON snapshot, rebuild on-demand via admin action.

**Test script:** `bash scripts/test-vercel-optimization.sh` — currently tests pass with `revalidate = 0` for listing pages. When a fix is found, update both the code AND the test expectations.

---

## Action Items
- Monitor Vercel usage for the next 24-48 hours to confirm the spike subsides.
- If specific admin route build errors persist (e.g., `/api/admin/cards/[id]`), they are unrelated to these changes and need separate investigation.
- **REVISIT:** Listing page caching workaround (see above). Check if `unstable_cache` or build config changes can resolve the timeout.
