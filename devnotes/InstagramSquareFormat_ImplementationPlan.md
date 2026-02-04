# Audit & Plan: Share Images Capabilities (Instagram Square Format)

## Goal Description
The goal is to audit the current Share Image capabilities and create a plan to support **Square (1:1) Share Images** optimized for Instagram (posts/feed). Currently, the application generates standard 1.91:1 (1200x630) Open Graph images for Cards, Spreads, and Talks using Next.js `opengraph-image.tsx`.

This plan proposes:
1.  Refactoring shared image generation logic (fonts, sparkles/backgrounds) into reusable utilities.
2.  Implementing new API endpoints (Route Handlers) to generate 1080x1080 square images on-the-fly.
3.  Ensuring these images have a layout optimized for the square format.

## User Review Required
> [!NOTE]
> We will expose these new images via API routes (e.g., `/cards/[slug]/instagram`) rather than replacing the default `og:image`. This preserves standard previews for Twitter/LinkedIn/Facebook while offering a specialized format for Instagram / Manual download.

## Proposed Changes

### Shared Utilities
#### [NEW] `lib/image-utils.ts`
- Extract `loadFonts` logic from `app/cards/[slug]/opengraph-image.tsx` to this file.
- Extract "Sparkles" generation logic and common styles (colors, gradients) to ensure design consistency across formats.

### Card Images
#### [NEW] `app/cards/[slug]/instagram/route.tsx`
- Create a new Route Handler that uses `ImageResponse` from `next/og`.
- **Dimensions**: 1080x1080.
- **Design**:
    - **Header**: "TarotTALKS" branding (Centered or Top).
    - **Main Content**: Large Card Image (Centered).
    - **Footer**: Card Name, Keywords, and Summary (Stacked).
    - **Background**: Consistent deep purple/indigo gradient with sparkles.

### Spread Images (Optional/Follow-up)
#### [NEW] `app/spreads/[id]/instagram/route.tsx`
- Similar structure but for Spreads (showing 3 cards).

### Talk Images (Optional/Follow-up)
#### [NEW] `app/talks/[slug]/instagram/route.tsx`
- Similar structure but for Talks (Talk thumbnail + Card).

### Admin Panel Integration
#### [MODIFY] `app/admin/share-images/page.tsx`
- Add "Instagram" column/support to the grid and list views.
- Add logic to fetch/save/download `instagram` image type (square).

#### [MODIFY] `components/admin/signal-deck/NextCardWidget.tsx`
- Add a "Download IG" button next to "Share" (or within a dropdown).
- Should link to `/cards/[slug]/instagram`.

#### [MODIFY] `components/admin/talks/TalkForm.tsx`
- Add a "Share Images" section in the Preview column (similar to mapped cards).
- Provide quick download links for OG and Instagram images for the talk.

#### [MODIFY] `components/admin/signal-deck/NewShareForm.tsx`
- (Optional) Add a link to view/download the generated image for the selected Card/Talk to help with posting.

## Verification Plan

### Automated Tests
- None currently exist for image generation (visual regression is hard).
- We will verify by building the app and hitting the endpoints locally.

### Manual Verification
1.  **Build** the application locally.
2.  **Navigate** to a Card page URL to get a slug (e.g., `/cards/the-fool`).
3.  **Access** the new route: `http://localhost:3000/cards/the-fool/instagram`.
4.  **Inspect**:
    - Verify the output is a PNG image.
    - Verify dimensions are 1080x1080.
    - Verify visual layout (text is readable, nothing cut off, branded correctly).
5.  **Admin Check**:
    - Go to `/admin/share-images`. Verify "Instagram" column exists and images can be generated.
    - Go to `/admin/signal-deck`. Check "Next Cards" widget for IG download button.
    - Go to Edit Talk page. Check for Share Image download links.
