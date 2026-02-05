-- Migration: Add share_image_url to talks, cards, and spreads
-- Stores the Supabase Storage URL for pre-generated OG/Twitter share images
-- NULL = use fallback chain (thumbnailUrl for talks, dynamic Satori generator)

ALTER TABLE talks ADD COLUMN share_image_url text;
ALTER TABLE cards ADD COLUMN share_image_url text;
ALTER TABLE spreads ADD COLUMN share_image_url text;
