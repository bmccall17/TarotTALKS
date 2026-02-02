/**
 * Admin API Usage Query Functions
 *
 * Provides health status, attribution, and statistics for API usage monitoring.
 */

import { db } from '@/lib/db';
import { apiUsageEvents } from '@/lib/db/schema';
import { sql, count, and, gte, eq, desc } from 'drizzle-orm';

const DEFAULT_DAYS = 7;

function getDateCutoff(days: number = DEFAULT_DAYS): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

function getOneHourAgo(): Date {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  return oneHourAgo;
}

export type ApiHealthStatus = {
  apiName: 'gemini' | 'youtube';
  isHealthy: boolean;
  totalCalls: number;
  successfulCalls: number;
  rateLimitHits: number;
  quotaExceededHits: number;
  lastErrorAt: string | null;
  lastErrorType: string | null;
  estimatedResetTime: string | null;
};

/**
 * Get health status for a specific API
 */
export async function getApiHealthStatus(
  apiName: 'gemini' | 'youtube',
  days: number = DEFAULT_DAYS
): Promise<ApiHealthStatus> {
  const cutoff = getDateCutoff(days);
  const oneHourAgo = getOneHourAgo();

  // Total calls in time range
  const totalResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const totalCalls = totalResult[0]?.count ?? 0;

  // Successful calls
  const successResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        eq(apiUsageEvents.success, true),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const successfulCalls = successResult[0]?.count ?? 0;

  // Rate limit hits
  const rateLimitResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        eq(apiUsageEvents.errorType, 'rate_limit'),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const rateLimitHits = rateLimitResult[0]?.count ?? 0;

  // Quota exceeded hits (mainly YouTube)
  const quotaResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        eq(apiUsageEvents.errorType, 'quota_exceeded'),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const quotaExceededHits = quotaResult[0]?.count ?? 0;

  // Check for errors in the last hour (determines health)
  const recentErrorsResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        eq(apiUsageEvents.success, false),
        gte(apiUsageEvents.createdAt, oneHourAgo)
      )
    );
  const recentErrors = recentErrorsResult[0]?.count ?? 0;

  // Get most recent error
  const lastErrorResult = await db
    .select({
      createdAt: apiUsageEvents.createdAt,
      errorType: apiUsageEvents.errorType,
    })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        eq(apiUsageEvents.success, false),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    )
    .orderBy(desc(apiUsageEvents.createdAt))
    .limit(1);

  const lastError = lastErrorResult[0];
  const lastErrorAt = lastError?.createdAt?.toISOString() ?? null;
  const lastErrorType = lastError?.errorType ?? null;

  // Estimate reset time based on API type and error type
  // Both Gemini and YouTube free tiers reset at midnight Pacific Time
  let estimatedResetTime: string | null = null;
  if (lastError && lastErrorType) {
    if (lastErrorType === 'rate_limit' || lastErrorType === 'quota_exceeded') {
      // Free tier quotas reset at midnight Pacific Time (PT)
      // PT is UTC-8 (standard) or UTC-7 (daylight saving)
      // Using UTC-8 as a conservative estimate
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(8, 0, 0, 0); // Midnight Pacific = 8 AM UTC
      if (midnight <= now) {
        midnight.setDate(midnight.getDate() + 1);
      }
      estimatedResetTime = midnight.toISOString();
    }
  }

  return {
    apiName,
    isHealthy: recentErrors === 0,
    totalCalls,
    successfulCalls,
    rateLimitHits,
    quotaExceededHits,
    lastErrorAt,
    lastErrorType,
    estimatedResetTime,
  };
}

export type ReadSpreadAttribution = {
  geminiCalls: number;
  youtubeCalls: number;
  geminiSuccessful: number;
  youtubeSuccessful: number;
};

/**
 * Get attribution - API calls from Read My Spread clicks
 */
export async function getReadSpreadAttribution(days: number = DEFAULT_DAYS): Promise<ReadSpreadAttribution> {
  const cutoff = getDateCutoff(days);

  // Gemini calls from spread_reading
  const geminiResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'gemini'),
        eq(apiUsageEvents.source, 'spread_reading'),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const geminiCalls = geminiResult[0]?.count ?? 0;

  // Gemini successful calls
  const geminiSuccessResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'gemini'),
        eq(apiUsageEvents.source, 'spread_reading'),
        eq(apiUsageEvents.success, true),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const geminiSuccessful = geminiSuccessResult[0]?.count ?? 0;

  // YouTube calls from spread_reading
  const youtubeResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'youtube'),
        eq(apiUsageEvents.source, 'spread_reading'),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const youtubeCalls = youtubeResult[0]?.count ?? 0;

  // YouTube successful calls
  const youtubeSuccessResult = await db
    .select({ count: count() })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'youtube'),
        eq(apiUsageEvents.source, 'spread_reading'),
        eq(apiUsageEvents.success, true),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    );
  const youtubeSuccessful = youtubeSuccessResult[0]?.count ?? 0;

  return {
    geminiCalls,
    youtubeCalls,
    geminiSuccessful,
    youtubeSuccessful,
  };
}

export type ApiUsageStats = {
  gemini: ApiHealthStatus;
  youtube: ApiHealthStatus;
  attribution: ReadSpreadAttribution;
};

/**
 * Get all API usage stats in one call
 */
export async function getAllApiUsageStats(days: number = DEFAULT_DAYS): Promise<ApiUsageStats> {
  const [gemini, youtube, attribution] = await Promise.all([
    getApiHealthStatus('gemini', days),
    getApiHealthStatus('youtube', days),
    getReadSpreadAttribution(days),
  ]);

  return {
    gemini,
    youtube,
    attribution,
  };
}

// Types for detailed API call logs
export type ApiCallLogEntry = {
  id: string;
  success: boolean;
  errorType: string | null;
  source: string | null;
  createdAt: string;
  properties: {
    // YouTube search properties
    queries?: string[];
    queriesCount?: number;
    resultsCount?: number;
    results?: Array<{ id: string; title: string; channel: string }>;
    defaultToTed?: boolean;
    partialError?: string;
    status?: number;
    // Selection properties (from spread_selection source)
    selectedTalkId?: string;
    selectedTalkTitle?: string;
    spreadId?: string;
    spreadUrl?: string;
    fallbackMode?: boolean;
    youtubeUsed?: boolean;
    cardNames?: string[];
    // Gemini properties
    prompt?: string;
    model?: string;
    tokensUsed?: number;
  };
};

/**
 * Get detailed API call logs for admin inspection
 * Returns recent calls with full query/result details
 */
export async function getApiCallLogs(
  apiName: 'gemini' | 'youtube',
  days: number = DEFAULT_DAYS,
  limit: number = 20
): Promise<ApiCallLogEntry[]> {
  const cutoff = getDateCutoff(days);

  const results = await db
    .select({
      id: apiUsageEvents.id,
      success: apiUsageEvents.success,
      errorType: apiUsageEvents.errorType,
      source: apiUsageEvents.source,
      createdAt: apiUsageEvents.createdAt,
      properties: apiUsageEvents.properties,
    })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, apiName),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    )
    .orderBy(desc(apiUsageEvents.createdAt))
    .limit(limit);

  return results.map(row => ({
    id: row.id,
    success: row.success,
    errorType: row.errorType,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    properties: row.properties ? JSON.parse(row.properties) : {},
  }));
}
