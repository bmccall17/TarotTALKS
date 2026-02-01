-- Migration: 0009_spreads.sql
-- Description: Create spreads table for Read My Spread feature

-- Create focus_type enum
DO $$ BEGIN
  CREATE TYPE focus_type AS ENUM (
    'relationships', 'work', 'courage', 'grief',
    'creativity', 'money', 'identity', 'surprise_me', 'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create privacy_level enum
DO $$ BEGIN
  CREATE TYPE privacy_level AS ENUM ('full', 'cards_only', 'cards_and_talk');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create spreads table
CREATE TABLE IF NOT EXISTS spreads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id VARCHAR(12) NOT NULL UNIQUE,

  -- Cards (ordered by position: 1=Aware Self, 2=Supporting Shadow, 3=Emerging Path)
  card_1_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  card_2_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  card_3_id UUID REFERENCES cards(id) ON DELETE SET NULL,

  -- User input
  focus_type focus_type,
  focus_text TEXT,

  -- Generated result
  talk_id UUID REFERENCES talks(id) ON DELETE SET NULL,
  rationale TEXT NOT NULL,
  rationale_source VARCHAR(20) DEFAULT 'template',
  ai_model VARCHAR(50),
  score INTEGER,
  match_reasons JSONB,

  -- Privacy
  privacy_level privacy_level DEFAULT 'full',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_spreads_short_id ON spreads(short_id);
CREATE INDEX IF NOT EXISTS idx_spreads_created_at ON spreads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spreads_card_1 ON spreads(card_1_id);
CREATE INDEX IF NOT EXISTS idx_spreads_card_2 ON spreads(card_2_id);
CREATE INDEX IF NOT EXISTS idx_spreads_card_3 ON spreads(card_3_id);
CREATE INDEX IF NOT EXISTS idx_spreads_talk ON spreads(talk_id);
