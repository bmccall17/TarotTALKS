import { NextRequest, NextResponse } from 'next/server';
import {
  getAllApiUsageStats,
  getTodayApiCallCount,
  getHourlyApiUsage,
  getGeminiBudgetStatus,
  getTodayGeminiSpend,
  getDailyGeminiSpend,
} from '@/lib/db/queries/admin-api-usage';
import { getCircuitBreakerStatus, GEMINI_MONTHLY_BUDGET, GEMINI_DAILY_BUDGET, GEMINI_MODEL } from '@/lib/services/gemini';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Validate days parameter: min 1, max 90
    const validDays = Math.min(Math.max(1, days), 90);

    const [stats, circuitBreaker, geminiToday, geminiHourly, budgetStatus, todaySpend, dailySpend] = await Promise.all([
      getAllApiUsageStats(validDays),
      Promise.resolve(getCircuitBreakerStatus()),
      getTodayApiCallCount('gemini'),
      getHourlyApiUsage('gemini'),
      getGeminiBudgetStatus(GEMINI_MONTHLY_BUDGET),
      getTodayGeminiSpend(),
      getDailyGeminiSpend(validDays),
    ]);

    // Calculate actual API calls (excluding circuit breaker blocks which don't hit the API)
    const actualApiCalls = geminiToday.total - geminiToday.circuitBreakerBlocked;

    return NextResponse.json({
      ...stats,
      gemini: {
        ...stats.gemini,
        circuitBreakerOpen: circuitBreaker.isOpen,
        cooldownUntil: circuitBreaker.cooldownUntil,
        model: GEMINI_MODEL,
        // Today's usage tracking
        todayUsage: {
          ...geminiToday,
          actualApiCalls,
        },
        // Cost tracking (paid tier)
        todaySpend,
        dailyBudget: GEMINI_DAILY_BUDGET,
        // Monthly budget status
        budget: budgetStatus,
        // Spending history
        dailySpend,
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
