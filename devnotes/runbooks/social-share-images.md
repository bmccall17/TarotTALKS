# Social Share Images Runbook

**Last updated:** Mar 5, 2026

How to diagnose and fix broken share images (OG, Twitter, Instagram).

---

## Quick Check: Are Share Images Working?

1. Go to `https://tarottalks.app/admin/share-images`
2. Click "Generate" on any card or talk
3. If the preview shows a broken/blank image, this runbook applies

External validators:
- **X/Twitter:** https://www.xcardvalidator.com/
- **Facebook:** https://developers.facebook.com/tools/debug/
- **LinkedIn:** https://www.linkedin.com/post-inspector/

---

## How Share Images Work

Share images are generated server-side using **Satori** (HTML-to-SVG) + **@resvg/resvg-js** (SVG-to-PNG).

| Route | Size | Source |
|-------|------|--------|
| `app/cards/[slug]/opengraph-image.tsx` | 1200x630 | Card data + card image |
| `app/cards/[slug]/twitter-image.tsx` | 1200x630 | Card data + card image |
| `app/cards/[slug]/instagram/route.tsx` | 1080x1080 | Card data + card image |
| `app/talks/[slug]/opengraph-image.tsx` | 1200x630 | Talk data + thumbnail |
| `app/talks/[slug]/twitter-image.tsx` | 1200x630 | Talk data + thumbnail |
| `app/talks/[slug]/instagram/route.tsx` | 1080x1080 | Talk data + thumbnail |

Images are cached via ISR (`revalidate = 86400` / 24h), except Instagram (on-demand).

---

## Common Failure: Satori Can't Fetch Images

### Symptoms
- Share image renders but with a blank/missing thumbnail area
- Or: share image generation times out entirely
- Card images work but talk images don't (or vice versa)

### Diagnosis Flowchart

```
Share image broken?
  │
  ├─ Card images work, talk images don't?
  │    └─ Likely Supabase bucket issue (see "Bucket Check" below)
  │
  ├─ ALL images broken?
  │    └─ Check if Satori/resvg dependencies changed
  │    └─ Check Vercel function timeout (need maxDuration?)
  │
  └─ Images work locally but not on Vercel?
       └─ Cross-origin fetch issue in serverless runtime
       └─ Check if fetchImageAsDataUrl() workaround is needed
```

### Bucket Check
Card images come from `card-images` bucket. Talk thumbnails come from `talk-thumbnails` bucket.

In Supabase Dashboard > Storage:
- [ ] Both buckets set to **Public**
- [ ] CORS allows requests from your domain
- [ ] Files actually exist at the URLs stored in the DB

Test a URL directly:
```
https://[project].supabase.co/storage/v1/object/public/talk-thumbnails/[filename].webp
```
If this loads in a browser, Supabase is fine. If not, fix bucket permissions.

---

## Known Issue: WebP Thumbnails + Satori

After the v1.5.5 thumbnail migration to WebP, talk share images broke. The `talk-thumbnails` bucket serves WebP files that Satori couldn't fetch cross-origin from Vercel's serverless runtime.

**Workaround in place:** `fetchImageAsDataUrl()` in `lib/utils/og-image-helpers.ts` converts images to base64 data URLs before passing to Satori. This adds latency but works.

**Root cause never fully diagnosed.** The `card-images` bucket works with direct URLs but `talk-thumbnails` doesn't. Possible causes: bucket permissions, CORS, WebP format, or Vercel runtime restrictions.

**If you want to fix it properly:**
1. Compare bucket settings between `card-images` (works) and `talk-thumbnails` (doesn't)
2. Test with a single talk image first, not all at once
3. If direct URLs work, remove the `fetchImageAsDataUrl` workaround

---

## After Changing Thumbnails or Images

If you migrate, upscale, or change image storage:

1. Test ONE share image first (single card or talk)
2. Check the admin share-images page for that item
3. If it works, test a few more before batch operations
4. Validate with external tools (X Card Validator, Facebook Debugger)
5. Remember: OG images are cached 24h by Vercel ISR — old images may persist

To force regeneration of a cached OG image, append a query param:
```
https://tarottalks.app/cards/the-tower?v=2
```

---

## Rollback

If share images are totally broken and you need to get back to working state:

1. Check `devnotes/URGENTLYNEXT_ShareImageGenerators_Broken.md` for the last known rollback point
2. The safe rollback commit was `70100ee` (before any share image changes in Feb 2026)
3. You can revert just the share image files without touching other code

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/utils/og-image-helpers.ts` | fetchImageAsDataUrl workaround |
| `lib/utils/thumbnails.ts` | getThumbnailUrl helper |
| `app/cards/[slug]/opengraph-image.tsx` | Card OG image generator |
| `app/talks/[slug]/opengraph-image.tsx` | Talk OG image generator |
| `app/admin/share-images/page.tsx` | Admin preview/generate UI |
| `devnotes/URGENTLYNEXT_ShareImageGenerators_Broken.md` | Full incident report |
