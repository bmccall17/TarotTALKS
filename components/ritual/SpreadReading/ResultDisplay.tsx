'use client';

import { ExternalLink, Share2, RefreshCw, Clock } from 'lucide-react';
import type { SpreadTalk, SpreadCard, MatchReason } from '@/lib/spread-reading/types';

interface ResultDisplayProps {
  talk: SpreadTalk;
  rationale: string;
  cards: SpreadCard[];
  score: number;
  matchReasons: MatchReason[];
  spreadShortId?: string;
  onTryAgain: () => void;
  onShare?: () => void;
  onClose: () => void;
  onTalkClick?: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function ResultDisplay({
  talk,
  rationale,
  cards,
  onTryAgain,
  onShare,
  onClose,
  onTalkClick,
}: ResultDisplayProps) {
  const talkUrl = talk.slug ? `/talks/${talk.slug}` : null;
  const thumbnailUrl = talk.thumbnailUrl || '/images/default-talk-thumb.jpg';

  const handleTalkClick = () => {
    onTalkClick?.();
    if (talkUrl) {
      window.open(talkUrl, '_blank');
    }
  };

  return (
    <div className="space-y-5">
      {/* Cards Summary */}
      <div className="flex justify-center gap-2">
        {cards.map((card, index) => (
          <div
            key={card.id}
            className="text-center"
          >
            <div className="w-12 h-18 md:w-14 md:h-20 rounded-lg overflow-hidden border border-gray-600 mb-1">
              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[10px] text-gray-500 truncate max-w-[56px]">
              {['Aware', 'Shadow', 'Path'][index]}
            </p>
          </div>
        ))}
      </div>

      {/* Talk Recommendation */}
      <div
        onClick={handleTalkClick}
        className="bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-750 transition-colors group"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video">
          <img
            src={thumbnailUrl}
            alt={talk.title}
            className="w-full h-full object-cover"
          />
          {/* Duration badge */}
          {talk.durationSeconds && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
              <Clock className="w-3 h-3" />
              {formatDuration(talk.durationSeconds)}
            </div>
          )}
          {/* Play overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            <ExternalLink className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Talk Info */}
        <div className="p-4">
          <h4 className="font-medium text-gray-100 line-clamp-2 group-hover:text-indigo-300 transition-colors">
            {talk.title}
          </h4>
          <p className="text-sm text-gray-400 mt-1">
            {talk.speakerName}
          </p>
        </div>
      </div>

      {/* Rationale */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <p className="text-sm text-gray-300 leading-relaxed italic">
          {rationale}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onTryAgain}
          className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Another
        </button>
        {onShare && (
          <button
            onClick={onShare}
            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full px-4 py-2 text-gray-500 hover:text-gray-400 text-sm transition-colors"
      >
        Close
      </button>
    </div>
  );
}
