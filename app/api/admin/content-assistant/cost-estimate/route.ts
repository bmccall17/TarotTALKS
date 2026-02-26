import { NextRequest, NextResponse } from 'next/server';
import { estimateOperationCost } from '@/lib/services/content-assistant';
import { getGeminiBudgetStatus } from '@/lib/db/queries/admin-api-usage';

type Operation = 'strategy' | 'content' | 'regenerate' | 'full-week';
const VALID_OPERATIONS: Operation[] = ['strategy', 'content', 'regenerate', 'full-week'];

/**
 * GET /api/admin/content-assistant/cost-estimate?operation=full-week
 * Pre-generation cost check
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') as Operation | null;

    if (!operation || !VALID_OPERATIONS.includes(operation)) {
      return NextResponse.json(
        { error: 'Valid operation is required (strategy, content, regenerate, full-week)' },
        { status: 400 }
      );
    }

    const estimate = estimateOperationCost(operation);

    // Get budget status
    let budget = null;
    let warning: string | undefined;
    try {
      const status = await getGeminiBudgetStatus();
      const dailyBudget = status.monthlyBudget / 30;
      const todayEstimated = status.dailyAverage; // Approximate today's spend from daily average
      const afterOperation = todayEstimated + estimate.costUsd;

      if (afterOperation > dailyBudget * 0.9) {
        warning = 'Approaching daily budget limit';
      }
      if (afterOperation > dailyBudget) {
        warning = 'This operation would exceed the daily budget';
      }

      budget = {
        dailyBudget,
        todaySpent: todayEstimated,
        afterOperation,
        percentOfDaily: (afterOperation / dailyBudget) * 100,
        monthlyBudget: status.monthlyBudget,
        monthSpent: status.totalSpent,
        monthlyRemaining: status.remaining,
        percentOfMonthly: status.percentUsed,
        alertLevel: status.alertLevel,
      };
    } catch (e) {
      console.warn('Could not fetch budget status:', e);
    }

    return NextResponse.json({
      operation,
      estimate,
      budget,
      warning,
    });
  } catch (error) {
    console.error('Error estimating cost:', error);
    return NextResponse.json({ error: 'Failed to estimate cost' }, { status: 500 });
  }
}
