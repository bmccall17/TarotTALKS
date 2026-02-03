/**
 * API Usage Logging Utility
 *
 * Logs API calls (Gemini, YouTube) for health monitoring and attribution tracking.
 */

import { db } from '@/lib/db';
import { apiUsageEvents } from '@/lib/db/schema';

export type ApiName = 'gemini' | 'youtube';
export type ErrorType = 'rate_limit' | 'quota_exceeded' | 'network' | 'api_error' | 'circuit_breaker';

export interface LogApiCallParams {
  apiName: ApiName;
  success: boolean;
  errorType?: ErrorType;
  sessionId?: string;
  source?: string;
  properties?: Record<string, unknown>;
}

/**
 * Log an API call to the database for health monitoring
 */
export async function logApiCall(params: LogApiCallParams): Promise<void> {
  const {
    apiName,
    success,
    errorType,
    sessionId,
    source = 'unknown',
    properties = {},
  } = params;

  try {
    await db.insert(apiUsageEvents).values({
      apiName,
      success,
      errorType: errorType || null,
      sessionId: sessionId || null,
      source,
      properties: JSON.stringify(properties),
    });
  } catch (error) {
    // Log but don't throw - API call logging should not block the main flow
    console.error('[logApiCall] Failed to log API usage:', error);
  }
}
