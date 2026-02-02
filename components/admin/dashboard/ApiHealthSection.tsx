'use client';

import { useState, useEffect } from 'react';
import { ApiStatusPair, type ApiHealthData } from '@/components/admin/ui/ApiStatusIndicator';
import { Activity } from 'lucide-react';
import Link from 'next/link';

type ApiUsageStats = {
  gemini: ApiHealthData;
  youtube: ApiHealthData;
  attribution: {
    geminiCalls: number;
    youtubeCalls: number;
    geminiSuccessful: number;
    youtubeSuccessful: number;
  };
};

export function ApiHealthSection() {
  const [stats, setStats] = useState<ApiUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">API Health</h2>
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
          <h2 className="text-lg font-semibold text-gray-100">API Health</h2>
        </div>
        <p className="text-gray-500 text-sm">Unable to load API stats</p>
      </div>
    );
  }

  const allHealthy = stats.gemini.isHealthy && stats.youtube.isHealthy;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-100">API Health</h2>
          {allHealthy ? (
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">All systems go</span>
          ) : (
            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Issues detected</span>
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

      {/* Quick attribution summary */}
      {(stats.attribution.geminiCalls > 0 || stats.attribution.youtubeCalls > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Last 7 days: {stats.attribution.geminiCalls} Gemini calls, {stats.attribution.youtubeCalls} YouTube calls
          </p>
        </div>
      )}
    </div>
  );
}
