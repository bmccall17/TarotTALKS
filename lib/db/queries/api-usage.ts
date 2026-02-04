/**
 * API Usage Logging Utility
 *
 * Logs API calls (Gemini, YouTube) for health monitoring, attribution tracking,
 * and cost tracking (Gemini paid tier).
 */

import { db } from '@/lib/db';
import { apiUsageEvents } from '@/lib/db/schema';

export type ApiName = 'gemini' | 'youtube';
export type ErrorType = 'rate_limit' | 'quota_exceeded' | 'network' | 'api_error' | 'circuit_breaker';

// Gemini pricing per 1M tokens (as of Feb 2025)
export const GEMINI_PRICING = {
  'gemini-1.5-pro': { input: 1.25, output: 5.00 }, // $/1M tokens
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
} as const;

export type GeminiModel = keyof typeof GEMINI_PRICING;

/**
 * Calculate cost for a Gemini API call
 */
export function calculateGeminiCost(
  model: GeminiModel,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = GEMINI_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export interface LogApiCallParams {
  apiName: ApiName;
  success: boolean;
  errorType?: ErrorType;
  sessionId?: string;
  source?: string;
  properties?: Record<string, unknown>;
  // Token and cost tracking (Gemini only)
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  modelId?: string;
}

/**
 * Log an API call to the database for health monitoring and cost tracking
 */
export async function logApiCall(params: LogApiCallParams): Promise<void> {
  const {
    apiName,
    success,
    errorType,
    sessionId,
    source = 'unknown',
    properties = {},
    inputTokens,
    outputTokens,
    costUsd,
    modelId,
  } = params;

  try {
    await db.insert(apiUsageEvents).values({
      apiName,
      success,
      errorType: errorType || null,
      sessionId: sessionId || null,
      source,
      properties: JSON.stringify(properties),
      inputTokens: inputTokens ?? null,
      outputTokens: outputTokens ?? null,
      costUsd: costUsd ?? null,
      modelId: modelId ?? null,
    });
  } catch (error) {
    // Log but don't throw - API call logging should not block the main flow
    console.error('[logApiCall] Failed to log API usage:', error);
  }
}
