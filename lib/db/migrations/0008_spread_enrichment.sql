-- Migration: 0008_spread_enrichment.sql
-- Description: Add thematic tags to cards and talks for intelligent spread reading

-- Thematic tags for cards (for spread scoring)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS themes_json TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS archetypes_json TEXT;

-- Position-specific meanings for 3-card spread positions
ALTER TABLE cards ADD COLUMN IF NOT EXISTS meaning_aware_self TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS meaning_supporting_shadow TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS meaning_emerging_path TEXT;

-- Thematic tags for talks (for spread scoring)
ALTER TABLE talks ADD COLUMN IF NOT EXISTS themes_json TEXT;
ALTER TABLE talks ADD COLUMN IF NOT EXISTS core_message TEXT;
