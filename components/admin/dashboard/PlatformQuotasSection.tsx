'use client';

import { useState, useEffect } from 'react';
import { Database, Image, Users, ExternalLink, Gauge, TrendingUp, TrendingDown, Minus, Rows3 } from 'lucide-react';

type BillingCycleInfo = {
  start: string;
  end: string;
  daysPassed: number;
  daysRemaining: number;
  daysTotal: number;
};

type DatabaseSize = {
  bytes: number;
  mb: number;
  limitMb: number;
  percent: number;
};

type ImageSourceCount = {
  cards: number;
  talks: number;
  total: number;
  limit: number;
  percent: number;
};

type SessionTrend = {
  today: number;
  avgDaily: number;
  trend: 'up' | 'down' | 'stable';
};

type RowCountInfo = {
  tables: Array<{ name: string; count: number }>;
  total: number;
  limit: number;
  percent: number;
};

type PlatformUsageData = {
  billingCycle: BillingCycleInfo;
  dbSize: DatabaseSize;
  imageSources: ImageSourceCount;
  sessionTrend: SessionTrend;
  rowCounts: RowCountInfo;
};

function getProgressColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-orange-500';
  if (percent >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getProgressTextColor(percent: number): string {
  if (percent >= 90) return 'text-red-400';
  if (percent >= 75) return 'text-orange-400';
  if (percent >= 50) return 'text-yellow-400';
  return 'text-green-400';
}

const SUPABASE_REF = process.env.NEXT_PUBLIC_SUPABASE_REF || '';

export function PlatformQuotasSection() {
  const [data, setData] = useState<PlatformUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/platform-usage');
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.detail || `HTTP ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">Platform Quotas</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-2/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">Platform Quotas</h2>
        </div>
        <p className="text-gray-500 text-sm">Unable to load platform usage data</p>
        {error && (
          <p className="text-gray-600 text-xs mt-1 font-mono">{error}</p>
        )}
      </div>
    );
  }

  const { billingCycle, dbSize, imageSources, sessionTrend, rowCounts } = data;

  const cyclePercent = billingCycle.daysTotal > 0
    ? Math.round((billingCycle.daysPassed / billingCycle.daysTotal) * 100)
    : 0;

  const TrendIcon = sessionTrend.trend === 'up' ? TrendingUp
    : sessionTrend.trend === 'down' ? TrendingDown
    : Minus;

  const trendColor = sessionTrend.trend === 'up' ? 'text-yellow-400'
    : sessionTrend.trend === 'down' ? 'text-green-400'
    : 'text-gray-400';

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">Platform Quotas</h2>
        </div>
        <span className="text-xs text-gray-500">16th–16th billing cycle</span>
      </div>

      {/* Billing Cycle Bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-300">
            Day {billingCycle.daysPassed} of {billingCycle.daysTotal}
          </span>
          <span className="text-gray-400">
            {billingCycle.daysRemaining} days remaining
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${cyclePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>{billingCycle.start}</span>
          <span>{billingCycle.end}</span>
        </div>
      </div>

      {/* Quota Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        {/* DB Size */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300">DB Size</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold text-gray-100">{dbSize.mb}</span>
            <span className="text-sm text-gray-500">/ {dbSize.limitMb} MB</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full ${getProgressColor(dbSize.percent)} transition-all`}
              style={{ width: `${Math.min(100, dbSize.percent)}%` }}
            />
          </div>
          <span className={`text-xs ${getProgressTextColor(dbSize.percent)}`}>
            {dbSize.percent}%
          </span>
        </div>

        {/* Image Sources */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Image className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">Image Sources</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold text-gray-100">{imageSources.total}</span>
            <span className="text-sm text-gray-500">/ {imageSources.limit}</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full ${getProgressColor(imageSources.percent)} transition-all`}
              style={{ width: `${Math.min(100, imageSources.percent)}%` }}
            />
          </div>
          <span className={`text-xs ${getProgressTextColor(imageSources.percent)}`}>
            {imageSources.percent}%
          </span>
          <span className="text-[10px] text-gray-500 ml-2">
            {imageSources.cards} cards + {imageSources.talks} talks
          </span>
        </div>

        {/* Daily Sessions */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-gray-300">Daily Sessions</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-gray-100">{sessionTrend.today}</span>
            <span className="text-sm text-gray-500">today</span>
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          </div>
          <div className="text-xs text-gray-400">
            7-day avg: <span className="text-gray-300">{sessionTrend.avgDaily}</span>/day
          </div>
          <div className={`text-[10px] mt-1 ${trendColor}`}>
            {sessionTrend.trend === 'up' && 'Above average — watch egress'}
            {sessionTrend.trend === 'down' && 'Below average'}
            {sessionTrend.trend === 'stable' && 'Stable'}
          </div>
        </div>

        {/* Row Count */}
        {rowCounts && (
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Rows3 className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">DB Rows</span>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-bold text-gray-100">
                {rowCounts.total >= 1000 ? `${(rowCounts.total / 1000).toFixed(1)}K` : rowCounts.total}
              </span>
              <span className="text-sm text-gray-500">/ {(rowCounts.limit / 1000).toFixed(0)}K</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full ${getProgressColor(rowCounts.percent)} transition-all`}
                style={{ width: `${Math.min(100, rowCounts.percent)}%` }}
              />
            </div>
            <span className={`text-xs ${getProgressTextColor(rowCounts.percent)}`}>
              {rowCounts.percent}%
            </span>
            {rowCounts.tables.length > 0 && (
              <div className="text-[10px] text-gray-500 mt-1">
                Top: {rowCounts.tables.slice(0, 3).map(t => `${t.name} (${t.count})`).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dashboard Links */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-700">
        <a
          href={SUPABASE_REF
            ? `https://supabase.com/dashboard/project/${SUPABASE_REF}/settings/billing/usage`
            : 'https://supabase.com/dashboard'
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Supabase Usage <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a
          href="https://vercel.com/dashboard/usage"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Vercel Usage <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <span className="text-[10px] text-gray-500 self-center">
          Check egress & bandwidth on these dashboards
        </span>
      </div>
    </div>
  );
}
