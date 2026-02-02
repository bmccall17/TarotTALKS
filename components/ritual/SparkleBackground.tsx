'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

type Sparkle = {
  id: number;
  size: number;
  x: number;
  y: number;
  delay: number;
  opacity: number;
};

type TravelingSparkle = {
  id: number;
  size: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  delay: number;
};

type MouseSparkle = {
  id: number;
  x: number;
  y: number;
  size: number;
  life: number;
  settled: boolean; // true when sparkle has faded to persistent state
  driftX: number; // drift direction X
  driftY: number; // drift direction Y
  pulseSpeed: number; // unique pulse duration for variety
  pulseOffset: number; // offset so sparkles don't pulse in sync
};

export function SparkleBackground() {
  const [mouseSparkles, setMouseSparkles] = useState<MouseSparkle[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const sparkleIdRef = useRef(0);

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate static breathing sparkles
  const breathingSparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      size: Math.random() * 3 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 8000,
      opacity: 0.1 + Math.random() * 0.15,
    }));
  }, []);

  // Generate traveling sparkles for mobile (doubled to 16)
  const travelingSparkles = useMemo<TravelingSparkle[]>(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      size: Math.random() * 3 + 2,
      startX: Math.random() * 100,
      startY: Math.random() * 100,
      endX: Math.random() * 100,
      endY: Math.random() * 100,
      duration: 12000 + Math.random() * 16000, // 12-28 seconds (varied)
      delay: i * 1000, // Stagger starts
    }));
  }, []);

  // Handle mouse movement on desktop - spawn sparkles near cursor
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only spawn sparkles if mouse moved enough
    if (distance > 30) {
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      // Debug logging for scroll position issues
      console.log('[Sparkle Debug] Mouse move', {
        clientX: e.clientX,
        clientY: e.clientY,
        pageY: e.pageY,
        scrollY: window.scrollY,
      });

      // Spawn 1-2 sparkles near cursor
      // Use pageX/pageY to account for scroll position since sparkles are in an absolute container
      const newSparkles: MouseSparkle[] = Array.from(
        { length: Math.floor(Math.random() * 2) + 1 },
        () => ({
          id: sparkleIdRef.current++,
          x: e.pageX + (Math.random() - 0.5) * 60,
          y: e.pageY + (Math.random() - 0.5) * 60,
          size: Math.random() * 4 + 2,
          life: 1,
          settled: false,
          driftX: (Math.random() - 0.5) * 0.3, // Slow drift speed
          driftY: (Math.random() - 0.5) * 0.3,
          pulseSpeed: 3000 + Math.random() * 4000, // 3-7 second pulse cycles
          pulseOffset: Math.random() * Math.PI * 2, // Random phase offset
        })
      );

      // Keep up to 50 sparkles (settled ones persist)
      setMouseSparkles(prev => [...prev, ...newSparkles].slice(-50));
    }
  }, []);

  // Fade mouse sparkles to settled state and apply drift
  useEffect(() => {
    if (isMobile || mouseSparkles.length === 0) return;

    const interval = setInterval(() => {
      setMouseSparkles(prev =>
        prev.map(s => {
          // Apply drift to all sparkles (both fading and settled)
          const newX = s.x + s.driftX;
          const newY = s.y + s.driftY;

          if (s.settled) {
            // Already settled - just drift, don't change life
            return { ...s, x: newX, y: newY };
          }

          const newLife = s.life - 0.03;
          if (newLife <= 0.33) {
            // Sparkle has settled - mark it and stop fading
            return { ...s, x: newX, y: newY, life: 0.33, settled: true };
          }
          return { ...s, x: newX, y: newY, life: newLife };
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, [isMobile, mouseSparkles.length]);

  // Add mouse listener on desktop
  useEffect(() => {
    if (isMobile) return;

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile, handleMouseMove]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static breathing sparkles */}
      {breathingSparkles.map((sparkle) => (
        <div
          key={`breath-${sparkle.id}`}
          className="absolute rounded-full bg-white animate-sparkle"
          style={{
            width: sparkle.size,
            height: sparkle.size,
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            animationDelay: `${sparkle.delay}ms`,
            opacity: sparkle.opacity,
            boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.size / 2}px rgba(139, 92, 246, 0.4)`,
          }}
        />
      ))}

      {/* Traveling sparkles for mobile */}
      {isMobile && travelingSparkles.map((sparkle) => (
        <div
          key={`travel-${sparkle.id}`}
          className="absolute rounded-full bg-white animate-sparkle-travel"
          style={{
            width: sparkle.size,
            height: sparkle.size,
            '--start-x': `${sparkle.startX}vw`,
            '--start-y': `${sparkle.startY}vh`,
            '--end-x': `${sparkle.endX}vw`,
            '--end-y': `${sparkle.endY}vh`,
            animationDuration: `${sparkle.duration}ms`,
            animationDelay: `${sparkle.delay}ms`,
            boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.size / 2}px rgba(139, 92, 246, 0.5)`,
          } as React.CSSProperties}
        />
      ))}

      {/* Mouse-following sparkles for desktop */}
      {!isMobile && mouseSparkles.map((sparkle) => (
        <div
          key={`mouse-${sparkle.id}`}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            width: sparkle.size,
            height: sparkle.size,
            left: sparkle.x,
            top: sparkle.y,
            opacity: sparkle.settled ? undefined : sparkle.life * 0.6,
            transform: `translate(-50%, -50%) scale(${sparkle.settled ? 1 : sparkle.life})`,
            transition: sparkle.settled ? 'none' : 'opacity 0.1s, transform 0.1s',
            boxShadow: `0 0 ${sparkle.size * 3}px ${sparkle.size}px rgba(139, 92, 246, ${sparkle.settled ? 0.3 : sparkle.life * 0.5})`,
            animation: sparkle.settled
              ? `sparkle-settle-dynamic ${sparkle.pulseSpeed}ms ease-in-out infinite`
              : 'none',
            animationDelay: sparkle.settled ? `${-sparkle.pulseOffset * 1000}ms` : '0ms',
            '--pulse-min': '0.03',
            '--pulse-max': '0.33',
          } as React.CSSProperties}
        />
      ))}

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-gray-900/50" />
    </div>
  );
}
