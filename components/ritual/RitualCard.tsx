'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Play, ChevronUp } from 'lucide-react';

type RitualCardProps = {
  card: {
    id: string;
    slug: string;
    name: string;
    arcanaType: 'major' | 'minor';
    suit: string | null;
    imageUrl: string | null;
    keywords: string | null;
  };
  primaryTalk: {
    id: string;
    slug: string;
    title: string;
    speakerName: string;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
  } | null;
  index: number;
  layoutMode: 'stacked' | 'spread-2' | 'spread-3';
  isRevealed: boolean;
  revealedCount: number; // Total revealed cards (to detect new reveals)
  onReveal: () => void;
  onFlipSound?: () => void;
  onFlip2Sound?: () => void;
  isCentered?: boolean; // For scroll-based dock expansion on mobile
  onTalkClick?: (cardIndex: number, talkSlug: string) => void;
  onCardDetailClick?: (cardIndex: number, cardSlug: string) => void;
};

type NavigationSparkle = {
  id: number;
  x: number;
  y: number;
  size: number;
  angle: number;
  distance: number;
};

export function RitualCard({ card, primaryTalk, index, layoutMode, isRevealed, revealedCount, onReveal, onFlipSound, onFlip2Sound, isCentered, onTalkClick, onCardDetailClick }: RitualCardProps) {
  const router = useRouter();
  const [isFlipping, setIsFlipping] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isDockExpanded, setIsDockExpanded] = useState(false);
  const [isDockHovering, setIsDockHovering] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasTappedDock, setHasTappedDock] = useState(false);
  const [isAutoExpanded, setIsAutoExpanded] = useState(false);
  const [navSparkles, setNavSparkles] = useState<NavigationSparkle[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const expandTimerRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevRevealedCountRef = useRef(revealedCount);
  const prevCenteredRef = useRef(isCentered);

  // Generate sparkle burst for navigation
  const triggerSparkleBurst = useCallback(() => {
    const sparkles: NavigationSparkle[] = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 50, // Center of card
      y: 50,
      size: Math.random() * 6 + 3,
      angle: (i * 30) + Math.random() * 20, // Spread evenly
      distance: 80 + Math.random() * 60,
    }));
    setNavSparkles(sparkles);
  }, []);

  // Parse keywords
  const keywords = card.keywords ? JSON.parse(card.keywords) : [];
  const displayKeywords = keywords.slice(0, 3);

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  // Get archetype label
  const getArchetype = () => {
    if (card.arcanaType === 'major') return 'Major Arcana';
    if (card.suit) {
      return card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
    }
    return 'Minor Arcana';
  };

  // Handle clicks outside dock to close on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setIsDockExpanded(false);
        setHasTappedDock(false);
        setIsAutoExpanded(false);
      }
    };

    if (isDockExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDockExpanded]);

  // Mobile dock auto-expand/collapse behavior
  // - Expand after 4s when card is centered and revealed
  // - Collapse after 4s more
  // - Collapse immediately if user scrolls away or reveals new card
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    if (!isRevealed || !primaryTalk) return;

    const wasNewCardRevealed = revealedCount > prevRevealedCountRef.current;
    const didScrollAway = prevCenteredRef.current && !isCentered;

    // Update refs
    prevRevealedCountRef.current = revealedCount;
    prevCenteredRef.current = isCentered;

    // Collapse immediately if user revealed a new card or scrolled away
    if ((wasNewCardRevealed || didScrollAway) && isDockExpanded) {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setIsDockExpanded(false);
      setHasTappedDock(false);
      setIsAutoExpanded(false);
      return;
    }

    // If not centered, clear timers and don't start new ones
    if (!isCentered) {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      return;
    }

    // If centered and dock not expanded, start expand timer
    if (isCentered && !isDockExpanded && !expandTimerRef.current) {
      expandTimerRef.current = setTimeout(() => {
        expandTimerRef.current = null;
        setIsDockExpanded(true);
        setHasTappedDock(true);
        setIsAutoExpanded(true); // Track that this was an auto-expansion

        // Start collapse timer
        collapseTimerRef.current = setTimeout(() => {
          collapseTimerRef.current = null;
          setIsDockExpanded(false);
          setHasTappedDock(false);
          setIsAutoExpanded(false);
        }, 4000);
      }, 4000);
    }

    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [isCentered, isRevealed, primaryTalk, revealedCount, isDockExpanded]);

  // Calculate card position based on layout mode
  // Container is 720px for all spread modes, 280px for stacked
  const getCardPosition = () => {
    if (layoutMode === 'stacked') {
      // Stacked: cards offset horizontally to show edges (centered in 280px container)
      // Card 0: 0px, Card 1: 25px, Card 2: 50px
      return {
        left: `${index * 25}px`,
        transform: 'none',
        top: '0',
      };
    } else {
      // Spread modes (both spread-2 and spread-3 use same positions)
      // All 3 cards always positioned for 3-card centered layout
      // 3 cards (220px each) + 2*20px gaps = 700px total
      // Offset from left: (720 - 700) / 2 = 10px
      // Card 0: 10px, Card 1: 250px, Card 2: 490px
      return {
        left: `${index * 240 + 10}px`,
        transform: 'none',
        top: '0',
      };
    }
  };

  // Handle card click to reveal
  const handleCardClick = useCallback(() => {
    if (isNavigating || isDockExpanded) return;

    if (!isRevealed && !isFlipping) {
      setIsFlipping(true);

      // Play appropriate flip sound based on card position and layout
      if (index === 0) {
        // First card always plays flip sound
        onFlipSound?.();
      } else if (index === 1 || index === 2) {
        // Second/third card plays flip2 sound, UNLESS we're transitioning from stacked to spread
        // (in which case the shuffle sound will play instead)
        const isTransitioningToSpread = layoutMode === 'stacked';
        if (!isTransitioningToSpread) {
          onFlip2Sound?.();
        }
      }

      onReveal();

      // Complete flip animation (777ms)
      // Note: dock auto-expand is handled by the isCentered effect
      setTimeout(() => {
        setIsFlipping(false);
      }, 777);
    } else if (isRevealed) {
      // Navigate to card detail with sparkle burst and fade
      setIsNavigating(true);
      triggerSparkleBurst();
      onCardDetailClick?.(index, card.slug);
      setTimeout(() => {
        router.push(`/cards/${card.slug}`);
      }, 600); // Faster navigation after sparkle effect
    }
  }, [isRevealed, isFlipping, isDockExpanded, isNavigating, card.slug, router, onReveal, onFlipSound, onFlip2Sound, triggerSparkleBurst, primaryTalk, index, layoutMode, onCardDetailClick]);

  // Handle dock click/tap
  const handleDockClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!primaryTalk || isNavigating) return;

    // On mobile: first tap expands, second tap navigates
    if (window.innerWidth < 768) {
      if (!hasTappedDock) {
        setIsDockExpanded(true);
        setHasTappedDock(true);
        setIsAutoExpanded(false); // User manually tapped, not auto-expanded
      } else if (isDockExpanded) {
        // Second tap - navigate with sparkle burst
        setIsNavigating(true);
        triggerSparkleBurst();
        onTalkClick?.(index, primaryTalk.slug);
        setTimeout(() => {
          router.push(`/talks/${primaryTalk.slug}`);
        }, 600);
      }
    } else {
      // Desktop: click navigates with sparkle burst
      setIsNavigating(true);
      triggerSparkleBurst();
      onTalkClick?.(index, primaryTalk.slug);
      setTimeout(() => {
        router.push(`/talks/${primaryTalk.slug}`);
      }, 600);
    }
  }, [primaryTalk, isNavigating, hasTappedDock, isDockExpanded, router, triggerSparkleBurst, index, onTalkClick]);

  // Handle swipe gestures on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dockRef.current?.setAttribute('data-touch-start-y', touch.clientY.toString());
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dockRef.current) return;

    const startY = parseFloat(dockRef.current.getAttribute('data-touch-start-y') || '0');
    const endY = e.changedTouches[0].clientY;
    const diff = startY - endY;

    // Swipe up to expand
    if (diff > 30 && !isDockExpanded) {
      setIsDockExpanded(true);
      setHasTappedDock(true);
      setIsAutoExpanded(false); // User manually swiped, not auto-expanded
    }
    // Swipe down to close
    else if (diff < -30 && isDockExpanded) {
      setIsDockExpanded(false);
      setHasTappedDock(false);
      setIsAutoExpanded(false);
    }
  }, [isDockExpanded]);

  const cardPosition = getCardPosition();

  return (
    <div
      ref={cardRef}
      className={`
        absolute flex flex-col animate-cascade-in
        ${layoutMode !== 'stacked' ? 'snap-center md:snap-align-none' : ''}
      `}
      style={{
        ...cardPosition,
        zIndex: layoutMode === 'stacked' ? 3 - index : index,
        animationDelay: `${index * 333}ms`,
        transition: 'left 600ms ease-out, transform 600ms ease-out, opacity 300ms ease-out, filter 300ms ease-out',
        opacity: isNavigating ? 0 : 1,
        transform: isNavigating ? 'scale(1.05)' : 'scale(1)',
        filter: isNavigating ? 'brightness(1.5) blur(2px)' : 'none',
      }}
    >
      {/* Sparkle Burst Effect */}
      {navSparkles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 100 }}>
          {navSparkles.map((sparkle) => {
            const radians = (sparkle.angle * Math.PI) / 180;
            const endX = 50 + Math.cos(radians) * sparkle.distance;
            const endY = 50 + Math.sin(radians) * sparkle.distance;
            return (
              <div
                key={sparkle.id}
                className="absolute rounded-full bg-white animate-sparkle-burst"
                style={{
                  width: sparkle.size,
                  height: sparkle.size,
                  left: '50%',
                  top: '50%',
                  '--end-x': `${endX - 50}%`,
                  '--end-y': `${endY - 50}%`,
                  boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.size}px rgba(139, 92, 246, 0.8)`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}
      {/* Card Container */}
      <div
        className={`
          relative w-[200px] h-[340px] md:w-[220px] md:h-[370px] cursor-pointer
        `}
        style={{
          perspective: '1000px',
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleCardClick}
      >
        {/* Card Container with 3D flip */}
        <div
          className={`
            relative w-full h-full
            ${isFlipping ? 'animate-ritual-flip' : ''}
            ${!isRevealed && isHovering && !isFlipping ? 'hover:rotate-y-12' : ''}
          `}
          style={{
            transformStyle: 'preserve-3d',
            transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: isFlipping ? 'none' : 'transform 0.3s ease-out',
          }}
        >
        {/* Card Back (Face Down) */}
        <div
          className={`
            absolute inset-0 rounded-xl overflow-hidden shadow-xl
            transition-all duration-300
            ${!isRevealed && !isFlipping && isHovering ? 'shadow-2xl shadow-purple-500/30 scale-105' : ''}
          `}
          style={{
            backfaceVisibility: 'hidden',
            pointerEvents: isRevealed && !isFlipping ? 'none' : 'auto',
          }}
        >
          <Image
            src="/deck-back.webp"
            alt="Tarot card back"
            fill
            sizes="220px"
            className="object-cover"
          />
          {/* Mystical glow on hover */}
          <div
            className={`
              absolute inset-0 bg-gradient-to-t from-purple-600/30 via-transparent to-indigo-600/20
              transition-opacity duration-300
              ${isHovering ? 'opacity-100' : 'opacity-0'}
            `}
          />
        </div>

        {/* Card Front (Revealed) */}
        <div
          className={`
            absolute inset-0 rounded-xl overflow-hidden shadow-xl
            transition-all duration-300
            ${isRevealed && isHovering ? 'shadow-2xl shadow-indigo-500/40' : ''}
          `}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Card Image */}
          <Image
            src={card.imageUrl || '/deck-back.webp'}
            alt={card.name}
            fill
            sizes="220px"
            className="object-cover"
          />

          {/* Card Info Overlay (shown on hover when dock not expanded - DESKTOP ONLY) */}
          <div
            className={`
              absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent
              flex flex-col justify-end p-4
              transition-opacity duration-300
              ${isRevealed && isHovering && !isDockExpanded ? 'md:opacity-100' : 'opacity-0'}
            `}
          >
            <h3 className="text-lg font-bold text-white mb-2">
              {card.name}
            </h3>
            {displayKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {displayKeywords.map((keyword: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-white/20 rounded-full text-gray-200"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Talk Dock - Below Card */}
      {isRevealed && primaryTalk && (
        <div className="relative w-[200px] md:w-[220px] -mt-3">
          {/* Dock Container - Fixed height to prevent layout shift */}
          <div
            ref={dockRef}
            className={`
              relative min-h-[54px]
              bg-gradient-to-r from-gray-900/95 to-gray-800/95
              border-l border-r border-b border-gray-700/50
              rounded-b-xl cursor-pointer
              transition-all duration-300 ease-out
              ${isDockExpanded || isDockHovering ? 'shadow-xl' : 'shadow-md'}
            `}
            style={{
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={() => setIsDockHovering(true)}
            onMouseLeave={() => setIsDockHovering(false)}
            onClick={handleDockClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Collapsed State - Absolute positioned to maintain container height */}
            <div
              className={`
                absolute inset-0
                p-3 flex items-center gap-2
                transition-all duration-300
                ${isDockExpanded || isDockHovering ? 'opacity-0 pointer-events-none' : 'opacity-100'}
              `}
            >
              <div className="w-5 h-5 rounded-full bg-[#EB0028] flex items-center justify-center flex-shrink-0">
                <Play className="w-2.5 h-2.5 text-white fill-white" />
              </div>
              <p className="text-sm font-medium text-white truncate flex-1">
                {primaryTalk.title}
              </p>
              <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>

            {/* Expanded Rollup Overlay */}
            <div
              className={`
                absolute bottom-0 left-0 right-0
                bg-gradient-to-t from-black/85 via-gray-900/80 to-gray-800/75
                border-l border-r border-b border-gray-700/50 rounded-b-xl
                transition-all duration-300 ease-out
                ${isDockExpanded || isDockHovering ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}
              style={{
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="p-4 space-y-2.5">
                {/* Event Name with TED Red */}
                <p className="text-xs font-bold text-[#EB0028] uppercase tracking-wider" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                  TED Talk
                </p>

                {/* Talk Title (wrapped) */}
                <h4 className="text-base font-semibold text-white leading-tight">
                  {primaryTalk.title}
                </h4>

                {/* Speaker & Duration */}
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span className="truncate">{primaryTalk.speakerName}</span>
                  {primaryTalk.durationSeconds && (
                    <span className="flex-shrink-0 ml-2">
                      {formatDuration(primaryTalk.durationSeconds)}
                    </span>
                  )}
                </div>

                {/* Tap hint on mobile */}
                {hasTappedDock && (
                  <p className="text-xs text-gray-400 text-center md:hidden pt-1">
                    {isAutoExpanded ? 'Tap to watch' : 'Tap again to watch'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
