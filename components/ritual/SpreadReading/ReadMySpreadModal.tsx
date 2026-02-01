'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { FocusStep } from './FocusStep';
import { LoadingState } from './LoadingState';
import { ResultDisplay } from './ResultDisplay';
import { ShareStep } from './ShareStep';
import type { FocusType, SpreadCard, SpreadTalk, MatchReason } from '@/lib/spread-reading/types';

type Step = 'focus' | 'loading' | 'result' | 'share';

interface CardData {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

interface ReadMySpreadModalProps {
  cards: CardData[];
  revealedCards: number[];
  onClose: () => void;
  onTalkClick?: (talkSlug: string) => void;
}

interface ReadingResult {
  talk: SpreadTalk;
  rationale: string;
  rationaleSource: 'template' | 'ai';
  score: number;
  matchReasons: MatchReason[];
  cards: SpreadCard[];
  spread?: {
    id: string;
    shortId: string;
  };
}

export function ReadMySpreadModal({
  cards,
  revealedCards,
  onClose,
  onTalkClick,
}: ReadMySpreadModalProps) {
  const [step, setStep] = useState<Step>('focus');
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get card IDs in position order (sorted by reveal index)
  const getCardIds = useCallback(() => {
    const sortedIndices = [...revealedCards].sort((a, b) => a - b);
    return sortedIndices
      .map(index => cards[index]?.id)
      .filter((id): id is string => id !== undefined);
  }, [cards, revealedCards]);

  const fetchReading = useCallback(async (focusType: FocusType, focusText?: string) => {
    setStep('loading');
    setError(null);

    const cardIds = getCardIds();

    try {
      const response = await fetch('/api/spreads/spread-reading', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardIds,
          focusType: focusType !== 'surprise_me' ? focusType : undefined,
          focusText,
          save: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate reading');
      }

      const data = await response.json();
      setResult(data);
      setStep('result');
    } catch (err) {
      console.error('Error fetching reading:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('focus');
    }
  }, [getCardIds]);

  const handleFocusSelect = useCallback((focusType: FocusType, focusText?: string) => {
    fetchReading(focusType, focusText);
  }, [fetchReading]);

  const handleTryAgain = useCallback(() => {
    setResult(null);
    setStep('focus');
  }, []);

  const handleShare = useCallback(() => {
    setStep('share');
  }, []);

  const handleBackToResult = useCallback(() => {
    setStep('result');
  }, []);

  const handleTalkClick = useCallback(() => {
    if (result?.talk?.slug) {
      onTalkClick?.(result.talk.slug);
    }
  }, [result, onTalkClick]);

  const getTitle = () => {
    switch (step) {
      case 'focus': return 'Read My Spread';
      case 'loading': return 'Reading Your Cards';
      case 'result': return 'Your Reading';
      case 'share': return 'Share Your Reading';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-gray-100">
            {getTitle()}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Focus Step */}
          {step === 'focus' && (
            <FocusStep
              onSelect={handleFocusSelect}
              onBack={onClose}
            />
          )}

          {/* Loading Step */}
          {step === 'loading' && (
            <LoadingState />
          )}

          {/* Result Step */}
          {step === 'result' && result && (
            <ResultDisplay
              talk={result.talk}
              rationale={result.rationale}
              cards={result.cards}
              score={result.score}
              matchReasons={result.matchReasons}
              spreadShortId={result.spread?.shortId}
              onTryAgain={handleTryAgain}
              onShare={result.spread ? handleShare : undefined}
              onClose={onClose}
              onTalkClick={handleTalkClick}
            />
          )}

          {/* Share Step */}
          {step === 'share' && result?.spread?.shortId && (
            <ShareStep
              spreadShortId={result.spread.shortId}
              rationale={result.rationale}
              onClose={onClose}
              onBack={handleBackToResult}
            />
          )}
        </div>
      </div>
    </div>
  );
}
