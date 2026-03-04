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
 * Get health status for a specific API — single consolidated query
 */
export async function getApiHealthStatus(
  apiName: 'gemini' | 'youtube',
  days: number = DEFAULT_DAYS
): Promise<ApiHealthStatus> {
  const cutoff = getDateCutoff(days);
  // ISO strings for raw SQL (Date objects fail with Drizzle db.execute)
  const cutoffIso = cutoff.toISOString();
  const oneHourAgoIso = getOneHourAgo().toISOString();

  // Single query with FILTER clauses instead of 6 separate queries
  const [statsResult, lastErrorResult] = await Promise.all([
    db.execute<{
      total_calls: number;
      successful_calls: number;
      rate_limit_hits: number;
      quota_exceeded_hits: number;
      recent_errors: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE success = true)::int AS successful_calls,
        COUNT(*) FILTER (WHERE error_type = 'rate_limit')::int AS rate_limit_hits,
        COUNT(*) FILTER (WHERE error_type = 'quota_exceeded')::int AS quota_exceeded_hits,
        COUNT(*) FILTER (WHERE success = false AND created_at >= ${oneHourAgoIso})::int AS recent_errors
      FROM api_usage_events
      WHERE api_name = ${apiName}
        AND created_at >= ${cutoffIso}
    `),
    db
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
      .limit(1),
  ]);

  const stats = statsResult[0];
  const totalCalls = Number(stats?.total_calls ?? 0);
  const successfulCalls = Number(stats?.successful_calls ?? 0);
  const rateLimitHits = Number(stats?.rate_limit_hits ?? 0);
  const quotaExceededHits = Number(stats?.quota_exceeded_hits ?? 0);
  const recentErrors = Number(stats?.recent_errors ?? 0);

  const lastError = lastErrorResult[0];
  const lastErrorAt = lastError?.createdAt?.toISOString() ?? null;
  const lastErrorType = lastError?.errorType ?? null;

  // Estimate reset time based on error type
  let estimatedResetTime: string | null = null;
  if (lastError && lastErrorType) {
    if (lastErrorType === 'rate_limit' || lastErrorType === 'quota_exceeded') {
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
 * Get attribution - API calls from Read My Spread clicks (single consolidated query)
 */
export async function getReadSpreadAttribution(days: number = DEFAULT_DAYS): Promise<ReadSpreadAttribution> {
  const cutoffIso = getDateCutoff(days).toISOString();

  const result = await db.execute<{
    gemini_calls: number;
    gemini_successful: number;
    youtube_calls: number;
    youtube_successful: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE api_name = 'gemini')::int AS gemini_calls,
      COUNT(*) FILTER (WHERE api_name = 'gemini' AND success = true)::int AS gemini_successful,
      COUNT(*) FILTER (WHERE api_name = 'youtube')::int AS youtube_calls,
      COUNT(*) FILTER (WHERE api_name = 'youtube' AND success = true)::int AS youtube_successful
    FROM api_usage_events
    WHERE source = 'spread_reading'
      AND created_at >= ${cutoffIso}
  `);

  const row = result[0];
  return {
    geminiCalls: Number(row?.gemini_calls ?? 0),
    youtubeCalls: Number(row?.youtube_calls ?? 0),
    geminiSuccessful: Number(row?.gemini_successful ?? 0),
    youtubeSuccessful: Number(row?.youtube_successful ?? 0),
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

/**
 * Get today's API call count for quota tracking (single consolidated query)
 * "Today" is defined as since midnight Pacific Time (when Google resets quotas)
 */
export async function getTodayApiCallCount(apiName: 'gemini' | 'youtube'): Promise<{
  total: number;
  successful: number;
  failed: number;
  circuitBreakerBlocked: number;
}> {
  // Get midnight Pacific Time today
  const now = new Date();
  const midnightPT = new Date(now);
  midnightPT.setUTCHours(8, 0, 0, 0); // Midnight PT = 8 AM UTC
  if (midnightPT > now) {
    midnightPT.setDate(midnightPT.getDate() - 1);
  }
  const midnightPTIso = midnightPT.toISOString();

  const result = await db.execute<{
    total: number;
    successful: number;
    circuit_breaker_blocked: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE success = true)::int AS successful,
      COUNT(*) FILTER (WHERE error_type = 'circuit_breaker')::int AS circuit_breaker_blocked
    FROM api_usage_events
    WHERE api_name = ${apiName}
      AND created_at >= ${midnightPTIso}
  `);

  const row = result[0];
  const total = Number(row?.total ?? 0);
  const successful = Number(row?.successful ?? 0);
  const circuitBreakerBlocked = Number(row?.circuit_breaker_blocked ?? 0);

  return {
    total,
    successful,
    failed: total - successful,
    circuitBreakerBlocked,
  };
}

export type HourlyUsageStat = {
  hour: string; // ISO string for the hour start
  total: number;
  successful: number;
  failed: number;
};

/**
 * Get hourly API usage stats for the past 24 hours (SQL-grouped)
 */
export async function getHourlyApiUsage(apiName: 'gemini' | 'youtube'): Promise<HourlyUsageStat[]> {
  const now = new Date();
  const twentyFourHoursAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Group by hour in SQL instead of fetching all events
  const result = await db.execute<{
    hour: string;
    total: number;
    successful: number;
    failed: number;
  }>(sql`
    SELECT
      date_trunc('hour', created_at)::text AS hour,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE success = true)::int AS successful,
      COUNT(*) FILTER (WHERE success = false)::int AS failed
    FROM api_usage_events
    WHERE api_name = ${apiName}
      AND created_at >= ${twentyFourHoursAgoIso}
    GROUP BY date_trunc('hour', created_at)
    ORDER BY hour
  `);

  // Build map from SQL results
  const hourlyMap = new Map<string, { total: number; successful: number; failed: number }>();
  for (const row of result) {
    hourlyMap.set(row.hour, {
      total: Number(row.total),
      successful: Number(row.successful),
      failed: Number(row.failed),
    });
  }

  // Initialize all 24 hours with zeros, merge SQL results
  const hours: HourlyUsageStat[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    hourStart.setHours(hourStart.getHours() - i);
    const key = hourStart.toISOString();

    const existing = hourlyMap.get(key);
    hours.push({
      hour: key,
      total: existing?.total ?? 0,
      successful: existing?.successful ?? 0,
      failed: existing?.failed ?? 0,
    });
  }

  return hours;
}

// ============================================================================
// BUDGET TRACKING (Gemini Paid Tier)
// ============================================================================

export type BudgetStatus = {
  // Current period (billing month)
  periodStart: string;
  periodEnd: string;
  daysInPeriod: number;
  daysPassed: number;
  daysRemaining: number;

  // Spending
  totalSpent: number;
  dailyAverage: number;
  projectedMonthly: number;

  // Budget
  monthlyBudget: number;
  remaining: number;
  percentUsed: number;

  // Alerts
  alertLevel: 'ok' | 'warning' | 'danger' | 'critical';
  alertMessage: string | null;
};

/**
 * Get budget status for the current billing period
 * Assumes billing period is calendar month
 */
export async function getGeminiBudgetStatus(monthlyBudget: number = 88): Promise<BudgetStatus> {
  const now = new Date();

  // Get start and end of current month
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month

  const daysInPeriod = periodEnd.getDate();
  const daysPassed = now.getDate();
  const daysRemaining = daysInPeriod - daysPassed;

  // Get total spending this period
  const spendResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${apiUsageEvents.costUsd}), 0)`,
    })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'gemini'),
        gte(apiUsageEvents.createdAt, periodStart)
      )
    );

  const totalSpent = spendResult[0]?.total ?? 0;
  const dailyAverage = daysPassed > 0 ? totalSpent / daysPassed : 0;
  const projectedMonthly = dailyAverage * daysInPeriod;

  const remaining = monthlyBudget - totalSpent;
  const percentUsed = (totalSpent / monthlyBudget) * 100;

  // Determine alert level
  let alertLevel: BudgetStatus['alertLevel'] = 'ok';
  let alertMessage: string | null = null;

  if (percentUsed >= 100) {
    alertLevel = 'critical';
    alertMessage = `Budget exceeded by $${Math.abs(remaining).toFixed(2)}`;
  } else if (percentUsed >= 90) {
    alertLevel = 'critical';
    alertMessage = `Only $${remaining.toFixed(2)} remaining (${(100 - percentUsed).toFixed(1)}%)`;
  } else if (percentUsed >= 75) {
    alertLevel = 'danger';
    alertMessage = `75% of budget used - $${remaining.toFixed(2)} remaining`;
  } else if (percentUsed >= 50) {
    alertLevel = 'warning';
    alertMessage = `50% of budget used - on track`;
  }

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    daysInPeriod,
    daysPassed,
    daysRemaining,
    totalSpent,
    dailyAverage,
    projectedMonthly,
    monthlyBudget,
    remaining,
    percentUsed,
    alertLevel,
    alertMessage,
  };
}

export type DailySpend = {
  date: string;
  totalCost: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Get daily spending breakdown for the past N days
 */
export async function getDailyGeminiSpend(days: number = 30): Promise<DailySpend[]> {
  const cutoff = getDateCutoff(days);

  const results = await db
    .select({
      date: sql<string>`DATE(${apiUsageEvents.createdAt})`,
      totalCost: sql<number>`COALESCE(SUM(${apiUsageEvents.costUsd}), 0)`,
      callCount: count(),
      inputTokens: sql<number>`COALESCE(SUM(${apiUsageEvents.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${apiUsageEvents.outputTokens}), 0)`,
    })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'gemini'),
        gte(apiUsageEvents.createdAt, cutoff)
      )
    )
    .groupBy(sql`DATE(${apiUsageEvents.createdAt})`)
    .orderBy(sql`DATE(${apiUsageEvents.createdAt})`);

  return results.map(row => ({
    date: row.date,
    totalCost: row.totalCost,
    callCount: row.callCount,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
  }));
}

/**
 * Get today's Gemini spending (for real-time budget widget)
 */
export async function getTodayGeminiSpend(): Promise<{
  totalCost: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  avgCostPerCall: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalCost: sql<number>`COALESCE(SUM(${apiUsageEvents.costUsd}), 0)`,
      callCount: count(),
      inputTokens: sql<number>`COALESCE(SUM(${apiUsageEvents.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${apiUsageEvents.outputTokens}), 0)`,
    })
    .from(apiUsageEvents)
    .where(
      and(
        eq(apiUsageEvents.apiName, 'gemini'),
        eq(apiUsageEvents.success, true),
        gte(apiUsageEvents.createdAt, today)
      )
    );

  const row = result[0];
  const totalCost = row?.totalCost ?? 0;
  const callCount = row?.callCount ?? 0;

  return {
    totalCost,
    callCount,
    inputTokens: row?.inputTokens ?? 0,
    outputTokens: row?.outputTokens ?? 0,
    avgCostPerCall: callCount > 0 ? totalCost / callCount : 0,
  };
}
