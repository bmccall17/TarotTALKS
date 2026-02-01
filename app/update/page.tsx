'use client';

/**
 * Staged Landing Page for Testing
 *
 * This is the staging version at /update for testing the new
 * Read My Spread feature before it goes live on the main page.
 *
 * Uses CardCascadeV2 with the new ReadMySpreadModal.
 */

import { useState, useEffect, useCallback } from 'react';
import { CardCascadeV2, Invocation, SparkleBackground } from '@/components/ritual';

export default function UpdatePage() {
  const [journalPrompts, setJournalPrompts] = useState<string[][]>([]);

  const handleCardsLoaded = useCallback((prompts: string[][]) => {
    setJournalPrompts(prompts);
  }, []);

  // Scroll to top on page load
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Sparkle Background */}
      <SparkleBackground />

      {/* Hero Section */}
      <div className="relative z-10 px-4 pt-8 md:pt-12">
        {/* Staging Banner */}
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 bg-amber-900/50 border border-amber-600/50 rounded-full text-amber-300 text-xs">
            🚧 Staging: Testing new Read My Spread feature
          </span>
        </div>

        {/* Branding at top */}
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-light text-gray-200/60 tracking-wide">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </h1>
        </div>

        {/* Invocation */}
        <div className="text-center mb-8 md:mb-10">
          <Invocation journalPrompts={journalPrompts} />
        </div>

        {/* 3-Card Ritual with new ReadMySpreadModal */}
        <div className="max-w-4xl mx-auto">
          <CardCascadeV2 onCardsLoaded={handleCardsLoaded} />
        </div>
      </div>

      {/* Below the Fold */}
      <div
        id="below-fold"
        className="relative z-10 px-4 py-12 max-w-2xl mx-auto"
      >
        {/* Reassurance Block */}
        <div className="text-center opacity-60 hover:opacity-100 transition-opacity duration-500">
          <p className="text-gray-500 text-ms leading-relaxed">
            Each tarot card is paired with <span style={{ fontFamily: 'Helvetica, Inter, Arial, sans-serif'}}><a href="https://www.ted.com/" target="_blank">TED</a></span> talks that echo its wisdom.
            <br /><br />
          </p>
        </div>

        {/* Disclaimer Block */}
        <div className="text-center opacity-60 hover:opacity-100 transition-opacity duration-500">
          <p className="text-gray-500 text-xs leading-relaxed">
            TED and TED Talks are registered trademarks of TED Conferences LLC. This website is an independent project and is not affiliated with, sponsored by or endorsed by TED in any way.
          </p>
        </div>

        {/* Support Block */}
        <div className="text-center mt-16 opacity-60 hover:opacity-100 transition-opacity duration-500">
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            Free forever. No ads. Help keep it alive...
          </p>
          <a
            href="https://buymeacoffee.com/bmccall17"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2.5 border border-gray-600/70 rounded-xl text-gray-300 hover:text-gray-200 hover:border-gray-500 hover:bg-gray-800/30 transition-all text-sm"
          >
            send me to TED2026!
          </a>
        </div>
      </div>
    </div>
  );
}
