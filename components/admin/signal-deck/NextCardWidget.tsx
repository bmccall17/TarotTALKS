'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Share2, Loader2, CheckCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';

type UnpostedCard = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  sequenceIndex: number;
};

type Stats = {
  totalCards: number;
  unpostedOverall: number;
  sharedCards: number;
  unpostedByPlatform: Record<string, number>;
};

type Platform = 'all' | 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

const platformOptions: Array<{ value: Platform; label: string }> = [
  { value: 'all', label: 'All Platforms' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'threads', label: 'Threads' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

type Props = {
  onCreateShare?: (card: { id: string; slug: string; name: string }) => void;
};

export function NextCardWidget({ onCreateShare }: Props) {
  const [cards, setCards] = useState<UnpostedCard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform>('all');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchUnpostedCards = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (platform !== 'all') {
        params.set('platform', platform);
      }
      params.set('limit', '3');

      const response = await fetch(`/api/admin/social-shares/unposted?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setCards(data.cards || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching unposted cards:', error);
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    fetchUnpostedCards();
  }, [fetchUnpostedCards]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  const handleShareClick = (card: UnpostedCard) => {
    if (onCreateShare) {
      onCreateShare({ id: card.id, slug: card.slug, name: card.name });
    }
  };

  const getUnpostedCount = () => {
    if (!stats) return 0;
    if (platform === 'all') return stats.unpostedOverall;
    return stats.unpostedByPlatform[platform] || 0;
  };

  const currentPlatformLabel = platformOptions.find((p) => p.value === platform)?.label || 'All Platforms';

  // All cards posted - success state
  if (!loading && cards.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-green-300">All Cards Posted!</span>
        </div>
        <p className="text-xs text-green-400/80">
          {platform === 'all'
            ? 'Every card has been shared at least once.'
            : `Every card has been shared on ${currentPlatformLabel}.`}
        </p>
        {stats && stats.sharedCards > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {stats.sharedCards}/{stats.totalCards} cards shared overall
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/30 rounded-lg p-4">
      {/* Header with platform dropdown */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-gray-200">Next Cards to Post</span>
        </div>

        {/* Platform Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 rounded-md text-gray-300 transition-colors"
          >
            <span>{currentPlatformLabel}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]">
              {platformOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlatform(option.value);
                    setShowDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-700 transition-colors ${
                    platform === option.value ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <p className="text-xs text-gray-500 mb-3">
          {getUnpostedCount()} card{getUnpostedCount() !== 1 ? 's' : ''} not yet shared
          {platform !== 'all' ? ` on ${currentPlatformLabel}` : ''}
        </p>
      )}

      {/* Cards List */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-3 p-2 bg-gray-900/40 rounded-lg border border-gray-700/50"
            >
              {/* Card Image */}
              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-8 h-12 object-cover rounded"
              />

              {/* Card Name */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/cards/${card.slug}`}
                  target="_blank"
                  className="text-sm text-gray-200 hover:text-indigo-300 truncate block transition-colors"
                >
                  {card.name}
                </Link>
              </div>

              {/* Share Button */}
              <button
                onClick={() => handleShareClick(card)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-md transition-colors"
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* View All Link */}
      {!loading && stats && getUnpostedCount() > 3 && (
        <Link
          href="/admin/validation"
          className="block text-center text-xs text-indigo-400 hover:text-indigo-300 mt-3 transition-colors"
        >
          View all {getUnpostedCount()} unposted cards →
        </Link>
      )}
    </div>
  );
}
