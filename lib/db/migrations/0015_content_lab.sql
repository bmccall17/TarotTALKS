-- Migration 0015: Content Lab tables
-- Content assistant for weekly social media content generation

-- ============================================================================
-- Table 1: content_brand_config (singleton - one row)
-- Persistent brand voice and strategy, configured once, used in every generation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_brand_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Brand identity
  offer_description text,                -- "Free app mapping 78 Tarot cards to TED talks"
  audience_persona text,                 -- Target audience description

  -- Strategy
  key_messaging_pillars text,            -- JSON array of core themes
  brand_tone_description text,           -- Free-text voice guide
  content_frameworks text,               -- JSON array of enabled frameworks
  cta_options text,                      -- JSON array of reusable CTAs

  -- DM templates (deferred to Phase 2, but schema-ready)
  dm_opener_template text,
  dm_sequence_steps text,                -- JSON array of DM step templates

  -- Timestamps
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- Table 2: content_calendar_items
-- Each row = one generated post for a specific day/platform.
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_calendar_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Calendar positioning
  week_start_date date NOT NULL,         -- Monday of the target week
  day_of_week integer NOT NULL,          -- 0=Mon through 6=Sun
  content_type varchar(30) NOT NULL,     -- authority, story, offer, engagement
  platform platform NOT NULL,            -- Uses existing platform enum

  -- Post content
  hook text,                             -- Opening 1-2 lines (separated for preview)
  body text,                             -- Full post text
  cta text,                              -- Call-to-action line
  hashtags text,                         -- JSON array of suggested hashtags

  -- Optional card/talk references
  card_id uuid REFERENCES cards(id) ON DELETE SET NULL,
  talk_id uuid REFERENCES talks(id) ON DELETE SET NULL,

  -- DM sequence fields (deferred to Phase 2)
  dm_trigger_comment text,
  dm_steps text,                         -- JSON array

  -- Lead magnet fields (deferred to Phase 2)
  lead_magnet_title text,
  lead_magnet_description text,

  -- Workflow status
  status varchar(20) DEFAULT 'generated' NOT NULL,  -- generated, edited, approved, pushed, discarded
  pushed_share_id uuid REFERENCES social_shares(id) ON DELETE SET NULL,

  -- Generation metadata
  framework_used varchar(50),            -- PAS, AIDA, hook_story_offer, etc.
  ai_generation_cost real,               -- Cost in USD
  generation_batch_id varchar(50),       -- Groups items generated together

  -- Timestamps
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_calendar_items_week ON content_calendar_items(week_start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_items_platform ON content_calendar_items(platform);
CREATE INDEX IF NOT EXISTS idx_calendar_items_status ON content_calendar_items(status);
CREATE INDEX IF NOT EXISTS idx_calendar_items_batch ON content_calendar_items(generation_batch_id);
