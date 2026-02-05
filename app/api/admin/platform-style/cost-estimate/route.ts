import { NextRequest, NextResponse } from 'next/server';
import { estimateOperationCost } from '@/lib/services/platform-style-ai';
import { getGeminiBudgetStatus, getTodayGeminiSpend } from '@/lib/db/queries/admin-api-usage';
import type { Platform } from '@/lib/services/platform-style-analyzer';

const VALID_PLATFORMS: Platform[] = ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other'];
const VALID_OPERATIONS = ['ai-insights', 'generate-draft'] as const;
type Operation = typeof VALID_OPERATIONS[number];

/**
 * GET /api/admin/platform-style/cost-estimate
 * Query: ?operation=ai-insights&platform=bluesky
 *
 * Returns cost estimate for an operation along with current budget status.
 * Helps admin make informed decisions about AI usage.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') as Operation | null;
    const platform = searchParams.get('platform') as Platform | null;

    // Validate operation
    if (!operation || !VALID_OPERATIONS.includes(operation)) {
      return NextResponse.json(
        { error: 'Valid operation is required (ai-insights or generate-draft)', code: 'INVALID_OPERATION' },
        { status: 400 }
      );
    }

    // Validate platform
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Valid platform is required', code: 'INVALID_PLATFORM' },
        { status: 400 }
      );
    }

    // Get cost estimate for operation
    const estimate = estimateOperationCost(operation);

    // Get current budget status
    const [budgetStatus, todaySpend] = await Promise.all([
      getGeminiBudgetStatus(),
      getTodayGeminiSpend(),
    ]);

    // Calculate impact
    const dailyBudget = budgetStatus.monthlyBudget / 30; // ~$2.93/day for $88/month
    const afterOperation = todaySpend.totalCost + estimate.costUsd;
    const percentOfDaily = (afterOperation / dailyBudget) * 100;

    // Generate warning if approaching limits
    let warning: string | undefined;
    if (percentOfDaily > 90) {
      warning = 'This operation would use more than 90% of your daily budget';
    } else if (budgetStatus.percentUsed > 90) {
      warning = 'Monthly budget is nearly exhausted';
    } else if (budgetStatus.alertLevel === 'critical') {
      warning = budgetStatus.alertMessage || 'Budget in critical state';
    }

    return NextResponse.json({
      operation,
      platform,
      estimate: {
        inputTokens: estimate.inputTokens,
        outputTokens: estimate.outputTokens,
        costUsd: estimate.costUsd,
        costRange: estimate.costRange,
      },
      budget: {
        // Daily
        dailyBudget: Math.round(dailyBudget * 100) / 100,
        todaySpent: Math.round(todaySpend.totalCost * 10000) / 10000,
        todayCallCount: todaySpend.callCount,
        afterOperation: Math.round(afterOperation * 10000) / 10000,
        percentOfDaily: Math.round(percentOfDaily * 10) / 10,
        // Monthly
        monthlyBudget: budgetStatus.monthlyBudget,
        monthSpent: Math.round(budgetStatus.totalSpent * 100) / 100,
        monthlyRemaining: Math.round(budgetStatus.remaining * 100) / 100,
        percentOfMonthly: Math.round(budgetStatus.percentUsed * 10) / 10,
        // Status
        alertLevel: budgetStatus.alertLevel,
        daysRemaining: budgetStatus.daysRemaining,
      },
      warning,
    });
  } catch (error) {
    console.error('Error estimating cost:', error);
    return NextResponse.json(
      { error: 'Failed to estimate cost' },
      { status: 500 }
    );
  }
}
