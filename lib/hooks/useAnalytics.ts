'use client';

import { useCallback, useEffect, useRef } from 'react';

// Session storage key name
const SESSION_STORAGE_NAME = 'tarot_session_id';
const SESSION_START_KEY = 'tarot_session_start';
const TEST_MODE_KEY = 'tarot_analytics_test_mode';

// Event queue and flush config
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 5;

// Check if test mode is enabled (via localStorage or URL param ?analytics_test=1)
function isTestMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check URL param first (enables test mode for session)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('analytics_test') === '1') {
    localStorage.setItem(TEST_MODE_KEY, 'true');
    return true;
  }
  if (urlParams.get('analytics_test') === '0') {
    localStorage.removeItem(TEST_MODE_KEY);
    return false;
  }

  // Check localStorage
  return localStorage.getItem(TEST_MODE_KEY) === 'true';
}

type EventPayload = {
  name: string;
  timestamp: number;
  properties: Record<string, unknown>;
};

// Generate a 12-char random session ID
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * 62)]).join('');
}

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem(SESSION_STORAGE_NAME);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_NAME, sessionId);
  }
  return sessionId;
}

// Get session start timestamp
function getSessionStart(): number {
  if (typeof window === 'undefined') return Date.now();

  const stored = sessionStorage.getItem(SESSION_START_KEY);
  if (stored) {
    return parseInt(stored, 10);
  }
  const now = Date.now();
  sessionStorage.setItem(SESSION_START_KEY, now.toString());
  return now;
}

// Get elapsed time since session start
function getElapsedMs(): number {
  return Date.now() - getSessionStart();
}

// Get device class based on viewport width
function getDeviceClass(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

// Module-level state (shared across hook instances)
let eventQueue: EventPayload[] = [];
let firedOnceEvents = new Set<string>();
let flushTimeout: NodeJS.Timeout | null = null;
let isInitialized = false;

// Flush events to server
async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  const sessionId = getSessionId();
  if (!sessionId) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    // Use sendBeacon for reliability during page unload
    const payload = JSON.stringify({ sessionId, events: eventsToSend });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', payload);
    } else {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  } catch (error) {
    // Re-queue events on failure (best effort)
    console.error('Failed to send analytics events:', error);
    eventQueue = [...eventsToSend, ...eventQueue];
  }
}

// Schedule flush with debounce
function scheduleFlush(): void {
  if (flushTimeout) return;

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

// Core track function
function track(
  name: string,
  properties: Record<string, unknown> = {},
  options?: { once?: boolean }
): void {
  // Check once-per-session guard
  if (options?.once) {
    if (firedOnceEvents.has(name)) return;
    firedOnceEvents.add(name);
  }

  const testMode = isTestMode();

  const event: EventPayload = {
    name,
    timestamp: Date.now(),
    properties: {
      ...properties,
      elapsed_ms: getElapsedMs(),
      ...(testMode ? { is_test: true } : {}),
    },
  };

  // Log test events to console for debugging
  if (testMode) {
    console.log('[Analytics Test Mode]', name, event.properties);
  }

  eventQueue.push(event);

  // Flush if threshold reached, otherwise schedule
  if (eventQueue.length >= FLUSH_THRESHOLD) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

export function useAnalytics() {
  const initRef = useRef(false);

  // Initialize on mount (track session_start)
  useEffect(() => {
    if (initRef.current || isInitialized) return;
    initRef.current = true;
    isInitialized = true;

    // Check if this is a restored session
    const existingSessionId = sessionStorage.getItem(SESSION_STORAGE_NAME);
    const isRestoredSession = !!existingSessionId;

    // Ensure session ID exists
    getSessionId();
    getSessionStart();

    // Track session start (once per session)
    track('session_start', {
      device_class: getDeviceClass(),
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      landing_page: typeof window !== 'undefined' ? window.location.pathname : '',
      is_restored_session: isRestoredSession,
    }, { once: true });

    // Flush on visibility change (user leaving page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushEvents();
      }
    };

    // Flush on page unload
    const handleBeforeUnload = () => {
      flushEvents();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Track card flip
  const trackCardFlip = useCallback((cardIndex: number, cardsRevealedCount: number, cardSlug: string) => {
    track('card_flip', {
      card_index: cardIndex,
      cards_revealed_count: cardsRevealedCount,
      card_slug: cardSlug,
    });

    // Track spread_ready when 2+ cards revealed (once per session)
    if (cardsRevealedCount >= 2) {
      track('spread_ready', {
        cards_revealed_count: cardsRevealedCount,
      }, { once: true });
    }
  }, []);

  // Track "Read My Spread" click
  const trackReadSpreadClick = useCallback((cardsRevealedCount: number) => {
    track('read_spread_click', {
      cards_revealed_count: cardsRevealedCount,
    });
  }, []);

  // Track talk click
  const trackTalkClick = useCallback((cardIndex: number, talkSlug: string) => {
    track('talk_click', {
      card_index: cardIndex,
      talk_slug: talkSlug,
    });
  }, []);

  // Track card detail click
  const trackCardDetailClick = useCallback((cardIndex: number, cardSlug: string) => {
    track('card_detail_click', {
      card_index: cardIndex,
      card_slug: cardSlug,
    });
  }, []);

  // Track reading started (when user opens focus modal)
  const trackReadingStarted = useCallback((cardsRevealedCount: number) => {
    track('reading_started', { cards_revealed_count: cardsRevealedCount });
  }, []);

  // Track focus selected
  const trackFocusSelected = useCallback((focusType: string, hasCustomText: boolean) => {
    track('focus_selected', { focus_type: focusType, has_custom_text: hasCustomText });
  }, []);

  // Track reading generated
  const trackReadingGenerated = useCallback((spreadId: string, talkSlug: string, score: number, source: string) => {
    track('reading_generated', {
      spread_id: spreadId,
      talk_slug: talkSlug,
      score,
      rationale_source: source,
    });
  }, []);

  // Track talk clicked from reading
  const trackTalkFromReading = useCallback((spreadId: string, talkSlug: string) => {
    track('talk_from_reading', { spread_id: spreadId, talk_slug: talkSlug });
  }, []);

  // Track share initiated
  const trackShareInitiated = useCallback((spreadId: string, platform: string, format: string) => {
    track('share_initiated', { spread_id: spreadId, platform, format });
  }, []);

  return {
    trackCardFlip,
    trackReadSpreadClick,
    trackTalkClick,
    trackCardDetailClick,
    // New spread reading events
    trackReadingStarted,
    trackFocusSelected,
    trackReadingGenerated,
    trackTalkFromReading,
    trackShareInitiated,
  };
}
