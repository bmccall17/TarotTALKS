import { NextResponse } from 'next/server';
import { forceResetCircuitBreaker, getCircuitBreakerStatus } from '@/lib/services/gemini';

/**
 * POST /api/admin/api-usage/reset-circuit-breaker
 *
 * Force resets the Gemini circuit breaker.
 * WARNING: This allows API calls to proceed even if quota may still be exhausted.
 */
export async function POST() {
  try {
    const result = forceResetCircuitBreaker();

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    const newStatus = getCircuitBreakerStatus();

    return NextResponse.json({
      success: true,
      message: result.message,
      circuitBreaker: newStatus,
    });
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    return NextResponse.json(
      { error: 'Failed to reset circuit breaker' },
      { status: 500 }
    );
  }
}
