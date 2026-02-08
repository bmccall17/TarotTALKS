# Supabase Egress Audit: Tradeoffs & Recommendations

**Date:** 2026-02-07
**Related Audit:** `devnotes/audits/2026-02-07.md`

## 🚨 Critical Issue: High Cached Egress (212% Usage)

**Root Cause:**
The application has explicitly disabled Next.js Image Optimization via `next.config.ts`:
```typescript
images: {
  unoptimized: true, // ✅ airtight: disables Vercel/Next image optimization pipeline
}
```
Combined with frontend components (`TalksGrid`, `RitualCard`) using `<img src="...">` tags with direct Supabase Storage public URLs, this forces every user to download full-resolution images directly from Supabase's CDN.

### Option A: Enable Next.js optimization (Recommended)
Remove `unoptimized: true` and use the `<Image />` component exclusively.
*   **Pros:** Drastically reduces Supabase egress (Vercel caches the images).
*   **Cons:** Consumes Vercel "Source Images" quota (1000/month on Hobby, 5000 on Pro).
*   **Implementation:**
    1.  Remove `unoptimized: true` from `next.config.ts`.
    2.  Replace all `<img />` tags with `next/image`.
    3.  Add `loader` prop or configure `images.loader` to use Supabase Image Transformations (see Option B).

### Option B: Use Supabase Image Transformations
Use Supabase's built-in image resizing (`?width=...&quality=...`) in your URL generation.
*   **Pros:** Reduces file size sent to client -> Reduces Egress.
*   **Cons:** Increases "Storage Image Transformations" usage on Supabase (which also has a quota).
*   **Note:** Your standard tier might not include many transformations.

### Recommendation
**Immediate Action:** Switch to **Option B (Supabase Transforms)** immediately by modifying `getThumbnailUrl` and `getCardImageUrl` helpers to append `?width=400&format=webp` to the URLs. This is the safest first step that works even with `unoptimized: true`.
**Secondary Action:** Re-enable Next.js optimization (`unoptimized: false`) once you confirm you won't blow past Vercel limits.

---

## ⚠️ High Risk: Vercel Timeout (Spread Reading)

**Issue:** The `/api/spreads/spread-reading` route executes 3 external API calls sequentially:
1.  Gemini Synthesis (~2-4s)
2.  YouTube Search (~1-2s)
3.  Gemini Selection (~2-4s)
**Total:** 5-10s. Vercel Hobby timeout is 10s (Pro is 60s). This is dangerously close to the limit.

### Tradeoff: Reliability vs. Complexity
*   **Current (Sequential):** Simple logic, easy to debug. Risk of timeout.
*   **Parallel:** Run Synthesis and Search in parallel.
    *   *Problem:* The Search queries usually *depend* on the Synthesis output.
    *   *Compromise:* Kick off a speculative YouTube search (using card keywords) *in parallel* with Gemini Synthesis. If Gemini fails or is slow, you already have YouTube results ready.

### Recommendation
Refactor the route to use **Vercel AI SDK (Streaming)** or **Edge Runtime** (if compatible with your DB driver), or simply optimize the call graph to be as parallel as possible.

---

## 🛡️ Security & Reliability

1.  **Rate Limiting**:
    *   **Issue:** In-memory `Map` is used. On Vercel, every request might hit a different serverless instance, meaning the rate limit resets constantly. It offers zero real protection against DDoS.
    *   **Recommendation:** Use `@upstash/ratelimit` with Vercel KV or Upstash Redis.

2.  **API Keys**:
    *   **Issue:** Gemini key passed in URL query param.
    *   **Recommendation:** Use the Google Generative AI SDK (`@google/generative-ai`) or pass the key via `x-goog-api-key` header to keep it out of URL logs.

3.  **Content Security Policy (CSP)**:
    *   **Issue:** Missing.
    *   **Recommendation:** Add a strict CSP to `next.config.ts` headers to prevent XSS.

---

## 🧹 Housekeeping

1.  **Testing**: The project has zero tests.
    *   **Recommendation:** Install Vitest and write basic unit tests for the `lib/services` to ensure logic like "cost calculation" and "circuit breakers" actually works.

2.  **Node Version**:
    *   **Recommendation:** Add `"engines": { "node": ">=20" }` to `package.json`.
