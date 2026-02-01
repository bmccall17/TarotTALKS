'use client';

import { useEffect, useState } from 'react';

const LOADING_MESSAGES = [
  'Consulting the cards...',
  'Finding your talk...',
  'Weaving the threads...',
  'Seeking wisdom...',
  'Aligning the stars...',
];

export function LoadingState() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {/* Animated Cards */}
      <div className="relative w-32 h-40">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute w-20 h-32 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg border border-indigo-500/30"
            style={{
              left: `${20 + i * 12}px`,
              top: `${i * 4}px`,
              transform: `rotate(${(i - 1) * 8}deg)`,
              animation: `cardFloat ${1.5 + i * 0.2}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          >
            {/* Card back pattern */}
            <div className="absolute inset-2 border border-indigo-400/20 rounded" />
            <div className="absolute inset-4 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-400/30 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Loading Message */}
      <p className="text-gray-400 text-sm animate-pulse">
        {LOADING_MESSAGES[messageIndex]}
      </p>

      {/* Spinner */}
      <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />

      <style jsx>{`
        @keyframes cardFloat {
          0%, 100% {
            transform: translateY(0) rotate(var(--rotation, 0deg));
          }
          50% {
            transform: translateY(-8px) rotate(var(--rotation, 0deg));
          }
        }
      `}</style>
    </div>
  );
}
