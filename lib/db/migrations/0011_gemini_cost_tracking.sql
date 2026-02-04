-- Add token and cost tracking columns to api_usage_events
-- For Gemini paid tier monitoring ($88/month budget)

ALTER TABLE api_usage_events ADD COLUMN IF NOT EXISTS input_tokens INTEGER;
ALTER TABLE api_usage_events ADD COLUMN IF NOT EXISTS output_tokens INTEGER;
ALTER TABLE api_usage_events ADD COLUMN IF NOT EXISTS cost_usd REAL;
ALTER TABLE api_usage_events ADD COLUMN IF NOT EXISTS model_id VARCHAR(50);

-- Add index on cost for budget queries
CREATE INDEX IF NOT EXISTS idx_api_usage_cost ON api_usage_events(cost_usd) WHERE cost_usd IS NOT NULL;
