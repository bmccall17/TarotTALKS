-- Migration: API Usage Events
-- Description: Track Gemini and YouTube API calls for health monitoring and attribution
-- Version: 0010

-- Create the api_usage_events table
CREATE TABLE IF NOT EXISTS "api_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "api_name" varchar(20) NOT NULL,            -- 'gemini' | 'youtube'
  "success" boolean NOT NULL,
  "error_type" varchar(30),                   -- 'rate_limit', 'quota_exceeded', 'network', 'api_error'
  "session_id" varchar(12),                   -- Links to user session for attribution
  "source" varchar(30) NOT NULL,              -- 'spread_reading', etc.
  "properties" text DEFAULT '{}',
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_api_usage_api_name" ON "api_usage_events" ("api_name");
CREATE INDEX IF NOT EXISTS "idx_api_usage_created" ON "api_usage_events" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_api_usage_success" ON "api_usage_events" ("success");
CREATE INDEX IF NOT EXISTS "idx_api_usage_session" ON "api_usage_events" ("session_id");
