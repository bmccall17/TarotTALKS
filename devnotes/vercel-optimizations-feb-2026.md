# Vercel Usage Reduction & Optimization (Feb 2026)

## Context
We investigated a spike in Vercel paid service usage (specifically "Function Execution" and "Source Image" optimization) that began around Jan 29th.

## Identified Issues
1.  **Dynamic OpenGraph Images**: The `opengraph-image.tsx` was configured with `revalidate = 0` (no caching). This meant every link share or bot crawl triggered a serverless function execution and image generation, leading to high usage.
2.  **Speed Insights**: This was enabled globally in `layout.tsx`, contributing to usage limits without critical benefit.

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

## Action Items
- Monitor Vercel usage for the next 24-48 hours to confirm the spike subsides.
- If specific admin route build errors persist (e.g., `/api/admin/cards/[id]`), they are unrelated to these changes and need separate investigation.
