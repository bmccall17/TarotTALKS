'use client';

import { X, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

export type CostEstimate = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costRange?: { min: number; max: number };
};

export type BudgetImpact = {
  dailyBudget: number;
  todaySpent: number;
  afterOperation: number;
  percentOfDaily: number;
  monthlyBudget: number;
  monthSpent: number;
  monthlyRemaining: number;
  percentOfMonthly: number;
  alertLevel?: 'ok' | 'warning' | 'danger' | 'critical';
};

type Props = {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;

  // Operation info
  operationName: string;
  operationDescription: string;

  // Cost data
  estimate: CostEstimate;
  budget: BudgetImpact;

  // Optional warning from API
  warning?: string;
};

function formatCost(cost: number): string {
  if (cost < 0.0001) return '<$0.0001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function BudgetBar({ label, current, max, className }: {
  label: string;
  current: number;
  max: number;
  className?: string;
}) {
  const percent = Math.min((current / max) * 100, 100);
  const barColor = percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-amber-500' : percent > 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{formatCost(current)} / {formatCost(max)}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-500 mt-0.5">
        {percent.toFixed(1)}% used
      </div>
    </div>
  );
}

export function CostWarningModal({
  isOpen,
  onConfirm,
  onCancel,
  loading = false,
  operationName,
  operationDescription,
  estimate,
  budget,
  warning,
}: Props) {
  if (!isOpen) return null;

  const isHighRisk = budget.alertLevel === 'critical' || budget.alertLevel === 'danger';
  const headerColor = isHighRisk ? 'text-red-400' : 'text-amber-400';
  const confirmButtonClass = isHighRisk
    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-800'
    : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-700 ${headerColor}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">{operationName}</h2>
              <p className="text-sm text-gray-400">{operationDescription}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cost Display */}
        <div className="p-6 space-y-4">
          {/* Estimated Cost */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Estimated Cost</span>
              <span className={`text-2xl font-bold ${headerColor}`}>
                {formatCost(estimate.costUsd)}
              </span>
            </div>
            {estimate.costRange && (
              <p className="text-xs text-gray-500">
                Typical range: {formatCost(estimate.costRange.min)} - {formatCost(estimate.costRange.max)}
              </p>
            )}
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>~{estimate.inputTokens.toLocaleString()} input tokens</span>
              <span>~{estimate.outputTokens.toLocaleString()} output tokens</span>
            </div>
          </div>

          {/* Budget Impact */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <TrendingUp className="w-4 h-4" />
              <span>Budget Impact</span>
            </div>

            <BudgetBar
              label="Today's Usage"
              current={budget.afterOperation}
              max={budget.dailyBudget}
            />

            <BudgetBar
              label="Monthly Usage"
              current={budget.monthSpent + estimate.costUsd}
              max={budget.monthlyBudget}
            />

            <div className="text-xs text-gray-500 flex justify-between">
              <span>Days remaining: {budget.monthlyRemaining > 0 ? Math.ceil(budget.monthlyRemaining / (budget.monthlyBudget / 30)) : 0}</span>
              <span>Budget remaining: {formatCost(budget.monthlyRemaining)}</span>
            </div>
          </div>

          {/* Warning */}
          {warning && (
            <div className="flex items-start gap-3 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">{warning}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Gemini 2.0 Flash API
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${confirmButtonClass}`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>Proceed ({formatCost(estimate.costUsd)})</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
