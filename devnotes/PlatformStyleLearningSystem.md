# Platform Style Learning System

## Overview

A system that analyzes existing Signal Deck posts to learn platform-specific messaging patterns. Designed to improve as more posts are added and to weight patterns by engagement performance.

**Status:** Phase 1 complete, Phases 2-4 parked for future sprint.

**Current state:** A few posts logged, primarily Bluesky + X + LinkedIn, Instagram coming soon.

**Future integrations:** Instagram Graph API, LinkedIn APIs planned - the schema supports engagement-weighted learning when those arrive.

---

## What It Learns (Per Platform)

| Pattern | Example Insight |
|---------|-----------------|
| **Length** | "Bluesky posts avg 180 chars, X posts avg 240 chars" |
| **Structure** | "You lead with card name, then speaker tag, then talk title" |
| **Hashtags** | "Instagram uses 3-5 hashtags, Bluesky uses none" |
| **Emojis** | "X posts start with an emoji, Bluesky posts end with one" |
| **Mentions** | "Always tag speaker on Bluesky, rarely on Instagram" |
| **Top performers** | "Your highest-engagement posts share these traits..." |

---

## Phased Rollout

### Phase 1: Statistical Analysis (COMPLETE)

**Implemented 2025-02-04**

- Analyze character counts, hashtags, emojis, mentions
- Build patterns from existing posts in `notes` field
- Admin page: `/admin/platform-style`
- Manual "Analyze Now" button to trigger analysis
- Engagement weighting ready - schema supports it, analyzer uses it when metrics exist

**Files created:**
| File | Purpose |
|------|---------|
| `lib/db/migrations/0012_platform_style_patterns.sql` | Schema migration |
| `lib/db/queries/admin-platform-style.ts` | Query functions |
| `lib/services/platform-style-analyzer.ts` | Statistical analysis engine |
| `app/api/admin/platform-style/route.ts` | GET patterns |
| `app/api/admin/platform-style/analyze/route.ts` | POST trigger analysis |
| `app/admin/platform-style/page.tsx` | Insights dashboard |

**Modified files:**
| File | Change |
|------|--------|
| `lib/db/schema.ts` | Added `platformStylePatterns` table |
| `components/admin/ui/AdminNav.tsx` | Added "Platform Style" nav link |

---

### Phase 2: AI-Enhanced Insights (PARKED)

Use Gemini to extract deeper patterns that statistical analysis can't detect.

**Goals:**
- Analyze tone/voice differences between platforms
- Extract common openings (e.g., "You always lead with the card name on Bluesky")
- Extract common closings (e.g., "X posts often end with a call-to-action")
- Identify content order patterns (card → speaker → talk title vs other structures)
- Detect sentiment differences per platform

**Implementation approach:**
- Send batch of posts to Gemini with structured prompt
- Ask for pattern extraction in JSON format
- Store AI insights in new `ai_insights` column on `platform_style_patterns`
- Display alongside statistical patterns in UI

**New files needed:**
- `lib/services/platform-style-ai.ts` - Gemini integration for style analysis
- Update `app/admin/platform-style/page.tsx` - Add AI insights section

**Considerations:**
- Rate limit Gemini calls (analyze on demand, not automatically)
- Cache results aggressively (insights don't change until new posts added)
- Keep Gemini Free Tier constraints in mind

---

### Phase 3: Draft Generation (PARKED)

Generate platform-specific post drafts that match learned style patterns.

**Goals:**
- "Suggest Draft" button in NewShareForm
- Generate drafts that match learned style for selected platform
- Show style compliance indicators when manually writing

**Implementation approach:**
1. Add "Suggest Draft" button to `components/admin/signal-deck/NewShareForm.tsx`
2. Create API endpoint `app/api/admin/platform-style/generate-draft/route.ts`
3. Use Gemini with learned patterns as context
4. Prompt structure:
   ```
   You are writing a social media post for {platform}.
   Based on these learned patterns: {patterns}
   Generate a post about this card/talk: {content}
   Match the style, length, hashtag usage, and emoji patterns.
   ```

**New files needed:**
- `app/api/admin/platform-style/generate-draft/route.ts` - Draft generation API
- `components/admin/signal-deck/DraftGenerator.tsx` - UI component (modal or inline)
- `components/admin/signal-deck/StyleComplianceIndicator.tsx` - Shows how well draft matches patterns

**Style compliance indicators:**
- Length: "This post is 40 chars longer than your typical Bluesky post"
- Hashtags: "You usually use 0 hashtags on Bluesky"
- Emojis: "Your Bluesky posts typically end with an emoji"
- Mentions: "Consider tagging the speaker - you do this 80% of the time"

---

### Phase 4: Continuous Learning (PARKED)

Automate re-analysis and add freshness tracking.

**Goals:**
- Auto-re-analyze when 5+ new posts added since last analysis
- Freshness indicators on insights ("Based on 12 posts, last updated 3 days ago")
- Deeper integration with Instagram/LinkedIn APIs when available

**Implementation approach:**

**Auto-re-analysis:**
- Track `posts_analyzed` vs current post count per platform
- When difference >= 5, show "New posts available" indicator
- Option: auto-trigger analysis on Signal Deck page load
- Option: background job (if we add job infrastructure)

**Freshness indicators:**
- Already have `last_analyzed_at` and `posts_analyzed` in schema
- Add UI indicator: "12 posts analyzed · Last updated 3 days ago"
- Add "stale" warning if last analysis > 7 days old and new posts exist

**Instagram Graph API integration:**
- Fetch engagement metrics automatically
- Requires Facebook App approval process
- Store access tokens securely
- Add `instagram_post_id` field to social_shares for linking

**LinkedIn API integration:**
- Similar to Instagram - fetch engagement metrics
- Requires LinkedIn Developer App
- OAuth flow for authorization

**New files needed:**
- `lib/services/instagram-api.ts` - Instagram Graph API client
- `lib/services/linkedin-api.ts` - LinkedIn API client
- `app/api/admin/social-shares/sync-metrics/route.ts` - Bulk metrics sync
- `components/admin/signal-deck/StyleInsightsWidget.tsx` - Quick stats widget for Signal Deck dashboard

---

## Database Schema

**Table: `platform_style_patterns`**

```sql
CREATE TABLE "platform_style_patterns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform" varchar(20) NOT NULL UNIQUE,

  -- Length statistics
  "avg_length" integer,
  "min_length" integer,
  "max_length" integer,
  "median_length" integer,
  "weighted_avg_length" integer,

  -- Hashtag patterns
  "hashtag_usage_pct" real,
  "hashtag_avg_count" real,
  "common_hashtags" text,  -- JSON array

  -- Emoji patterns
  "emoji_usage_pct" real,
  "emoji_avg_count" real,
  "common_emojis" text,    -- JSON array
  "emoji_positions" text,  -- JSON: {"start": 0.3, "middle": 0.2, "end": 0.5}

  -- Mention patterns
  "mention_usage_pct" real,
  "mention_avg_count" real,
  "mention_types" text,    -- JSON: {"speaker": 0.8, "org": 0.1, "other": 0.1}

  -- Top performer analysis
  "engagement_threshold" integer,
  "top_performer_traits" text,  -- JSON
  "top_performer_count" integer,

  -- Example posts
  "example_post_ids" text,  -- JSON array of UUIDs

  -- Freshness tracking
  "posts_analyzed" integer NOT NULL DEFAULT 0,
  "last_analyzed_at" timestamp,

  -- Timestamps
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

---

## Analyzer Capabilities

The `platform-style-analyzer.ts` service provides:

```typescript
extractHashtags(text) → ["#tarot", "#tedtalk", ...]
extractEmojis(text) → ["✨", "🃏", ...]
extractMentions(text) → ["@speaker", "@TEDTalks", ...]
calculateLengthStats(posts) → { avg, min, max, median, weightedAvg }
calculateEngagementScore(post) → likes + (reposts * 2) + (replies * 3)
identifyTopPerformers(posts) → posts in top 25% by engagement
analyzePatterns(posts, platform) → full PlatformStylePattern object
```

**Engagement weighting:** When posts have metrics, the analyzer weights patterns:
- Top 25% performers contribute 2x to pattern averages
- Patterns unique to top performers highlighted separately

---

## Admin UI: `/admin/platform-style`

**Platform tabs:** Bluesky | X | LinkedIn | Instagram | Threads | Other

**Per-platform card showing:**
- Posts analyzed count + last analyzed timestamp
- "Analyze Now" button
- Length stats: avg / min / max (with bar visualization)
- Hashtags: usage %, common tags, avg count
- Emojis: usage %, common emojis, typical positions
- Mentions: usage %, types (speaker/org/other)
- Top performer traits (when engagement data exists)
- Sample posts: Links to 3-5 representative examples

---

## Verification Checklist

1. Ensure posts logged in Signal Deck (at least 2-3 per platform)
2. Navigate to `/admin/platform-style`
3. Click "Analyze Now" for each platform
4. Verify stats match actual posting patterns
5. Add a new post, re-analyze, confirm patterns update
