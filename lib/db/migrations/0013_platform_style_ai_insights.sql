-- Migration: Platform Style AI Insights
-- Description: Add AI-generated insights cache for Phase 2 of Platform Style Learning System
-- Version: 0013
-- Date: 2026-02-04

-- Add ai_insights_cache column to platform_style_patterns
-- Stores Gemini-generated qualitative insights as JSON (CachedInsight type)
-- Includes: tone analysis, structure patterns, voice fingerprint, writing tips
ALTER TABLE "platform_style_patterns"
ADD COLUMN IF NOT EXISTS "ai_insights_cache" text;

-- Add timestamp for when AI analysis was last run
-- Separate from statistical analysis (last_analyzed_at) since they may be triggered independently
ALTER TABLE "platform_style_patterns"
ADD COLUMN IF NOT EXISTS "ai_analyzed_at" timestamp;

-- Note: Run this migration in Supabase SQL Editor
-- Then update lib/db/schema.ts with the corresponding columns
