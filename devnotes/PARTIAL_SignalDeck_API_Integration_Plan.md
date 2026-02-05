# Signal Deck API Tracking: Instagram & LinkedIn Integration Plan

**Status:** Planned for future sprint
**Created:** 2026-02-04

## Overview

Add automatic metrics fetching for Instagram and LinkedIn posts in Signal Deck, following the existing Bluesky integration pattern. Currently, only Bluesky auto-fetches metrics; Instagram and LinkedIn require manual entry.

**Key Constraint:** Both APIs only fetch metrics for YOUR OWN posts. Third-party mentions will still require manual metrics entry.

**API Documentation:**
- Instagram Graph API: https://developers.facebook.com/docs/instagram-api
- LinkedIn Marketing API: https://learn.microsoft.com/en-us/linkedin/marketing/
- LinkedIn Member Post Analytics: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics

---

## Phase 1: Database - OAuth Token Storage

### New Migration: `0013_oauth_tokens.sql`

```sql
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,           -- 'instagram', 'linkedin'
  account_identifier VARCHAR(200) NOT NULL, -- Platform user ID
  account_name VARCHAR(200),                -- Display name
  access_token TEXT NOT NULL,               -- Encrypted
  refresh_token TEXT,                       -- Encrypted
  expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT,                              -- JSON array
  metadata JSONB DEFAULT '{}',              -- Platform-specific data
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform, account_identifier)
);

CREATE INDEX idx_oauth_tokens_platform ON oauth_tokens(platform);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens(expires_at);
```

### Files to Modify
- `lib/db/schema.ts` - Add `oauthTokens` table definition
- `lib/db/migrations/` - Add migration file

---

## Phase 2: Service Layer

### New Files

**`lib/services/oauth/encryption.ts`** - Token encryption (AES-256-GCM)
```typescript
export function encryptToken(token: string): string;
export function decryptToken(encryptedData: string): string;
```

**`lib/services/oauth/token-manager.ts`** - Token lifecycle management
```typescript
export async function getValidToken(platform: 'instagram' | 'linkedin'): Promise<string | null>;
export async function storeTokens(platform, tokens): Promise<void>;
export async function refreshTokenIfNeeded(platform): Promise<boolean>;
```

**`lib/services/instagram.ts`** - Following `bluesky.ts` pattern
```typescript
// URL parsing
export function parseInstagramUrl(url: string): { shortcode: string } | null;
export function isInstagramUrl(url: string): boolean;

// Metrics (requires valid OAuth token)
export async function getPostMetrics(mediaId: string): Promise<InstagramMetrics | null>;
export async function getMetricsFromUrl(postUrl: string): Promise<InstagramMetrics | null>;
```

**`lib/services/linkedin.ts`** - Following `bluesky.ts` pattern
```typescript
// URL parsing
export function parseLinkedInUrl(url: string): { postUrn: string } | null;
export function isLinkedInUrl(url: string): boolean;

// Metrics (requires valid OAuth token)
export async function getPostMetrics(postUrn: string): Promise<LinkedInMetrics | null>;
export async function getMetricsFromUrl(postUrl: string): Promise<LinkedInMetrics | null>;
```

---

## Phase 3: OAuth Flow Routes

### New API Routes

```
app/api/admin/oauth/
  instagram/
    authorize/route.ts    -- Redirect to Meta OAuth
    callback/route.ts     -- Handle callback, store tokens
    status/route.ts       -- Check connection status
    disconnect/route.ts   -- Revoke and delete tokens
  linkedin/
    authorize/route.ts    -- Redirect to LinkedIn OAuth
    callback/route.ts     -- Handle callback, store tokens
    status/route.ts       -- Check connection status
    disconnect/route.ts   -- Revoke and delete tokens
```

### OAuth Requirements

**Instagram (via Meta):**
- Scopes: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`
- Tokens expire in 60 days, refreshable
- Requires Business/Creator Instagram account

**LinkedIn:**
- Scope: `r_member_postAnalytics`
- Requires Community Management API approval
- Versioned API headers required (`Linkedin-Version: YYYYMM`)

---

## Phase 4: Metrics API Updates

### Modify: `app/api/admin/social-shares/metrics/route.ts`

Add Instagram and LinkedIn auto-fetch alongside existing Bluesky logic:

```typescript
// Existing Bluesky code...

// Add Instagram
if (share.platform === 'instagram' && share.postUrl && isInstagramUrl(share.postUrl)) {
  const metrics = await getInstagramMetricsFromUrl(share.postUrl);
  if (metrics) {
    return updateAndRespond(shareId, {
      likeCount: metrics.likeCount,
      repostCount: 0,  // Instagram has no reposts
      replyCount: metrics.commentCount,
      source: 'auto'
    });
  }
}

// Add LinkedIn
if (share.platform === 'linkedin' && share.postUrl && isLinkedInUrl(share.postUrl)) {
  const metrics = await getLinkedInMetricsFromUrl(share.postUrl);
  if (metrics) {
    return updateAndRespond(shareId, {
      likeCount: metrics.reactionCount,
      repostCount: metrics.reshareCount,
      replyCount: metrics.commentCount,
      source: 'auto'
    });
  }
}
```

### Modify: `app/api/admin/social-shares/[id]/rescan/route.ts`

Extend platform support from Bluesky-only to include Instagram and LinkedIn.

---

## Phase 5: Frontend Updates

### Modify: `lib/utils/social-handles.ts`

```typescript
export function platformSupportsAutoMetrics(platform: Platform): boolean {
  return ['bluesky', 'instagram', 'linkedin'].includes(platform);
}
```

### New Component: `components/admin/signal-deck/OAuthConnectionManager.tsx`

Display OAuth connection status for each platform:
- Connection status indicator (connected/expired/disconnected)
- Account name when connected
- Connect/Reconnect/Disconnect buttons
- Token expiry warning

### Modify: `components/admin/signal-deck/ManualMetricsModal.tsx`

Update platform info messages to reflect API availability.

---

## Environment Variables

Add to `.env.example`:
```bash
# Instagram Graph API
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=https://tarottalks.app/api/admin/oauth/instagram/callback

# LinkedIn Marketing API
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://tarottalks.app/api/admin/oauth/linkedin/callback

# Token Encryption (generate with: openssl rand -base64 32)
OAUTH_ENCRYPTION_KEY=
```

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `lib/services/bluesky.ts` | Pattern to follow for new services |
| `lib/db/schema.ts` | Add oauthTokens table |
| `app/api/admin/social-shares/metrics/route.ts` | Add auto-fetch logic |
| `app/api/admin/social-shares/[id]/rescan/route.ts` | Extend platform support |
| `lib/utils/social-handles.ts` | Update `platformSupportsAutoMetrics()` |

---

## Implementation Order

1. **Database**: Create migration and update schema
2. **Encryption**: Implement token encryption utilities
3. **Token Manager**: Build token storage/refresh logic
4. **Instagram Service**: Create service following Bluesky pattern
5. **Instagram OAuth Routes**: Implement auth flow
6. **LinkedIn Service**: Create service following Bluesky pattern
7. **LinkedIn OAuth Routes**: Implement auth flow
8. **Metrics API**: Update to use new services
9. **Frontend**: Add OAuth connection UI

---

## Prerequisites (Do Before Sprint)

1. **Meta Developer App** - Create at https://developers.facebook.com/
   - Requires Instagram Business or Creator account connected to Facebook Page
   - Request `instagram_basic` and `instagram_manage_insights` permissions
   - Configure OAuth redirect URI

2. **LinkedIn Developer App** - Create at https://www.linkedin.com/developers/
   - Request Community Management API product
   - Request `r_member_postAnalytics` permission
   - Configure OAuth redirect URI

---

## Known Limitations

1. **Own posts only** - Cannot fetch metrics for third-party posts mentioning TarotTALKS
2. **API approval required** - Both platforms require developer app approval (can take weeks)
3. **Token refresh** - Tokens expire in 60 days; need manual or automated refresh
4. **Instagram Business account required** - Personal accounts not supported

---

## Verification Plan

1. Deploy migration to Supabase
2. Configure Meta and LinkedIn developer apps with OAuth redirect URIs
3. Test OAuth flow: Admin portal → Connect Instagram → Verify token stored
4. Create test Instagram post, add to Signal Deck, click "Refresh Metrics"
5. Verify metrics auto-populate from API
6. Repeat for LinkedIn
7. Test token expiry handling and refresh flow
