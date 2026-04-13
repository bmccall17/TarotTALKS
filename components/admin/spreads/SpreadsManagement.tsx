'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Filter, Trash2, ExternalLink, RefreshCw, Layers, Share2, Eye, Ghost } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Toast } from '../ui/Toast';

type SpreadStats = {
  total: number;
  shared: number;
  viewed: number;
  orphaned: number;
  orphanedOlderThan30Days: number;
};

type SpreadListItem = {
  id: string;
  shortId: string;
  card1Name: string | null;
  card2Name: string | null;
  card3Name: string | null;
  talkTitle: string | null;
  viewCount: number;
  isShared: boolean;
  createdAt: string;
  status: 'shared' | 'viewed' | 'orphan';
};

type FilterOption = 'all' | 'shared' | 'viewed' | 'orphaned';

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All Spreads' },
  { value: 'shared', label: 'Shared' },
  { value: 'viewed', label: 'Viewed Only' },
  { value: 'orphaned', label: 'Orphaned' },
];

export function SpreadsManagement() {
  const [stats, setStats] = useState<SpreadStats | null>(null);
  const [spreads, setSpreads] = useState<SpreadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [offset, setOffset] = useState(0);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const limit = 20;

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      await Sentry.startSpan({ name: 'admin.spreads.fetchStats', op: 'http.client' }, async () => {
        const response = await fetch('/api/admin/spreads/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data.stats);
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      showToast('Failed to load statistics', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchSpreads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        filter,
        limit: limit.toString(),
        offset: offset.toString(),
      });
      await Sentry.startSpan(
        { name: 'admin.spreads.fetchSpreads', op: 'http.client', attributes: { filter, offset } },
        async () => {
          const response = await fetch(`/api/admin/spreads?${params}`);
          if (!response.ok) throw new Error('Failed to fetch spreads');
          const data = await response.json();
          setSpreads(data.spreads);
          setTotal(data.total);
        },
      );
    } catch (error) {
      console.error('Error fetching spreads:', error);
      showToast('Failed to load spreads', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchSpreads();
  }, [filter]);

  useEffect(() => {
    fetchSpreads();
  }, [offset]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleCleanup = async () => {
    try {
      setCleanupLoading(true);
      const response = await fetch('/api/admin/spreads/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysOld: 30 }),
      });

      if (!response.ok) throw new Error('Failed to cleanup spreads');

      const data = await response.json();
      setShowCleanupConfirm(false);
      showToast(`Deleted ${data.deletedCount} orphaned spreads`, 'success');

      // Refresh data
      await Promise.all([fetchStats(), fetchSpreads()]);
    } catch (error) {
      console.error('Error cleaning up spreads:', error);
      showToast('Failed to cleanup spreads', 'error');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleStatCardClick = (statFilter: FilterOption) => {
    setFilter(statFilter);
  };

  const formatCardNames = (item: SpreadListItem) => {
    const names = [item.card1Name, item.card2Name, item.card3Name].filter(Boolean);
    if (names.length === 0) return '-';
    if (names.length <= 2) return names.join(', ');
    return `${names[0]}, ${names[1]}, ...`;
  };

  const getStatusBadge = (status: 'shared' | 'viewed' | 'orphan') => {
    switch (status) {
      case 'shared':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700/50">
            <Share2 className="w-3 h-3" />
            Shared
          </span>
        );
      case 'viewed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50">
            <Eye className="w-3 h-3" />
            Viewed
          </span>
        );
      case 'orphan':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600/50">
            <Ghost className="w-3 h-3" />
            Orphan
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => handleStatCardClick('all')}
          className={`p-4 rounded-xl border transition-all text-left ${
            filter === 'all'
              ? 'bg-indigo-600/20 border-indigo-500'
              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Layers className="w-4 h-4" />
            <span className="text-sm">Total</span>
          </div>
          <div className="text-2xl font-bold text-gray-100">
            {statsLoading ? '...' : stats?.total ?? 0}
          </div>
        </button>

        <button
          onClick={() => handleStatCardClick('shared')}
          className={`p-4 rounded-xl border transition-all text-left ${
            filter === 'shared'
              ? 'bg-green-600/20 border-green-500'
              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Share2 className="w-4 h-4" />
            <span className="text-sm">Shared</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {statsLoading ? '...' : stats?.shared ?? 0}
          </div>
        </button>

        <button
          onClick={() => handleStatCardClick('viewed')}
          className={`p-4 rounded-xl border transition-all text-left ${
            filter === 'viewed'
              ? 'bg-blue-600/20 border-blue-500'
              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-sm">Viewed</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {statsLoading ? '...' : stats?.viewed ?? 0}
          </div>
        </button>

        <button
          onClick={() => handleStatCardClick('orphaned')}
          className={`p-4 rounded-xl border transition-all text-left ${
            filter === 'orphaned'
              ? 'bg-orange-600/20 border-orange-500'
              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Ghost className="w-4 h-4" />
            <span className="text-sm">Orphaned</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {statsLoading ? '...' : stats?.orphaned ?? 0}
            {stats && stats.orphanedOlderThan30Days > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({stats.orphanedOlderThan30Days} &gt; 30d)
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
              className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              fetchStats();
              fetchSpreads();
            }}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {stats && stats.orphanedOlderThan30Days > 0 && (
          <button
            onClick={() => setShowCleanupConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">Cleanup Orphans ({stats.orphanedOlderThan30Days})</span>
          </button>
        )}
      </div>

      {/* Spreads Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading spreads...</div>
        ) : spreads.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No spreads found with the current filter.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Short ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Cards
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Talk
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {spreads.map((spread) => (
                    <tr key={spread.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <code className="text-sm text-indigo-400 font-mono">
                          {spread.shortId}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 max-w-[200px] truncate">
                        {formatCardNames(spread)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 max-w-[250px] truncate">
                        {spread.talkTitle || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">
                        {spread.viewCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(spread.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(spread.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={`/spread/${spread.shortId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded transition-colors"
                          title="Open spread page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1 text-sm text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1 text-sm text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cleanup Confirmation Dialog */}
      {showCleanupConfirm && stats && (
        <ConfirmDialog
          title="Cleanup Orphaned Spreads"
          message={`This will permanently delete ${stats.orphanedOlderThan30Days} orphaned spreads that are older than 30 days. These are spreads that were never shared or viewed. This action cannot be undone.`}
          confirmLabel={`Delete ${stats.orphanedOlderThan30Days} Spreads`}
          onConfirm={handleCleanup}
          onCancel={() => setShowCleanupConfirm(false)}
          loading={cleanupLoading}
          variant="danger"
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
