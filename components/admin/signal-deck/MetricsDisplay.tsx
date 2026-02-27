'use client';

import { useState } from 'react';
import { Heart, Repeat2, MessageCircle, RefreshCw, Loader2, PenSquare } from 'lucide-react';
import { platformSupportsAutoMetrics, getPlatformMetricLabels, type Platform } from '@/lib/utils/social-handles';

type Props = {
  shareId: string;
  platform: Platform;
  likeCount: number | null;
  repostCount: number | null;
  replyCount: number | null;
  metricsUpdatedAt: Date | string | null;
  metricsSource?: 'auto' | 'manual' | null;
  onMetricsUpdate?: (metrics: { likeCount: number; repostCount: number; replyCount: number }) => void;
};

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MetricsDisplay({
  shareId,
  platform,
  likeCount,
  repostCount,
  replyCount,
  metricsUpdatedAt,
  metricsSource,
  onMetricsUpdate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For manual editing (non-Bluesky)
  const [editing, setEditing] = useState(false);
  const [editLikes, setEditLikes] = useState(likeCount ?? 0);
  const [editReposts, setEditReposts] = useState(repostCount ?? 0);
  const [editReplies, setEditReplies] = useState(replyCount ?? 0);

  const supportsAutoMetrics = platformSupportsAutoMetrics(platform);
  const labels = getPlatformMetricLabels(platform);
  const totalEngagement = (likeCount ?? 0) + (repostCount ?? 0) + (replyCount ?? 0);

  // Staleness: green = updated within 7 days, amber = older or never
  const isFresh = (() => {
    if (!metricsUpdatedAt) return false;
    const updated = typeof metricsUpdatedAt === 'string' ? new Date(metricsUpdatedAt) : metricsUpdatedAt;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return updated > sevenDaysAgo;
  })();

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/social-shares/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to refresh');
      }

      const data = await res.json();
      onMetricsUpdate?.({
        likeCount: data.share.likeCount ?? 0,
        repostCount: data.share.repostCount ?? 0,
        replyCount: data.share.replyCount ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManual = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/social-shares/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId,
          metrics: {
            likeCount: editLikes,
            repostCount: editReposts,
            replyCount: editReplies,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      onMetricsUpdate?.({
        likeCount: data.share.likeCount ?? 0,
        repostCount: data.share.repostCount ?? 0,
        replyCount: data.share.replyCount ?? 0,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Manual editing mode for non-Bluesky
  if (!supportsAutoMetrics && editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" title={labels.likes}>
            <Heart className="w-3 h-3 text-pink-400" />
            <input
              type="number"
              min="0"
              value={editLikes}
              onChange={(e) => setEditLikes(parseInt(e.target.value) || 0)}
              className="w-14 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded"
            />
          </div>
          {labels.reposts && (
            <div className="flex items-center gap-1" title={labels.reposts}>
              <Repeat2 className="w-3 h-3 text-green-400" />
              <input
                type="number"
                min="0"
                value={editReposts}
                onChange={(e) => setEditReposts(parseInt(e.target.value) || 0)}
                className="w-14 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded"
              />
            </div>
          )}
          <div className="flex items-center gap-1" title={labels.replies}>
            <MessageCircle className="w-3 h-3 text-blue-400" />
            <input
              type="number"
              min="0"
              value={editReplies}
              onChange={(e) => setEditReplies(parseInt(e.target.value) || 0)}
              className="w-14 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveManual}
            disabled={loading}
            className="px-2 py-0.5 text-xs bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-2 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 rounded"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Metrics display */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1" title={labels.likes}>
          <Heart className="w-3 h-3 text-pink-400" />
          {likeCount ?? 0}
        </span>
        {labels.reposts && (
          <span className="flex items-center gap-1" title={labels.reposts}>
            <Repeat2 className="w-3 h-3 text-green-400" />
            {repostCount ?? 0}
          </span>
        )}
        <span className="flex items-center gap-1" title={labels.replies}>
          <MessageCircle className="w-3 h-3 text-blue-400" />
          {replyCount ?? 0}
        </span>
      </div>

      {/* Manual badge for non-auto platforms */}
      {!supportsAutoMetrics && metricsSource === 'manual' && totalEngagement > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-400 rounded" title="Manually entered metrics">
          Manual
        </span>
      )}

      {/* Staleness indicator */}
      {supportsAutoMetrics && (
        <span
          className={`inline-block w-2 h-2 rounded-full ${isFresh ? 'bg-green-400' : 'bg-amber-400'}`}
          title={isFresh ? `Fresh (updated ${formatRelativeTime(metricsUpdatedAt)})` : `Stale (updated ${formatRelativeTime(metricsUpdatedAt)})`}
        />
      )}

      {/* Action button */}
      {supportsAutoMetrics ? (
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-50"
          title={`Refresh metrics (updated ${formatRelativeTime(metricsUpdatedAt)})`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      ) : (
        <button
          onClick={() => {
            setEditLikes(likeCount ?? 0);
            setEditReposts(repostCount ?? 0);
            setEditReplies(replyCount ?? 0);
            setEditing(true);
          }}
          className="p-1 text-gray-500 hover:text-gray-300"
          title="Edit metrics manually"
        >
          <PenSquare className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Error */}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
