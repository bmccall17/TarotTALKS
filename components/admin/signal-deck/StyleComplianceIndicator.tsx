'use client';

import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import type { StyleComplianceIndicator as ComplianceIndicator } from '@/lib/services/platform-style-ai';

type Props = {
  indicators: ComplianceIndicator[];
  compact?: boolean;
};

function getOverallScore(indicators: ComplianceIndicator[]): number {
  if (indicators.length === 0) return 0;

  const scores = indicators.map(i => {
    switch (i.status) {
      case 'compliant': return 100;
      case 'warning': return 60;
      case 'deviation': return 20;
      default: return 50;
    }
  });

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function StatusIcon({ status }: { status: ComplianceIndicator['status'] }) {
  switch (status) {
    case 'compliant':
      return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
    case 'deviation':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  }
}

export function StyleComplianceIndicator({ indicators, compact = false }: Props) {
  const score = getOverallScore(indicators);
  const scoreColor = getScoreColor(score);
  const scoreBgColor = getScoreBgColor(score);

  if (compact) {
    // Compact badge for inline display
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800 border border-gray-700"
        title={`Style compliance: ${score}%`}
      >
        <div className={`w-2 h-2 rounded-full ${scoreBgColor}`} />
        <span className={`text-xs font-medium ${scoreColor}`}>{score}%</span>
      </div>
    );
  }

  // Full display with individual indicators
  return (
    <div className="space-y-2">
      {/* Overall Score */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Style Match:</span>
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreBgColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${scoreColor}`}>{score}%</span>
      </div>

      {/* Individual Indicators */}
      <div className="space-y-1.5">
        {indicators.map((indicator, i) => (
          <div key={i} className="flex items-start gap-2">
            <StatusIcon status={indicator.status} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300">{indicator.message}</p>
              {indicator.suggestion && (
                <p className="text-xs text-gray-500 mt-0.5">{indicator.suggestion}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
