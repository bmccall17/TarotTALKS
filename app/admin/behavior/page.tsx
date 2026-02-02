'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users, BarChart3, Target, Clock, Smartphone, Monitor } from 'lucide-react';

type FlipDistribution = {
  flipCount: number;
  sessions: number;
  percentage: number;
};

type FunnelStep = {
  step: string;
  sessions: number;
  percentage: number;
  dropoff: number;
};

type BehaviorStats = {
  sessionStats: {
    totalSessions: number;
    bounceRate: number;
    engagedSessions: number;
  };
  flipDistribution: FlipDistribution[];
  funnelData: FunnelStep[];
  readSpreadCTR: {
    eligible: number;
    clicked: number;
    ctr: number;
  };
  timeToFirstFlip: {
    averageMs: number;
    medianMs: number;
  };
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    mobilePercentage: number;
    desktopPercentage: number;
  };
};

const TIME_RANGES = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
];

export default function BehaviorPage() {
  const [stats, setStats] = useState<BehaviorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/behavior?days=${days}`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [days]);

  const formatTime = (ms: number) => {
    if (ms === 0) return '-';
    const seconds = ms / 1000;
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${(seconds / 60).toFixed(1)}m`;
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const isLowSampleSize = stats.sessionStats.totalSessions < 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-100">Behavior Analytics</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 text-sm"
        >
          {TIME_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {/* Low Sample Warning */}
      {isLowSampleSize && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <p className="text-yellow-400 text-sm">
            Low sample size ({stats.sessionStats.totalSessions} sessions) - metrics may not be reliable
          </p>
        </div>
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<Users className="w-5 h-5" />}
          label="Sessions"
          value={stats.sessionStats.totalSessions.toLocaleString()}
          subtext={`${stats.sessionStats.engagedSessions} engaged`}
        />
        <MetricCard
          icon={<Target className="w-5 h-5" />}
          label="Bounce Rate"
          value={formatPercent(stats.sessionStats.bounceRate)}
          subtext="Sessions with 0 flips"
          isWarning={stats.sessionStats.bounceRate > 50}
        />
        <MetricCard
          icon={<Clock className="w-5 h-5" />}
          label="Time to First Flip"
          value={formatTime(stats.timeToFirstFlip.medianMs)}
          subtext={`Avg: ${formatTime(stats.timeToFirstFlip.averageMs)}`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flip Distribution */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-1 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Flip Distribution
          </h2>
          <p className="text-xs text-gray-500 mb-4">Home page sessions only</p>
          <div className="space-y-3">
            {stats.flipDistribution.map((item) => (
              <div key={item.flipCount} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {item.flipCount === 0 ? '0 flips' : `${item.flipCount} flip${item.flipCount > 1 ? 's' : ''}`}
                  </span>
                  <span className="text-gray-400">
                    {item.sessions} ({formatPercent(item.percentage)})
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.flipCount === 3 ? 'bg-green-500' :
                      item.flipCount === 0 ? 'bg-red-500' :
                      'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.max(item.percentage, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Landing Funnel */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            Landing Funnel
          </h2>
          <div className="space-y-3">
            {stats.funnelData.map((step, i) => (
              <div key={step.step} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-300">{step.step}</div>
                <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden relative">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.max(step.percentage, 1)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                    {step.sessions} ({formatPercent(step.percentage)})
                  </span>
                </div>
                {i > 0 && step.dropoff > 0 && (
                  <div className="w-16 text-xs text-red-400 text-right">
                    -{formatPercent(step.dropoff)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Read My Spread CTR */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Read My Spread CTR</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Eligible (2+ cards)</span>
              <span className="text-gray-200 font-medium">{stats.readSpreadCTR.eligible}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Clicked</span>
              <span className="text-gray-200 font-medium">{stats.readSpreadCTR.clicked}</span>
            </div>
            <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
              <span className="text-gray-300 font-medium">CTR</span>
              <span className="text-2xl font-bold text-indigo-400">
                {formatPercent(stats.readSpreadCTR.ctr)}
              </span>
            </div>
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Device Breakdown</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-300">
                <Smartphone className="w-5 h-5" />
                <span>Mobile</span>
              </div>
              <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${stats.deviceBreakdown.mobilePercentage}%` }}
                />
              </div>
              <span className="text-gray-400 text-sm w-16 text-right">
                {formatPercent(stats.deviceBreakdown.mobilePercentage)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-300">
                <Monitor className="w-5 h-5" />
                <span>Desktop</span>
              </div>
              <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${stats.deviceBreakdown.desktopPercentage}%` }}
                />
              </div>
              <span className="text-gray-400 text-sm w-16 text-right">
                {formatPercent(stats.deviceBreakdown.desktopPercentage)}
              </span>
            </div>
            <div className="text-xs text-gray-500 pt-2">
              Mobile: {stats.deviceBreakdown.mobile} | Desktop: {stats.deviceBreakdown.desktop}
            </div>
          </div>
        </div>
      </div>

      {/* Developer Tools */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Developer Tools</h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-400">Test Mode ON</span>
            <span className="text-gray-500 mx-2">—</span>
            <code className="bg-gray-900 text-indigo-300 px-2 py-1 rounded">?analytics_test=1</code>
            <span className="text-gray-500 ml-2">(skips Gemini/YouTube APIs)</span>
          </div>
          <div>
            <span className="text-gray-400">Test Mode OFF</span>
            <span className="text-gray-500 mx-2">—</span>
            <code className="bg-gray-900 text-indigo-300 px-2 py-1 rounded">?analytics_test=0</code>
          </div>
          <p className="text-gray-500 text-xs pt-2">
            Add to any page URL to toggle. Persists in localStorage until changed.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
  isWarning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  isWarning?: boolean;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${isWarning ? 'text-yellow-400' : 'text-gray-100'}`}>
        {value}
      </div>
      {subtext && (
        <div className="text-sm text-gray-500 mt-1">{subtext}</div>
      )}
    </div>
  );
}
