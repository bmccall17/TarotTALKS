'use client';

import { useState, useEffect } from 'react';
import { ApiStatusPair, type ApiHealthData } from '@/components/admin/ui/ApiStatusIndicator';
import { Activity, ChevronDown, ChevronUp, ExternalLink, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

type BudgetStatus = {
  periodStart: string;
  periodEnd: string;
  daysInPeriod: number;
  daysPassed: number;
  daysRemaining: number;
  totalSpent: number;
  dailyAverage: number;
  projectedMonthly: number;
  monthlyBudget: number;
  remaining: number;
  percentUsed: number;
  alertLevel: 'ok' | 'warning' | 'danger' | 'critical';
  alertMessage: string | null;
};

type TodaySpend = {
  totalCost: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  avgCostPerCall: number;
};

type GeminiStats = ApiHealthData & {
  model?: string;
  todaySpend?: TodaySpend;
  dailyBudget?: number;
  budget?: BudgetStatus;
};

type ApiUsageStats = {
  gemini: GeminiStats;
  youtube: ApiHealthData;
  attribution: {
    geminiCalls: number;
    youtubeCalls: number;
    geminiSuccessful: number;
    youtubeSuccessful: number;
  };
};

type ApiCallLog = {
  id: string;
  success: boolean;
  errorType: string | null;
  source: string | null;
  createdAt: string;
  properties: {
    queries?: string[];
    queriesCount?: number;
    resultsCount?: number;
    results?: Array<{ id: string; title: string; channel: string }>;
    selectedTalkId?: string;
    selectedTalkTitle?: string;
    spreadId?: string;
    spreadUrl?: string;
    fallbackMode?: boolean;
    youtubeUsed?: boolean;
    cardNames?: string[];
    defaultToTed?: boolean;
  };
};

function BudgetWidget({ budget, todaySpend, model }: { budget?: BudgetStatus; todaySpend?: TodaySpend; model?: string }) {
  if (!budget) return null;

  const alertColors = {
    ok: 'text-green-400 bg-green-500/10',
    warning: 'text-yellow-400 bg-yellow-500/10',
    danger: 'text-orange-400 bg-orange-500/10',
    critical: 'text-red-400 bg-red-500/10',
  };

  const progressColors = {
    ok: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-gray-200">Gemini Budget</span>
          {model && (
            <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
              {model}
            </span>
          )}
        </div>
        {budget.alertLevel !== 'ok' && (
          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${alertColors[budget.alertLevel]}`}>
            <AlertTriangle className="w-3 h-3" />
            {budget.alertLevel === 'critical' ? 'CRITICAL' : budget.alertLevel === 'danger' ? 'HIGH' : 'WATCH'}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">
            ${budget.totalSpent.toFixed(2)} / ${budget.monthlyBudget.toFixed(2)}
          </span>
          <span className="text-gray-400">{budget.percentUsed.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColors[budget.alertLevel]} transition-all duration-500`}
            style={{ width: `${Math.min(100, budget.percentUsed)}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-lg font-semibold text-gray-100">
            ${budget.remaining.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500">Remaining</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-lg font-semibold text-gray-100">
            ${budget.dailyAverage.toFixed(3)}
          </div>
          <div className="text-[10px] text-gray-500">Daily Avg</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-lg font-semibold text-gray-100 flex items-center justify-center gap-1">
            ${budget.projectedMonthly.toFixed(2)}
            {budget.projectedMonthly > budget.monthlyBudget && (
              <TrendingUp className="w-3 h-3 text-red-400" />
            )}
          </div>
          <div className="text-[10px] text-gray-500">Projected</div>
        </div>
      </div>

      {/* Today's spend */}
      {todaySpend && todaySpend.callCount > 0 && (
        <div className="mt-3 p-2 bg-gray-800/30 rounded-lg">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Today</span>
            <span className="text-gray-200">
              ${todaySpend.totalCost.toFixed(4)} ({todaySpend.callCount} calls)
            </span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {todaySpend.inputTokens.toLocaleString()} in + {todaySpend.outputTokens.toLocaleString()} out tokens
          </div>
        </div>
      )}

      {/* Alert message */}
      {budget.alertMessage && (
        <div className={`mt-3 p-2 rounded text-xs ${alertColors[budget.alertLevel]}`}>
          {budget.alertMessage}
        </div>
      )}

      {/* Days info */}
      <div className="mt-2 text-[10px] text-gray-500 text-center">
        Day {budget.daysPassed} of {budget.daysInPeriod} ({budget.daysRemaining} days left)
      </div>
    </div>
  );
}

export function ApiHealthSection() {
  const [stats, setStats] = useState<ApiUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collapsible logs state
  const [showYouTubeLogs, setShowYouTubeLogs] = useState(false);
  const [youtubeLogs, setYoutubeLogs] = useState<ApiCallLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/api-usage?days=7');
        if (!response.ok) throw new Error('Failed to fetch API stats');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  // Fetch logs when expanded
  useEffect(() => {
    if (showYouTubeLogs && youtubeLogs.length === 0 && !logsLoading) {
      setLogsLoading(true);
      fetch('/api/admin/api-usage/logs?api=youtube&days=7&limit=10')
        .then(res => res.json())
        .then(data => {
          setYoutubeLogs(data.logs || []);
        })
        .catch(err => {
          console.error('Failed to fetch logs:', err);
        })
        .finally(() => {
          setLogsLoading(false);
        });
    }
  }, [showYouTubeLogs, youtubeLogs.length, logsLoading]);

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">API Health & Budget</h2>
        </div>
        <div className="animate-pulse flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
            <div className="h-4 w-12 bg-gray-700 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
            <div className="h-4 w-14 bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">API Health & Budget</h2>
        </div>
        <p className="text-gray-500 text-sm">Unable to load API stats</p>
      </div>
    );
  }

  const allHealthy = stats.gemini.isHealthy && stats.youtube.isHealthy;
  const budgetOk = !stats.gemini.budget || stats.gemini.budget.alertLevel === 'ok';

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">API Health & Budget</h2>
          {allHealthy && budgetOk ? (
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">All systems go</span>
          ) : !allHealthy ? (
            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Issues detected</span>
          ) : (
            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">Budget alert</span>
          )}
        </div>
        <Link
          href="/admin/behavior"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Details →
        </Link>
      </div>

      <ApiStatusPair gemini={stats.gemini} youtube={stats.youtube} compact />

      {/* Budget Widget */}
      <BudgetWidget
        budget={stats.gemini.budget}
        todaySpend={stats.gemini.todaySpend}
        model={stats.gemini.model}
      />

      {/* Quick attribution summary */}
      {(stats.attribution.geminiCalls > 0 || stats.attribution.youtubeCalls > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Last 7 days: {stats.attribution.geminiCalls} Gemini calls, {stats.attribution.youtubeCalls} YouTube calls
          </p>
        </div>
      )}

      {/* Collapsible YouTube Logs */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <button
          onClick={() => setShowYouTubeLogs(!showYouTubeLogs)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors w-full"
        >
          {showYouTubeLogs ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <span>Recent YouTube Calls</span>
          {logsLoading && <span className="text-xs text-gray-500">(loading...)</span>}
        </button>

        {showYouTubeLogs && (
          <div className="mt-3 space-y-3 max-h-80 overflow-y-auto">
            {youtubeLogs.length === 0 && !logsLoading && (
              <p className="text-xs text-gray-500">No recent calls</p>
            )}
            {youtubeLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border text-xs ${
                  log.success
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-red-900/20 border-red-800/50'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">{formatRelativeTime(log.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    {log.properties.fallbackMode && (
                      <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
                        fallback
                      </span>
                    )}
                    <span className={log.success ? 'text-green-400' : 'text-red-400'}>
                      {log.success ? 'SUCCESS' : log.errorType?.toUpperCase() || 'ERROR'}
                    </span>
                  </div>
                </div>

                {/* Source */}
                {log.source && (
                  <div className="text-gray-500 mb-1">
                    Source: <span className="text-gray-400">{log.source}</span>
                  </div>
                )}

                {/* Queries */}
                {log.properties.queries && log.properties.queries.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500">Queries:</span>
                    <div className="mt-1 space-y-1">
                      {log.properties.queries.map((q, i) => (
                        <div key={i} className="text-gray-300 bg-gray-900/50 px-2 py-1 rounded font-mono text-[10px]">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results */}
                {log.properties.results && log.properties.results.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500">
                      Results: {log.properties.results.length} video{log.properties.results.length !== 1 ? 's' : ''}
                    </span>
                    <div className="mt-1 space-y-1">
                      {log.properties.results.slice(0, 3).map((r, i) => (
                        <div key={i} className="text-gray-400 text-[10px] truncate">
                          <span className="text-indigo-400">{r.channel}</span>: {r.title}
                        </div>
                      ))}
                      {log.properties.results.length > 3 && (
                        <div className="text-gray-500 text-[10px]">
                          +{log.properties.results.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selection (from spread_selection logs) */}
                {log.properties.selectedTalkTitle && (
                  <div className="mb-2">
                    <span className="text-gray-500">Selected:</span>
                    <div className="text-green-400 text-[10px] mt-1 truncate">
                      {log.properties.selectedTalkTitle}
                    </div>
                  </div>
                )}

                {/* Spread Link */}
                {log.properties.spreadUrl && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <a
                      href={log.properties.spreadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[10px]"
                    >
                      View Spread <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Card Names */}
                {log.properties.cardNames && log.properties.cardNames.length > 0 && (
                  <div className="text-gray-500 text-[10px] mt-1">
                    Cards: {log.properties.cardNames.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
