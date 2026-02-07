/**
 * Social Media Handle Utilities for Tag Pack feature
 */

// Organization handles (constants)
export const ORG_HANDLES = {
  twitter: {
    ted: 'TED',
    tedx: 'TEDx',
  },
  bluesky: {
    ted: 'ted.com',
  },
  linkedin: {
    ted: 'TED',
  },
  instagram: {
    ted: 'TED',
  },
} as const;

/**
 * Normalize a social media handle by removing @ prefix and trimming whitespace
 * Handles comma-separated multiple handles
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return '';

  return handle
    .split(',')
    .map((h) => h.trim().replace(/^@/, ''))
    .filter(Boolean)
    .join(', ');
}

/**
 * Validate Twitter/X handle format
 * Rules: alphanumeric + underscore, max 15 chars per handle
 */
export function isValidTwitterHandle(handle: string): boolean {
  if (!handle) return true; // Empty is valid (optional field)

  const handles = handle.split(',').map((h) => h.trim().replace(/^@/, ''));

  return handles.every((h) => {
    if (!h) return true;
    // Twitter handle: 1-15 chars, alphanumeric + underscore
    return /^[a-zA-Z0-9_]{1,15}$/.test(h);
  });
}

/**
 * Validate Bluesky handle format
 * Rules: domain-like format (e.g., user.bsky.social)
 */
export function isValidBlueskyHandle(handle: string): boolean {
  if (!handle) return true; // Empty is valid (optional field)

  const handles = handle.split(',').map((h) => h.trim().replace(/^@/, ''));

  return handles.every((h) => {
    if (!h) return true;
    // Bluesky handle: domain-like format
    // Allow: letters, numbers, dots, hyphens
    return /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(h) || /^[a-zA-Z0-9]$/.test(h);
  });
}

/**
 * Format tag pack for a specific platform
 * Includes speaker handle(s) and optionally org handle
 */
export function formatTagPack(
  platform: 'twitter' | 'bluesky' | 'linkedin' | 'instagram',
  speakerHandle: string | null | undefined,
  includeOrg: boolean = true
): string {
  const parts: string[] = [];

  if (speakerHandle) {
    const handles = speakerHandle.split(',').map((h) => h.trim());
    handles.forEach((h) => {
      if (h) {
        if (platform === 'linkedin') {
          // LinkedIn uses profile URLs, no @ prefix
          parts.push(`linkedin.com/in/${h.replace(/^@/, '')}`);
        } else {
          parts.push(`@${h.replace(/^@/, '')}`);
        }
      }
    });
  }

  if (includeOrg) {
    if (platform === 'twitter') {
      parts.push(`@${ORG_HANDLES.twitter.ted}`);
    } else if (platform === 'bluesky') {
      parts.push(`@${ORG_HANDLES.bluesky.ted}`);
    } else if (platform === 'linkedin') {
      parts.push(`linkedin.com/in/${ORG_HANDLES.linkedin.ted}`);
    } else if (platform === 'instagram') {
      parts.push(`@${ORG_HANDLES.instagram.ted}`);
    }
  }

  return parts.join(' ');
}

/**
 * Format tag pack for both platforms
 */
export function formatAllTagPacks(
  twitterHandle: string | null | undefined,
  blueskyHandle: string | null | undefined,
  linkedInHandle?: string | null | undefined,
  instagramHandle?: string | null | undefined,
  includeOrg: boolean = true
): { twitter: string; bluesky: string; linkedin: string; instagram: string } {
  return {
    twitter: formatTagPack('twitter', twitterHandle, includeOrg),
    bluesky: formatTagPack('bluesky', blueskyHandle, includeOrg),
    linkedin: formatTagPack('linkedin', linkedInHandle, includeOrg),
    instagram: formatTagPack('instagram', instagramHandle, includeOrg),
  };
}

// Platform types for Signal Deck
export type Platform = 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

/**
 * Detect platform from a post URL
 * NOTE: Instagram detection returns 'other' until migration 0007 is run
 */
export function detectPlatformFromUrl(url: string): Platform | null {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();

  // X (Twitter)
  if (lowerUrl.includes('x.com/') || lowerUrl.includes('twitter.com/')) {
    return 'x';
  }

  // Bluesky
  if (lowerUrl.includes('bsky.app/') || lowerUrl.includes('bsky.social/')) {
    return 'bluesky';
  }

  // Threads
  if (lowerUrl.includes('threads.net/')) {
    return 'threads';
  }

  // LinkedIn
  if (lowerUrl.includes('linkedin.com/')) {
    return 'linkedin';
  }

  // Instagram
  if (lowerUrl.includes('instagram.com/')) {
    return 'instagram';
  }

  return null;
}

/**
 * Extract Twitter/X post ID from URL
 * Matches: twitter.com/user/status/123 or x.com/user/status/123
 */
export function extractTwitterPostId(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
  return match?.[1] || null;
}

/**
 * Extract Instagram shortcode from URL
 * Matches: instagram.com/p/ABC123 or instagram.com/reel/ABC123
 */
export function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return match?.[1] || null;
}

/**
 * Extract LinkedIn post identifier from URL
 * LinkedIn URLs vary, return the full URL as identifier
 */
export function extractLinkedInPostUrn(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:posts|feed\/update)\/[^\/\s]+/);
  return match ? url : null;
}

/**
 * Validate a social media post URL format
 */
export function isValidPostUrl(url: string, platform: Platform): boolean {
  if (!url) return true; // Empty is valid (optional)

  try {
    new URL(url); // Basic URL validation
  } catch {
    return false;
  }

  switch (platform) {
    case 'x':
      return /(?:twitter|x)\.com\/\w+\/status\/\d+/.test(url);
    case 'bluesky':
      return /bsky\.app\/profile\/[^\/]+\/post\/[a-z0-9]+/.test(url);
    case 'instagram':
      return /instagram\.com\/(?:p|reel)\/[A-Za-z0-9_-]+/.test(url);
    case 'linkedin':
      return /linkedin\.com\/(?:posts|feed\/update)\//.test(url);
    case 'threads':
      return /threads\.net\/[^\/]+\/post\//.test(url);
    default:
      return true; // Accept any URL for 'other'
  }
}

/**
 * Get platform-specific metric labels
 */
export function getPlatformMetricLabels(platform: Platform): {
  likes: string;
  reposts: string | null;
  replies: string;
} {
  switch (platform) {
    case 'x':
      return { likes: 'Likes', reposts: 'Retweets', replies: 'Replies' };
    case 'instagram':
      return { likes: 'Likes', reposts: null, replies: 'Comments' };
    case 'linkedin':
      return { likes: 'Reactions', reposts: 'Reposts', replies: 'Comments' };
    case 'bluesky':
    case 'threads':
    default:
      return { likes: 'Likes', reposts: 'Reposts', replies: 'Replies' };
  }
}

/**
 * Check if a platform supports automatic metrics fetching
 * Currently only Bluesky has free API access
 */
export function platformSupportsAutoMetrics(platform: Platform): boolean {
  return platform === 'bluesky';
}

/**
 * Check if a platform supports automatic follow-status checking
 * Currently only Bluesky has free API access
 */
export function platformSupportsAutoFollowCheck(platform: Platform): boolean {
  return platform === 'bluesky';
}
