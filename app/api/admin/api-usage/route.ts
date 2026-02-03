import { NextRequest, NextResponse } from 'next/server';
import { getAllApiUsageStats, getTodayApiCallCount, getHourlyApiUsage } from '@/lib/db/queries/admin-api-usage';
import { getCircuitBreakerStatus, GEMINI_DAILY_QUOTA } from '@/lib/services/gemini';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Validate days parameter: min 1, max 90
    const validDays = Math.min(Math.max(1, days), 90);

    const [stats, circuitBreaker, geminiToday, geminiHourly] = await Promise.all([
      getAllApiUsageStats(validDays),
      Promise.resolve(getCircuitBreakerStatus()),
      getTodayApiCallCount('gemini'),
      getHourlyApiUsage('gemini'),
    ]);

    // Calculate actual API calls (excluding circuit breaker blocks which don't hit the API)
    const actualApiCalls = geminiToday.total - geminiToday.circuitBreakerBlocked;
    const estimatedRemaining = Math.max(0, GEMINI_DAILY_QUOTA - actualApiCalls);

    return NextResponse.json({
      ...stats,
      gemini: {
        ...stats.gemini,
        circuitBreakerOpen: circuitBreaker.isOpen,
        cooldownUntil: circuitBreaker.cooldownUntil,
        // Today's quota tracking
        todayUsage: {
          ...geminiToday,
          actualApiCalls, // Calls that actually hit the API
          dailyQuota: GEMINI_DAILY_QUOTA,
          estimatedRemaining,
          quotaPercentUsed: Math.round((actualApiCalls / GEMINI_DAILY_QUOTA) * 100),
        },
        // Hourly usage for graph
        hourlyUsage: geminiHourly,
      },
    });
  } catch (error) {
    console.error('Error fetching API usage stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API usage stats' },
      { status: 500 }
    );
  }
}
