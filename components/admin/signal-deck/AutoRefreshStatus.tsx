'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type RefreshResult = {
  refreshed: number;
  failed: number;
  atUriBackfilled: number;
  skippedTimeout: number;
  total: number;
  elapsedMs: number;
};

type Props = {
  onRefreshComplete?: () => void;
};

export function AutoRefreshStatus({ onRefreshComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefreshAll = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/cron/refresh-bluesky-metrics', {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed (${res.status})`);
      }

      const data: RefreshResult = await res.json();
      setResult(data);
      onRefreshComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefreshAll}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors text-sm disabled:opacity-50"
        title="Refresh Bluesky metrics for all stale posts"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span>🦋</span>
        )}
        <span>Refresh All</span>
      </button>

      {result && !error && (
        <span className="text-xs text-gray-400">
          {result.refreshed}/{result.total} refreshed ({(result.elapsedMs / 1000).toFixed(1)}s)
          {result.failed > 0 && <span className="text-amber-400"> · {result.failed} failed</span>}
        </span>
      )}

      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}

/** Read admin_token from cookie */
function getAdminToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}
