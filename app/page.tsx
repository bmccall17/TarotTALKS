'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown } from 'lucide-react';
import { CardCascadeV2, Invocation, SparkleBackground } from '@/components/ritual';

export default function HomePage() {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [journalPrompts, setJournalPrompts] = useState<string[][]>([]);
  const router = useRouter();

  const handleCardsLoaded = useCallback((prompts: string[][]) => {
    setJournalPrompts(prompts);
  }, []);

  // Scroll to top on page load - disable browser restoration and force top
  useEffect(() => {
    // Disable browser's automatic scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    // Force scroll to top after a brief delay to override any browser behavior
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Sparkle Background */}
      <SparkleBackground />

      {/* Hero Section */}
      <div className="relative z-10 px-4 pt-8 md:pt-12">
        {/* Branding at top */}
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-light text-gray-200/60 tracking-wide">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </h1>
        </div>

        {/* Invocation - Journal prompt from cards (or time-based fallback) */}
        <div className="text-center mb-8 md:mb-10">
          <Invocation journalPrompts={journalPrompts} />
        </div>

        {/* 3-Card Ritual */}
        <div className="max-w-4xl mx-auto">
          <CardCascadeV2 onCardsLoaded={handleCardsLoaded} />
        </div>
      </div>

      {/* Scroll Indicator */}
{/*      <div className="relative z-10 flex justify-center mt-16 mb-8">
        <button
          onClick={() => {
            const belowFold = document.getElementById('below-fold');
            belowFold?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-gray-500 hover:text-gray-400 transition-colors animate-bounce"
          aria-label="Scroll down"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>
*/}
      {/* Below the Fold - De-emphasized Content */}
      <div
        id="below-fold"
        className="relative z-10 px-4 py-12 max-w-2xl mx-auto"
      >
        {/* Search - Hidden by default, revealed on intent */}
{/*        <div className="mb-12">
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full py-3.5 px-4 border border-gray-600/70 rounded-xl text-gray-300 hover:text-gray-200 hover:border-gray-500 hover:bg-gray-800/30 transition-all flex items-center justify-center gap-2.5"
            >
              <Search className="w-5 h-5" />
              <span className="text-base">Search cards, talks, or themes...</span>
            </button>
          ) : (
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search cards, talks, or themes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-100 placeholder-gray-500"
              />
            </form>
          )}
        </div>
*/}
        {/* Reassurance Block */}
        <div className="text-center opacity-60 hover:opacity-100 transition-opacity duration-500">
          <p className="text-gray-500 text-ms leading-relaxed">
            Each tarot card is paired with <span style={{ fontFamily: 'Helvetica, Inter, Arial, sans-serif'}}><a href="https://www.ted.com/" target="_blank">TED</a></span> talks that echo its wisdom.
            <br /><br />
          </p>
        </div>

        {/* disclaimer Block */}
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
