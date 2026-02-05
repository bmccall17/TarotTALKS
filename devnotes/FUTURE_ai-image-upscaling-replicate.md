# FUTURE: AI-Powered Image Upscaling via Replicate API

**Status:** Parked for future development
**Created:** 2026-02-05
**Priority:** Low (nice-to-have enhancement)

---

## Problem

The current Sharp-based upscaler (`lib/utils/image-processing.ts`) only:
- Resizes images to 1280×720 via interpolation
- Converts to WebP format (smaller file size)

It does **NOT** improve image quality, reduce grain, or enhance detail. Standard upscaling cannot create information that doesn't exist in the source image.

---

## Proposed Solution: Real-ESRGAN via Replicate

[Replicate](https://replicate.com) offers Real-ESRGAN and other AI super-resolution models as APIs.

### Model Options

| Model | Quality | Speed | Cost |
|-------|---------|-------|------|
| `nightmareai/real-esrgan` | Excellent | ~5-10s | ~$0.002/image |
| `xinntao/realesrgan` | Excellent | ~5-10s | ~$0.002/image |
| `tencentarc/gfpgan` | Best for faces | ~5-10s | ~$0.003/image |

### Estimated Cost

For 98 talk thumbnails: **~$0.20 - $1.00 one-time**

---

## Implementation Plan

### 1. Install Replicate SDK

```bash
npm install replicate
```

### 2. Create Upscale Service

```typescript
// lib/services/replicate-upscale.ts
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function upscaleWithAI(imageUrl: string): Promise<string> {
  const output = await replicate.run(
    "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
    {
      input: {
        image: imageUrl,
        scale: 2, // 2x upscale
        face_enhance: false,
      }
    }
  );

  return output as string; // Returns URL to upscaled image
}
```

### 3. Integration Points

- Add to admin talk edit page as "Enhance Thumbnail" button
- Or batch process via script similar to current `upscale-existing-thumbnails.ts`

### 4. Cost Tracking

Log API calls to existing `api_usage_logs` table:
```typescript
await logApiCall({
  source: 'replicate-upscale',
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0.002,
  metadata: { talkId, model: 'real-esrgan' }
});
```

---

## Environment Variables Needed

```env
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

---

## Resources

- Replicate Docs: https://replicate.com/docs
- Real-ESRGAN Model: https://replicate.com/nightmareai/real-esrgan
- Pricing: https://replicate.com/pricing (~$0.000225/second of compute)

---

## Decision Log

**2026-02-05:** Parked this feature. Current Sharp upscaler provides consistent sizing (1280×720) and WebP format for social previews, which is sufficient for now. AI enhancement is a nice-to-have but not essential for MVP.
