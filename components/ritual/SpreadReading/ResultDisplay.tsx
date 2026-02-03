'use client';

import { useState } from 'react';
import { ExternalLink, Share2, RefreshCw, Clock } from 'lucide-react';
import type { SpreadTalk, SpreadCard, MatchReason, FocusType } from '@/lib/spread-reading/types';
import { GPTFallbackModal } from './GPTFallbackModal';

interface ResultDisplayProps {
  talk: SpreadTalk;
  rationale: string;
  rationaleSource: 'template' | 'ai';
  cards: SpreadCard[];
  score: number;
  matchReasons: MatchReason[];
  spreadShortId?: string;
  focusType?: FocusType | null;
  focusText?: string;
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

// Simple OpenAI-style icon
function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  );
}

export function ResultDisplay({
  talk,
  rationale,
  rationaleSource,
  cards,
  focusType,
  focusText,
  onTryAgain,
  onShare,
  onClose,
  onTalkClick,
}: ResultDisplayProps) {
  const [showGPTModal, setShowGPTModal] = useState(false);
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
        {rationaleSource === 'template' ? (
          /* Fallback mode: Split buttons with tooltips */
          <div className="flex gap-2">
            <button
              onClick={onTryAgain}
              className="group relative px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors flex items-center justify-center"
              aria-label="Try Another"
            >
              <RefreshCw className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Try Another
              </span>
            </button>
            <button
              onClick={() => setShowGPTModal(true)}
              className="group relative px-4 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl transition-colors flex items-center justify-center"
              aria-label="Try the TarotTALKS GPT for a deeper reading"
            >
              <OpenAIIcon className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                <span className="block font-medium">✨ Want a deeper reading?</span>
                <span className="text-gray-300">Try the TarotTALKS GPT →</span>
              </span>
            </button>
          </div>
        ) : (
          /* AI mode: Standard button */
          <button
            onClick={onTryAgain}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Another
          </button>
        )}
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

      {/* GPT Fallback Modal */}
      {showGPTModal && (
        <GPTFallbackModal
          cards={cards}
          focusType={focusType}
          focusText={focusText}
          onClose={() => setShowGPTModal(false)}
        />
      )}
    </div>
  );
}
