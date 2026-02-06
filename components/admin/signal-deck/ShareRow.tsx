'use client';

import { useState } from 'react';
import { ExternalLink, Edit2, Trash2, Check, Clock, FileText, MessageSquare, Eye, EyeOff, Radar, Loader2, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MetricsDisplay } from './MetricsDisplay';
import { RelationshipBadge } from './RelationshipBadge';
import { platformSupportsAutoMetrics, type Platform } from '@/lib/utils/social-handles';

type Share = {
  id: string;
  platform: Platform;
  postUrl: string | null;
  status: 'draft' | 'posted' | 'verified' | 'discovered' | 'acknowledged';
  postedAt: string;
  sharedUrl: string | null;
  speakerHandle: string | null;
  speakerName: string | null;
  notes: string | null;
  card?: { id: string; name: string; slug: string; imageUrl: string } | null;
  talk?: { id: string; title: string; slug: string; speakerName: string; thumbnailUrl: string | null } | null;
  // Phase 2-4 fields
  likeCount?: number | null;
  repostCount?: number | null;
  replyCount?: number | null;
  metricsUpdatedAt?: string | null;
  metricsSource?: 'auto' | 'manual' | null;
  followingSpeaker?: boolean | null;
  authorHandle?: string | null;
  authorDisplayName?: string | null;
  showPublicly?: boolean;
};

type Props = {
  share: Share;
  onEdit: (share: Share) => void;
  onDeleted: () => void;
  onStatusChanged?: () => void;
};

const platformIcons: Record<string, string> = {
  x: '𝕏',
  bluesky: '🦋',
  instagram: '📷',
  threads: '🧵',
  linkedin: '💼',
  other: '🔗',
};

const platformColors: Record<string, string> = {
  x: 'bg-gray-800 text-white',
  bluesky: 'bg-blue-600 text-white',
  instagram: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white',
  threads: 'bg-gradient-to-r from-purple-600 to-pink-500 text-white',
  linkedin: 'bg-blue-700 text-white',
  other: 'bg-gray-600 text-white',
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <FileText className="w-3.5 h-3.5" />,
  posted: <Clock className="w-3.5 h-3.5" />,
  verified: <Check className="w-3.5 h-3.5" />,
  discovered: <Radar className="w-3.5 h-3.5" />,
  acknowledged: <Eye className="w-3.5 h-3.5" />,
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-700 text-gray-300',
  posted: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  verified: 'bg-green-900/50 text-green-300 border border-green-700/50',
  discovered: 'bg-purple-900/50 text-purple-300 border border-purple-700/50',
  acknowledged: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
};

const statusTooltips: Record<string, string> = {
  draft: 'Planned but not yet posted',
  posted: 'Logged as posted - click to mark as verified',
  verified: 'Confirmed live and working',
  discovered: 'Auto-found via Bluesky mention scan',
  acknowledged: 'Discovered mention, dismissed from inbox',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength) + '...';
}

export function ShareRow({ share, onEdit, onDeleted, onStatusChanged }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(share.status);

  // Local state for metrics (to update UI without full refresh)
  const [metrics, setMetrics] = useState({
    likeCount: share.likeCount ?? 0,
    repostCount: share.repostCount ?? 0,
    replyCount: share.replyCount ?? 0,
  });
  const [followingSpeaker, setFollowingSpeaker] = useState(share.followingSpeaker ?? null);
  const [isPublic, setIsPublic] = useState(share.showPublicly ?? false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const handleVerify = async () => {
    if (currentStatus !== 'posted') return;
    setVerifying(true);
    try {
      const response = await fetch(`/api/admin/social-shares/${share.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      });
      if (!response.ok) throw new Error('Failed to verify');
      setCurrentStatus('verified');
      onStatusChanged?.();
    } catch (error) {
      console.error('Error verifying share:', error);
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/social-shares/${share.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      onDeleted();
    } catch (error) {
      console.error('Error deleting share:', error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRescan = async () => {
    if (!platformSupportsAutoMetrics(share.platform) || !share.postUrl) return;
    setRescanning(true);
    try {
      const response = await fetch(`/api/admin/social-shares/${share.id}/rescan`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to rescan');
      }
      const data = await response.json();
      // Update local metrics state
      setMetrics({
        likeCount: data.metrics.likeCount,
        repostCount: data.metrics.repostCount,
        replyCount: data.metrics.replyCount,
      });
      // Update status to verified
      setCurrentStatus('verified');
      // Trigger full refresh to get updated card/talk images
      onStatusChanged?.();
    } catch (error) {
      console.error('Error rescanning share:', error);
    } finally {
      setRescanning(false);
    }
  };

  const handleTogglePublic = async () => {
    setTogglingPublic(true);
    try {
      const response = await fetch(`/api/admin/social-shares/${share.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showPublicly: !isPublic }),
      });
      if (!response.ok) throw new Error('Failed to update');
      setIsPublic(!isPublic);
    } catch (error) {
      console.error('Error toggling public visibility:', error);
    } finally {
      setTogglingPublic(false);
    }
  };

  const sharedContent = share.card?.name || share.talk?.title || null;
  const sharedSpeaker = share.talk?.speakerName || share.speakerName || null;
  const isDiscoveredMention = currentStatus === 'discovered' || currentStatus === 'acknowledged';

  // Get the image URL and admin link for the shared content
  const sharedImageUrl = share.card?.imageUrl || share.talk?.thumbnailUrl || null;
  const adminLink = share.card
    ? `/admin/cards/${share.card.id}/edit`
    : share.talk
    ? `/admin/talks/${share.talk.id}/edit`
    : null;
  const isCard = !!share.card;

  return (
    <>
      <div className="flex items-start gap-4 p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg hover:bg-gray-800/50 transition-colors">
        {/* Shared Content Image or Platform Icon */}
        {sharedImageUrl ? (
          <div className="relative flex-shrink-0">
            {adminLink ? (
              <a href={adminLink} title={`Edit ${isCard ? 'card' : 'talk'}`}>
                <img
                  src={sharedImageUrl}
                  alt={sharedContent || 'Shared content'}
                  className={`rounded-lg border border-gray-600 hover:border-indigo-500 transition-colors cursor-pointer ${
                    isCard
                      ? 'w-14 h-auto -my-2' // Card: larger, overflow row vertically
                      : 'w-20 h-auto max-h-14' // Talk: wider horizontal thumbnail
                  }`}
                />
              </a>
            ) : (
              <img
                src={sharedImageUrl}
                alt={sharedContent || 'Shared content'}
                className={`rounded-lg border border-gray-600 ${
                  isCard
                    ? 'w-14 h-auto -my-2'
                    : 'w-20 h-auto max-h-14'
                }`}
              />
            )}
            {/* Platform badge overlay */}
            <div
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${platformColors[share.platform]}`}
              title={share.platform}
            >
              {platformIcons[share.platform]}
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-lg text-sm font-bold ${platformColors[share.platform]}`}
          >
            {platformIcons[share.platform]}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Post URL */}
          <div className="flex items-center gap-2">
            {share.postUrl ? (
              <a
                href={share.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-200 hover:text-indigo-400 transition-colors flex items-center gap-1 text-sm"
              >
                {truncateUrl(share.postUrl)}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            ) : (
              <span className="text-gray-500 text-sm italic">No post URL</span>
            )}
          </div>

          {/* Shared content info */}
          {(sharedContent || sharedSpeaker || share.sharedUrl) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {sharedContent && (
                <span className="px-2 py-0.5 bg-indigo-900/40 text-indigo-300 rounded border border-indigo-700/50">
                  {share.card ? 'Card: ' : 'Talk: '}
                  {sharedContent}
                </span>
              )}
              {sharedSpeaker && !share.card && (
                <span className="text-gray-400">by {sharedSpeaker}</span>
              )}
              {share.sharedUrl && !sharedContent && (
                <span className="text-gray-500 truncate max-w-[200px]">{share.sharedUrl}</span>
              )}
            </div>
          )}

          {/* Speaker handle if present (or author for mentions) */}
          {(share.speakerHandle || (isDiscoveredMention && share.authorHandle)) && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>
                  {isDiscoveredMention && share.authorDisplayName
                    ? `${share.authorDisplayName} (@${share.authorHandle})`
                    : `@${(share.speakerHandle || share.authorHandle || '').replace('@', '')}`
                  }
                </span>
              </div>
              <RelationshipBadge
                shareId={share.id}
                platform={share.platform}
                speakerHandle={share.speakerHandle}
                authorHandle={share.authorHandle ?? null}
                followingSpeaker={followingSpeaker}
                onRelationshipUpdate={setFollowingSpeaker}
              />
            </div>
          )}

          {/* Metrics Display */}
          <MetricsDisplay
            shareId={share.id}
            platform={share.platform}
            likeCount={metrics.likeCount}
            repostCount={metrics.repostCount}
            replyCount={metrics.replyCount}
            metricsUpdatedAt={share.metricsUpdatedAt ?? null}
            metricsSource={share.metricsSource}
            onMetricsUpdate={(newMetrics) => setMetrics(newMetrics)}
          />

          {/* Notes preview */}
          {share.notes && (
            <p className="text-xs text-gray-500 line-clamp-2">{share.notes}</p>
          )}
        </div>

        {/* Meta info */}
        <div className="flex flex-col items-end gap-2">
          {/* Status badge - clickable when "posted" to convert to "verified" */}
          {currentStatus === 'posted' ? (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:bg-amber-800/70 transition-colors ${statusColors[currentStatus]}`}
              title={statusTooltips[currentStatus]}
            >
              {verifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                statusIcons[currentStatus]
              )}
              {currentStatus}
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColors[currentStatus]}`}
              title={statusTooltips[currentStatus]}
            >
              {statusIcons[currentStatus]}
              {currentStatus}
            </span>
          )}

          {/* Public visibility toggle */}
          <button
            onClick={handleTogglePublic}
            disabled={togglingPublic}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
              isPublic
                ? 'text-green-400 hover:bg-green-900/30'
                : 'text-gray-600 hover:bg-gray-700/50'
            }`}
            title={isPublic ? 'Visible on public site' : 'Hidden from public site'}
          >
            {togglingPublic ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPublic ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Posted time */}
          <span className="text-xs text-gray-500">{formatRelativeTime(share.postedAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Rescan button - only for platforms with auto-metrics support (Bluesky) */}
          {platformSupportsAutoMetrics(share.platform) && share.postUrl && (
            <button
              onClick={handleRescan}
              disabled={rescanning}
              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Rescan: Refresh metrics from Bluesky"
            >
              {rescanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={() => onEdit(share)}
            className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Share"
          message="Are you sure you want to delete this share? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleting}
        />
      )}
    </>
  );
}
