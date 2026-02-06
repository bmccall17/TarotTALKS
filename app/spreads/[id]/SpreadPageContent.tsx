'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink, Clock, Share2, Copy, Check } from 'lucide-react';
import { POSITION_LABELS, FOCUS_TYPE_LABELS } from '@/lib/spread-reading/types';
import type { SpreadCard, SpreadTalk, MatchReason, PrivacyLevel, FocusType } from '@/lib/spread-reading/types';
import { SocialLinks } from '@/components/ui/SocialLinks';

interface SpreadData {
  id: string;
  shortId: string;
  cards: SpreadCard[];
  talk: SpreadTalk | null;
  rationale: string;
  rationaleSource: string | null;
  score: number | null;
  matchReasons: MatchReason[];
  privacyLevel: PrivacyLevel | null;
  focusType?: string | null;
  focusText?: string | null;
  createdAt: Date;
}

interface SpreadPageContentProps {
  spread: SpreadData;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function SpreadPageContent({ spread }: SpreadPageContentProps) {
  const [copied, setCopied] = useState(false);
  const hasTrackedView = useRef(false);

  const showTalk = spread.privacyLevel !== 'cards_only';
  const showRationale = spread.privacyLevel === 'full';

  // Get focus label for display
  const focusLabel = spread.focusType &&
    spread.focusType !== 'surprise_me' &&
    spread.focusType !== 'custom' &&
    FOCUS_TYPE_LABELS[spread.focusType as keyof typeof FOCUS_TYPE_LABELS]
      ? FOCUS_TYPE_LABELS[spread.focusType as keyof typeof FOCUS_TYPE_LABELS]
      : null;

  // Track view on mount (only once)
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      fetch(`/api/spreads/${spread.shortId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view' }),
      }).catch(() => {
        // Silently fail - view tracking is non-critical
      });
    }
  }, [spread.shortId]);

  const handleCopyLink = async () => {
    const url = `https://tarottalks.app/spreads/${spread.shortId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track share action
      fetch(`/api/spreads/${spread.shortId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share' }),
      }).catch(() => {
        // Silently fail - share tracking is non-critical
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-light text-gray-200/60 tracking-wide hover:text-gray-200 transition-colors">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </Link>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-medium text-gray-100 mb-2">
            A TarotTALKS Reading
          </h1>
          <p className="text-gray-500 text-sm">
            {new Date(spread.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Cards */}
        <div className="flex justify-center gap-4 md:gap-8 mb-10">
          {spread.cards.map((card, index) => (
            <Link
              key={card.id}
              href={`/cards/${card.slug}`}
              className="group text-center"
            >
              <div className="w-20 h-32 md:w-28 md:h-44 rounded-lg overflow-hidden border-2 border-gray-700 group-hover:border-indigo-500 transition-colors shadow-lg">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {POSITION_LABELS[index]}
              </p>
              <p className="text-sm font-medium text-gray-300 group-hover:text-indigo-300 transition-colors">
                {card.name}
              </p>
            </Link>
          ))}
        </div>

        {/* Talk Recommendation */}
        {showTalk && spread.talk && (
          <div className="max-w-2xl mx-auto mb-8">
            <h2 className="text-lg font-medium text-gray-400 text-center mb-4">
              Recommended Talk
            </h2>
            <Link
              href={`/talks/${spread.talk.slug}`}
              className="block bg-gray-900 rounded-xl overflow-hidden hover:bg-gray-850 transition-colors group border border-gray-800"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video">
                <img
                  src={spread.talk.thumbnailUrl || '/images/default-talk-thumb.jpg'}
                  alt={spread.talk.title}
                  className="w-full h-full object-cover"
                />
                {/* Duration */}
                {spread.talk.durationSeconds && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    <Clock className="w-3 h-3" />
                    {formatDuration(spread.talk.durationSeconds)}
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <ExternalLink className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Talk Info */}
              <div className="p-5">
                <h3 className="text-xl font-medium text-gray-100 group-hover:text-indigo-300 transition-colors mb-1">
                  {spread.talk.title}
                </h3>
                <p className="text-gray-400">
                  {spread.talk.speakerName}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Rationale */}
        {showRationale && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
              <p className="text-gray-300 leading-relaxed italic text-center">
                "{spread.rationale}"
              </p>
              {/* Focus & Context - shown below rationale */}
              {(focusLabel || spread.focusText) && (
                <div className="pt-3 border-t border-gray-800/50 space-y-1">
                  {focusLabel && (
                    <p className="text-sm text-gray-400 text-center">
                      <span className="text-gray-500">Focus:</span> {focusLabel}
                    </p>
                  )}
                  {spread.focusText && (
                    <p className="text-sm text-gray-400 text-center">
                      <span className="text-gray-500">Context:</span> {spread.focusText}
                    </p>
                  )}
                </div>
              )}
              {spread.rationaleSource === 'ai' && (
                <p className="text-gray-600 text-xs text-center">
                  ✨ Enhanced with AI
                </p>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
          >
            Get Your Own Reading
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-gray-600 text-xs">
            TED and TED Talks are registered trademarks of TED Conferences LLC.
            This is an independent project not affiliated with TED.
          </p>
          <div className="mt-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
            <SocialLinks />
          </div>
        </div>
      </footer>
    </div>
  );
}
