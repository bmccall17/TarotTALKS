# Cost Control Workflow & Strategy

## Overview
This document outlines the strategy for monitoring and controlling the costs of external services used in TarotTALKS. The goal is to stay within free tiers where possible and strictly cap paid usage.

## Service Inventory & Status

| Service | Primary Cost Driver | Current Control Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **Vercel** | Edge Functions, Image Optimization, Bandwidth | `next.config.ts` (unoptimized images), Code Audits | ⚠️ **PARTIAL** (Recent fix applied) |
| **Google Gemini** | Input/Output Tokens | `gemini.ts` Circuit Breaker & Rate Limiting | ✅ **GOOD** (Has budget logic) |
| **YouTube Data API** | API Quota (Units) | `youtube.ts` Quota Tracking | ⚠️ **PARTIAL** (Tracks errors, no hard cap) |
| **Replicate** | GPU Time (Image Upscaling) | `api_usage_events` Logging | ❌ **RISK** (No hard cap/circuit breaker) |
| **Supabase** | Database Size, Egress | None (monitoring dashboard only) | ❌ **UNTRACKED** |
| **OpenAI** | (Likely unused / Legacy) | N/A | ⚪ **INACTIVE** |

## Intelligent Cost Control System (Existing)
The codebase strictly follows a "pay-for-what-you-use-and-log-it" philosophy using `lib/db/queries/api-usage.ts`.
- **Table**: `api_usage_events` tracks every paid API call.
- **Logic**: `lib/services/gemini.ts` implements a daily budget circuit breaker.

## Proposed Workflows

### 1. Automated Circuit Breakers (Implementation Needed)
We need to extend the `gemini.ts` circuit breaker pattern to **Replicate** and **YouTube**.
- **Replicate**: Add a daily budget check (e.g., $1.00/day).
- **YouTube**: Track "units" used and stop attempts if daily quota (10,000 units usually) is near.

### 2. The "Weekly Cost Audit" (Manual Workflow)
**Frequency**: Weekly (Monday)
**Owner**: DevOps / Lead Dev

1.  **Check Vercel Usage**:
    *   Log in to Vercel Dashboard > Usage.
    *   Verify "Image Optimization" is 0 or low.
    *   Verify "Edge Function Execution Units" are within limits.
2.  **Check Supabase Usage**:
    *   Log in to Supabase > Settings > Usage.
    *   Check Database Size (Free tier: 500MB).
    *   Check Egress (Bandwidth).
3.  **Review API Logs**:
    *   Run SQL query: `SELECT api_name, COUNT(*), SUM(cost_usd) FROM api_usage_events WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY api_name;`
4.  **Update Limits**:
    *   If any service is nearing limits, update `const` limits in `lib/services/*.ts`.

## Research Request (To Research Team)
Please investigate and update the "2026 Limits" for these services:
1.  **Replicate**: What is the exact pricing for `nightmareai/real-esrgan`? Is there a built-in spending cap we can set in their dashboard?
2.  **Google Gemini**: Verify `gemini-2.0-flash` pricing. Is the free tier sufficient for our volume (15 RPM)?
3.  **YouTube**: Confirm the current free quota is still 10,000 units/day.
4.  **Supabase**: detailed breakdown of "Pro" vs "Free" limits for storage/bandwidth.
