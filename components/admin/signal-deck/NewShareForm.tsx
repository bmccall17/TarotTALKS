'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Link as LinkIcon, Check, AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { DraftGenerator } from './DraftGenerator';
import {
  detectPlatformFromUrl,
  getPlatformMetricLabels,
  platformSupportsAutoMetrics,
  type Platform,
} from '@/lib/utils/social-handles';

type Share = {
  id?: string;
  platform: Platform;
  postUrl: string | null;
  status: 'draft' | 'posted' | 'verified' | 'discovered' | 'acknowledged';
  postedAt: string;
  sharedUrl: string | null;
  speakerHandle: string | null;
  speakerName: string | null;
  notes: string | null;
  cardId?: string | null;
  talkId?: string | null;
  // Phase 2-4 fields
  likeCount?: number | null;
  repostCount?: number | null;
  replyCount?: number | null;
  followingSpeaker?: boolean | null;
  metricsSource?: 'auto' | 'manual' | null;
};

type PreselectedCard = {
  id: string;
  slug: string;
  name: string;
  tagPackText?: string;
  speakerName?: string;
  speakerHandle?: string;
};

type Props = {
  share?: Share | null;
  preselectedCard?: PreselectedCard | null;
  onSave: () => void;
  onClose: () => void;
};

const platforms: Array<{ value: Platform; label: string; shortLabel: string; icon: string }> = [
  { value: 'x', label: 'X (Twitter)', shortLabel: 'X', icon: '𝕏' },
  { value: 'bluesky', label: 'Bluesky', shortLabel: 'BS', icon: '🦋' },
  { value: 'instagram', label: 'Instagram', shortLabel: 'IG', icon: '📷' },
  { value: 'linkedin', label: 'LinkedIn', shortLabel: 'LI', icon: '💼' },
  { value: 'threads', label: 'Threads', shortLabel: 'TH', icon: '🧵' },
  { value: 'other', label: 'Other', shortLabel: '...', icon: '🔗' },
];

const statuses: Array<{ value: Share['status']; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'verified', label: 'Verified' },
];

const platformColors: Record<string, string> = {
  x: 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700',
  bluesky: 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500',
  instagram: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 border-pink-500 text-white hover:from-purple-500 hover:via-pink-400 hover:to-orange-300',
  threads: 'bg-gradient-to-r from-purple-600 to-pink-500 border-purple-500 text-white hover:from-purple-500 hover:to-pink-400',
  linkedin: 'bg-blue-700 border-blue-600 text-white hover:bg-blue-600',
  other: 'bg-gray-600 border-gray-500 text-white hover:bg-gray-500',
};

const platformColorsSelected: Record<string, string> = {
  x: 'bg-gray-800 border-white text-white ring-2 ring-white',
  bluesky: 'bg-blue-600 border-white text-white ring-2 ring-blue-300',
  instagram: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 border-white text-white ring-2 ring-pink-300',
  threads: 'bg-gradient-to-r from-purple-600 to-pink-500 border-white text-white ring-2 ring-purple-300',
  linkedin: 'bg-blue-700 border-white text-white ring-2 ring-blue-300',
  other: 'bg-gray-600 border-white text-white ring-2 ring-gray-300',
};

export function NewShareForm({ share, preselectedCard, onSave, onClose }: Props) {
  const isEditing = !!share?.id;

  const [formData, setFormData] = useState<{
    platform: Platform;
    postUrl: string;
    status: Share['status'];
    postedAt: string;
    sharedUrl: string;
    speakerHandle: string;
    speakerName: string;
    notes: string;
    cardId: string | null;
    talkId: string | null;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    followingSpeaker: boolean | null;
  }>({
    platform: share?.platform || 'x',
    postUrl: share?.postUrl || '',
    status: share?.status || 'posted',
    postedAt: share?.postedAt
      ? new Date(share.postedAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    sharedUrl: share?.sharedUrl || '',
    speakerHandle: share?.speakerHandle || '',
    speakerName: share?.speakerName || '',
    notes: share?.notes || '',
    cardId: share?.cardId || null,
    talkId: share?.talkId || null,
    likeCount: share?.likeCount ?? 0,
    repostCount: share?.repostCount ?? 0,
    replyCount: share?.replyCount ?? 0,
    followingSpeaker: share?.followingSpeaker ?? null,
  });

  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedContent, setResolvedContent] = useState<{
    type: 'card' | 'talk' | null;
    name?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(null);

  // Auto-fetch state for Bluesky posts
  const [fetchingPost, setFetchingPost] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoPopulated, setAutoPopulated] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  // Draft generator state
  const [showDraftGenerator, setShowDraftGenerator] = useState(false);

  // Auto-detect platform from post URL
  useEffect(() => {
    const detected = detectPlatformFromUrl(formData.postUrl);
    setDetectedPlatform(detected);

    // Auto-select platform if we detect one and user hasn't manually changed it yet
    if (detected && !share?.postUrl) {
      setFormData((prev) => ({ ...prev, platform: detected }));
    }
  }, [formData.postUrl, share?.postUrl]);

  const platformMismatch = detectedPlatform && detectedPlatform !== formData.platform;

  // Auto-fetch Bluesky post data when a valid Bluesky URL is pasted
  useEffect(() => {
    const fetchBlueskyPost = async () => {
      // Only auto-fetch for Bluesky URLs in new share mode (not editing)
      if (isEditing) return;
      if (!formData.postUrl) return;
      if (detectedPlatform !== 'bluesky') return;

      // Check if this is a valid Bluesky URL
      const isValidBlueskyUrl = /bsky\.app\/profile\/[^\/]+\/post\/[a-z0-9]+$/i.test(formData.postUrl);
      if (!isValidBlueskyUrl) return;

      // Don't re-fetch the same URL
      if (formData.postUrl === lastFetchedUrl) return;

      // Don't overwrite preselected card data
      if (preselectedCard) return;

      setFetchingPost(true);
      setFetchError(null);
      setAutoPopulated(false);

      try {
        const response = await fetch('/api/admin/social-shares/fetch-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postUrl: formData.postUrl, platform: 'bluesky' }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setFetchError(result.error || 'Failed to fetch post');
          return;
        }

        const { data } = result;

        // Auto-populate form fields
        setFormData((prev) => ({
          ...prev,
          sharedUrl: data.sharedUrl || prev.sharedUrl,
          cardId: data.cardId || prev.cardId,
          talkId: data.talkId || prev.talkId,
          postedAt: data.createdAt
            ? new Date(data.createdAt).toISOString().slice(0, 16)
            : prev.postedAt,
          notes: data.text || prev.notes,
          status: 'verified',
          likeCount: data.metrics?.likeCount ?? prev.likeCount,
          repostCount: data.metrics?.repostCount ?? prev.repostCount,
          replyCount: data.metrics?.replyCount ?? prev.replyCount,
        }));

        // Set resolved content if we found a TarotTALKS link
        if (data.cardId || data.talkId) {
          setResolvedContent({
            type: data.cardId ? 'card' : 'talk',
            name: data.contentName,
          });
        }

        setAutoPopulated(true);
        setLastFetchedUrl(formData.postUrl);
      } catch (err) {
        console.error('Error fetching Bluesky post:', err);
        setFetchError('Failed to fetch post data');
      } finally {
        setFetchingPost(false);
      }
    };

    // Debounce the fetch
    const timeout = setTimeout(fetchBlueskyPost, 500);
    return () => clearTimeout(timeout);
  }, [formData.postUrl, detectedPlatform, isEditing, lastFetchedUrl, preselectedCard]);

  // Handle preselected card - set sharedUrl, resolved content, and TagPack data
  useEffect(() => {
    if (!preselectedCard) return;

    const cardUrl = `https://tarottalks.app/cards/${preselectedCard.slug}`;
    setFormData((prev) => ({
      ...prev,
      sharedUrl: cardUrl,
      cardId: preselectedCard.id,
      // Pre-populate from TagPack data if available
      notes: preselectedCard.tagPackText || prev.notes,
      speakerName: preselectedCard.speakerName || prev.speakerName,
      speakerHandle: preselectedCard.speakerHandle || prev.speakerHandle,
    }));
    setResolvedContent({ type: 'card', name: preselectedCard.name });
  }, [preselectedCard]);

  // Auto-detect TarotTALKS URL from post URL
  useEffect(() => {
    if (formData.postUrl && !formData.sharedUrl) {
      const match = formData.postUrl.match(/tarottalks\.app\/(cards|talks)\/[a-z0-9-]+/i);
      if (match) {
        const detectedUrl = `https://${match[0]}`;
        setFormData((prev) => ({ ...prev, sharedUrl: detectedUrl }));
      }
    }
  }, [formData.postUrl]);

  // Resolve shared URL to card/talk
  useEffect(() => {
    const resolveUrl = async () => {
      if (!formData.sharedUrl || !formData.sharedUrl.includes('tarottalks.app')) {
        setResolvedContent(null);
        setFormData((prev) => ({ ...prev, cardId: null, talkId: null }));
        return;
      }

      setResolving(true);
      try {
        const response = await fetch('/api/admin/social-shares/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: formData.sharedUrl }),
        });

        if (!response.ok) throw new Error('Failed to resolve');

        const result = await response.json();
        setResolvedContent(result);
        setFormData((prev) => ({
          ...prev,
          cardId: result.cardId || null,
          talkId: result.talkId || null,
        }));
      } catch (err) {
        console.error('Error resolving URL:', err);
        setResolvedContent({ type: null });
      } finally {
        setResolving(false);
      }
    };

    const timeout = setTimeout(resolveUrl, 500);
    return () => clearTimeout(timeout);
  }, [formData.sharedUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const isManualMetrics = !platformSupportsAutoMetrics(formData.platform);
      const hasMetrics = formData.likeCount > 0 || formData.repostCount > 0 || formData.replyCount > 0;

      const payload = {
        ...formData,
        postUrl: formData.postUrl || null,
        sharedUrl: formData.sharedUrl || null,
        speakerHandle: formData.speakerHandle || null,
        speakerName: formData.speakerName || null,
        notes: formData.notes || null,
        postedAt: new Date(formData.postedAt).toISOString(),
        // Include metrics for non-Bluesky platforms
        likeCount: isManualMetrics ? formData.likeCount : undefined,
        repostCount: isManualMetrics ? formData.repostCount : undefined,
        replyCount: isManualMetrics ? formData.replyCount : undefined,
        metricsSource: isManualMetrics && hasMetrics ? 'manual' : undefined,
        metricsUpdatedAt: isManualMetrics && hasMetrics
          ? new Date().toISOString()
          : undefined,
        followingSpeaker: isManualMetrics ? formData.followingSpeaker : undefined,
        relationshipUpdatedAt: isManualMetrics && formData.followingSpeaker !== null
          ? new Date().toISOString()
          : undefined,
      };

      const url = isEditing
        ? `/api/admin/social-shares/${share.id}`
        : '/api/admin/social-shares';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save share');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">
            {isEditing ? 'Edit Share' : 'Log New Share'}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Platform Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Platform</label>
            <div className="flex gap-2">
              {platforms.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, platform: p.value }))}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    formData.platform === p.value
                      ? platformColorsSelected[p.value]
                      : platformColors[p.value]
                  }`}
                >
                  {p.shortLabel}
                </button>
              ))}
            </div>
            {platformMismatch && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/30 border border-amber-700/50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  URL looks like a <strong>{platforms.find(p => p.value === detectedPlatform)?.label}</strong> post, but you selected{' '}
                  <strong>{platforms.find(p => p.value === formData.platform)?.label}</strong>.{' '}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, platform: detectedPlatform! }))}
                    className="underline hover:text-amber-300"
                  >
                    Fix it
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Post URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Post URL</label>
            <div className="relative">
              <input
                type="url"
                value={formData.postUrl}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, postUrl: e.target.value }));
                  // Reset auto-populate state when URL changes
                  if (e.target.value !== lastFetchedUrl) {
                    setAutoPopulated(false);
                    setFetchError(null);
                  }
                }}
                placeholder="Paste post URL (platform auto-detected)"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {fetchingPost && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-blue-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching...</span>
                </div>
              )}
              {!fetchingPost && autoPopulated && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-green-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Auto-filled</span>
                </div>
              )}
              {!fetchingPost && !autoPopulated && detectedPlatform && !platformMismatch && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-green-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>{platforms.find(p => p.value === detectedPlatform)?.shortLabel}</span>
                </div>
              )}
            </div>
            {fetchError && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{fetchError}. You can still fill in the fields manually.</span>
              </div>
            )}
          </div>

          {/* TarotTALKS URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              TarotTALKS URL Shared
            </label>
            <div className="relative">
              <input
                type="url"
                value={formData.sharedUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, sharedUrl: e.target.value }))}
                placeholder="https://tarottalks.app/cards/the-tower"
                className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {resolving && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            {resolvedContent && resolvedContent.type && (
              <div className="flex items-center gap-2 text-xs">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-300">
                  Detected: {resolvedContent.name}
                </span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Status</label>
            <div className="flex gap-2">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, status: s.value }))}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    formData.status === s.value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-900 border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Posted At */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Posted At</label>
            <input
              type="datetime-local"
              value={formData.postedAt}
              onChange={(e) => setFormData((prev) => ({ ...prev, postedAt: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Speaker Info (collapsible) */}
          <details className="group">
            <summary className="flex items-center gap-2 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-300">
              <LinkIcon className="w-4 h-4" />
              Speaker Info (optional)
            </summary>
            <div className="mt-3 space-y-3 pl-6">
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Speaker Handle</label>
                <input
                  type="text"
                  value={formData.speakerHandle}
                  onChange={(e) => setFormData((prev) => ({ ...prev, speakerHandle: e.target.value }))}
                  placeholder="@speaker"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Speaker Name</label>
                <input
                  type="text"
                  value={formData.speakerName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, speakerName: e.target.value }))}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              {/* Following checkbox (manual for non-Bluesky platforms) */}
              {!platformSupportsAutoMetrics(formData.platform) && formData.speakerHandle && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="followingSpeaker"
                    checked={formData.followingSpeaker === true}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        followingSpeaker: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="followingSpeaker" className="text-xs text-gray-400">
                    Following this speaker
                  </label>
                </div>
              )}
            </div>
          </details>

          {/* Metrics (for non-Bluesky manual entry) */}
          {!platformSupportsAutoMetrics(formData.platform) && (
            <details className="group">
              <summary className="flex items-center gap-2 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-300">
                <Info className="w-4 h-4" />
                Engagement Metrics (manual entry)
              </summary>
              <div className="mt-3 space-y-3 pl-6">
                <p className="text-xs text-gray-500">
                  {formData.platform === 'x' && 'Twitter/X API requires paid tier ($100/mo) for metrics.'}
                  {formData.platform === 'instagram' && 'Instagram API only supports your own posts.'}
                  {formData.platform === 'linkedin' && 'LinkedIn API only supports your own posts.'}
                  {formData.platform === 'threads' && 'Threads has no public API.'}
                  {formData.platform === 'other' && 'Enter metrics manually.'}
                  {' '}Enter values manually below.
                </p>
                <div className={`grid gap-3 ${getPlatformMetricLabels(formData.platform).reposts ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-400">
                      {getPlatformMetricLabels(formData.platform).likes}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.likeCount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          likeCount: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  {getPlatformMetricLabels(formData.platform).reposts && (
                    <div className="space-y-1">
                      <label className="block text-xs text-gray-400">
                        {getPlatformMetricLabels(formData.platform).reposts}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.repostCount}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            repostCount: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-400">
                      {getPlatformMetricLabels(formData.platform).replies}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.replyCount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          replyCount: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>
            </details>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">Notes</label>
              <button
                type="button"
                onClick={() => setShowDraftGenerator(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Suggest Draft
              </button>
            </div>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes about this share..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Update' : 'Save Share'}
            </button>
          </div>
        </form>
      </div>

      {/* Draft Generator Modal */}
      <DraftGenerator
        isOpen={showDraftGenerator}
        onClose={() => setShowDraftGenerator(false)}
        onSelectDraft={(draft) => setFormData((prev) => ({ ...prev, notes: draft }))}
        platform={formData.platform}
        cardName={preselectedCard?.name || resolvedContent?.name}
        cardSlug={preselectedCard?.slug}
        talkTitle={undefined}
        speakerName={formData.speakerName || preselectedCard?.speakerName}
        speakerHandle={formData.speakerHandle || preselectedCard?.speakerHandle}
      />
    </div>
  );
}
