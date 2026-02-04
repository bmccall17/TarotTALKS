-- Migration: Platform Style Patterns
-- Description: Store learned patterns from social media posts per platform
-- Version: 0012

CREATE TABLE IF NOT EXISTS "platform_style_patterns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Platform identifier (matches platformEnum)
  "platform" varchar(20) NOT NULL UNIQUE,

  -- Length statistics
  "avg_length" integer,
  "min_length" integer,
  "max_length" integer,
  "median_length" integer,
  "weighted_avg_length" integer,

  -- Hashtag patterns (stored as JSON)
  "hashtag_usage_pct" real,
  "hashtag_avg_count" real,
  "common_hashtags" text,

  -- Emoji patterns (stored as JSON)
  "emoji_usage_pct" real,
  "emoji_avg_count" real,
  "common_emojis" text,
  "emoji_positions" text,

  -- Mention patterns
  "mention_usage_pct" real,
  "mention_avg_count" real,
  "mention_types" text,

  -- Top performer analysis (engagement-weighted)
  "engagement_threshold" integer,
  "top_performer_traits" text,
  "top_performer_count" integer,

  -- Example posts for reference
  "example_post_ids" text,

  -- Freshness tracking
  "posts_analyzed" integer NOT NULL DEFAULT 0,
  "last_analyzed_at" timestamp,

  -- Timestamps
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Index for quick lookup by platform
CREATE INDEX IF NOT EXISTS "idx_platform_style_patterns_platform" ON "platform_style_patterns" ("platform");
