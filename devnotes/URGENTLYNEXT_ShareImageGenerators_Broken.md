# URGENTLY NEXT: ShareImageGenerators Broken After Thumbnail Migration

**Status:** BROKEN - Needs proper fix next sprint
**Date:** 2026-02-05
**Priority:** URGENT

## User Summary

> "we broke the ShareImageGenerators…. after migrating the upscaled images to webp… now the ShareImageGenerators have totally freaked out and are not loading the new upscaled images when running the image generation… and its totally crashing and solving the wrong problems with ducttape fixes. fuck!!!!"

---

## What We Were Trying To Do

1. Upscale all talk thumbnails using AI (Real-ESRGAN via Replicate)
2. Convert them to WebP format for better quality/size
3. Store them in Supabase `talk-thumbnails` bucket
4. Have the ShareImageGenerators use the new upscaled images

## What Went Wrong

### The Chain of Failures:

1. **Initial Problem:** After running `scripts/upscale-existing-thumbnails.ts`, the talk thumbnails were successfully stored in Supabase with URLs like:
   ```
   https://[project].supabase.co/storage/v1/object/public/talk-thumbnails/[id].webp
   ```

2. **Misdiagnosis #1:** Assumed Satori couldn't fetch cross-origin images from Supabase, so added `fetchImageAsDataUrl()` to convert ALL images to base64 data URLs.

3. **Result:** This BROKE the card images too (which were working fine with direct URLs).

4. **Misdiagnosis #2:** Tried to apply fetchImageAsDataUrl to both card AND talk images.

5. **Result:** Everything broke - the admin share-images page showed broken images everywhere.

6. **Partial Revert:** Reverted card share image generators to original (direct URLs), kept talk generators with fetchImageAsDataUrl.

7. **Current State:** Card images might work, talk images still broken. The whole thing is unstable.

---

## Files Modified (Potentially Broken)

### Talk Share Image Generators (MODIFIED - may be broken):
- `app/talks/[slug]/opengraph-image.tsx`
- `app/talks/[slug]/twitter-image.tsx`
- `app/talks/[slug]/instagram/route.tsx`

### Card Share Image Generators (REVERTED - should be OK):
- `app/cards/[slug]/opengraph-image.tsx`
- `app/cards/[slug]/twitter-image.tsx`
- `app/cards/[slug]/instagram/route.tsx`

### New Files Created:
- `lib/utils/og-image-helpers.ts` - fetchImageAsDataUrl and normalizeImageUrl functions
- `lib/services/replicate-upscale.ts` - AI upscaling service

### Scripts:
- `scripts/upscale-existing-thumbnails.ts` - The migration script that started all this

---

## Rollback Options

### Option 1: Full Git Rollback (SAFEST)
Rollback to commit BEFORE any share image changes:

```bash
# Commit history (newest first):
# 53d3d33 - 3 talk share image generators now convert talk thumbnails to data URLs
# ae29d13 - reverting image creators back to direct URL strings
# a7e314d - shareimage: both images are fetched in parallel
# 861ef30 - pointing shareimage generators to new upscaled images! <-- FIRST CHANGE
# c9ae2e6 - added "scripts/**/*" to the exclude array in tsconfig.json
# 48f4852 - upscaller migration... but realized its not for quality... yet!
# 60e0955 - v1.5.4 notes
# 70100ee - phase 2-4 Platform Style Learning System <-- SAFE ROLLBACK POINT

# To see what was changed:
git diff 70100ee HEAD -- app/talks/[slug]/ app/cards/[slug]/
```

**Recommended rollback point:** `70100ee` (phase 2-4 Platform Style Learning System - BEFORE any share image changes)

### Option 2: Revert Share Image Files Only
```bash
git checkout 70100ee -- \
  app/talks/[slug]/opengraph-image.tsx \
  app/talks/[slug]/twitter-image.tsx \
  app/talks/[slug]/instagram/route.tsx \
  app/cards/[slug]/opengraph-image.tsx \
  app/cards/[slug]/twitter-image.tsx \
  app/cards/[slug]/instagram/route.tsx
```

### Option 3: Revert Thumbnail URLs in Database (LAST RESORT)
If rollback + original share image code still doesn't work, could revert the database `thumbnail_url` values to use YouTube fallback:
```sql
-- This would make getThumbnailUrl() fall back to YouTube
UPDATE talks SET thumbnail_url = NULL WHERE thumbnail_url LIKE '%supabase%';
```
**Note:** This loses the upscaled images but gets things working again. The upscaled WebP files would still exist in Supabase storage for later use.

---

## The REAL Problem to Solve

The core issue is: **Why can't Satori fetch from the `talk-thumbnails` Supabase bucket?**

Possible causes to investigate:
1. **Bucket permissions:** Is `talk-thumbnails` bucket set to public?
2. **CORS settings:** Does the bucket have proper CORS headers?
3. **WebP format:** Does Satori have issues with WebP specifically?
4. **Vercel runtime:** Is there something about Vercel's serverless runtime that blocks Supabase?

**Key observation:** Card images from `card-images` bucket work with direct URLs. Why don't talk thumbnails from `talk-thumbnails` bucket?

---

## Proper Fix Strategy (Next Sprint)

1. **First:** Rollback to known working state (`70100ee`)
2. **Then:** Test if original share images work with YouTube thumbnails
3. **Investigate:** Why `card-images` bucket works but `talk-thumbnails` doesn't
4. **Compare:** Bucket settings, CORS, permissions between the two buckets
5. **Fix the root cause** instead of adding data URL conversion workarounds
6. **Only then:** Re-run the thumbnail migration if needed

---

## Key Learnings

1. **Don't assume the problem** - The Satori cross-origin issue was a red herring
2. **Card images worked fine** with direct Supabase URLs, so the issue is specific to `talk-thumbnails` bucket
3. **fetchImageAsDataUrl() is a workaround**, not a fix - it adds latency and complexity
4. **Test incrementally** - Should have tested one talk first, not changed all 6 files at once

---

## Files to Review

```
lib/utils/og-image-helpers.ts     # New utility - may not be needed if root cause is fixed
lib/utils/thumbnails.ts           # getThumbnailUrl - works correctly
scripts/upscale-existing-thumbnails.ts  # Migration script - worked correctly
```

---

## Current State Summary

| Component | Status |
|-----------|--------|
| Thumbnail upscaling script | ✅ Works |
| Thumbnails in Supabase | ✅ Uploaded |
| Database URLs updated | ✅ Correct |
| Card share images | ⚠️ Reverted, probably OK |
| Talk share images | ❌ BROKEN |
| Overall share image system | ❌ UNSTABLE |

---

## Next Steps

1. **DO NOT DEPLOY** current state to production if not already deployed
2. Rollback to `70100ee` for share image files
3. Investigate Supabase bucket permissions/CORS
4. Fix root cause, then re-apply thumbnail migration properly
