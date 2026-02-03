import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/utils/rate-limit';

/**
 * Extract YouTube video ID from URL
 */
function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // youtu.be format
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }

    // youtube.com/watch format
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;

      // youtube.com/embed format
      const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate that a thumbnail URL is accessible
 * Returns true if the image can be loaded, false otherwise
 */
async function validateThumbnailUrl(url: string): Promise<boolean> {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout for validation
    });

    // Check if response is OK and content-type is an image
    if (!response.ok) return false;

    const contentType = response.headers.get('content-type');
    return contentType?.startsWith('image/') ?? false;
  } catch {
    return false;
  }
}

/**
 * Fetch metadata from TED oEmbed API
 */
async function fetchTedMetadata(url: string): Promise<TedMetadata | { error: string }> {
  try {
    const response = await fetch(
      `https://www.ted.com/services/v1/oembed.json?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(10000) } // 10 second timeout
    );

    if (response.status === 404) {
      return { error: 'Talk not found on TED.com - may have been removed' };
    }
    if (!response.ok) {
      return { error: `TED API error: ${response.status}` };
    }

    const data = await response.json();
    const thumbnailUrl = data.thumbnail_url || null;

    // Validate that the thumbnail is actually accessible
    let validatedThumbnailUrl = thumbnailUrl;
    let thumbnailError: string | null = null;

    if (thumbnailUrl) {
      const isValid = await validateThumbnailUrl(thumbnailUrl);
      if (!isValid) {
        validatedThumbnailUrl = null;
        thumbnailError = 'TED thumbnail image could not be loaded';
      }
    }

    return {
      title: data.title || null,
      thumbnailUrl: validatedThumbnailUrl,
      authorName: data.author_name || null,
      thumbnailError,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { error: 'TED.com request timed out - try again later' };
    }
    return { error: 'Failed to fetch from TED.com' };
  }
}

/**
 * Parse ISO 8601 duration to seconds (e.g., "PT15M33S" -> 933)
 */
function parseIsoDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetch metadata from YouTube Data API v3
 */
async function fetchYoutubeMetadata(
  videoId: string
): Promise<YoutubeMetadata | { error: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return { error: 'YouTube API key not configured' };
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) } // 10 second timeout
    );

    // Handle auth errors with detailed messages from Google
    if (response.status === 401 || response.status === 403) {
      const errorData = await response.json().catch(() => null);
      const googleError = errorData?.error?.message || errorData?.error?.errors?.[0]?.message;
      const reason = errorData?.error?.errors?.[0]?.reason;

      if (reason === 'quotaExceeded') {
        return { error: 'YouTube API quota exceeded - try again tomorrow' };
      }
      if (reason === 'keyInvalid') {
        return { error: 'Unable to fetch metadata - API configuration error' };
      }
      if (reason === 'ipRefererBlocked') {
        return { error: 'Unable to fetch metadata - API access restricted' };
      }

      // Return actual error from Google for debugging
      return { error: `YouTube API: ${googleError || `Error ${response.status}`}` };
    }
    if (!response.ok) {
      return { error: `YouTube API error: ${response.status}` };
    }

    const data = await response.json();
    if (!data.items?.length) {
      return { error: 'YouTube video not found - may have been deleted' };
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const contentDetails = item.contentDetails;

    // Extract year from published date
    const publishedAt = new Date(snippet.publishedAt);
    const year = publishedAt.getFullYear();

    // Parse duration
    const durationSeconds = parseIsoDuration(contentDetails.duration);

    return {
      title: snippet.title || null,
      description: snippet.description || null,
      thumbnailUrl:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.default?.url ||
        null,
      year,
      durationSeconds,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { error: 'YouTube API request timed out - try again later' };
    }
    return { error: 'Failed to fetch from YouTube API' };
  }
}

type TedMetadata = {
  title: string | null;
  thumbnailUrl: string | null;
  authorName: string | null;
  thumbnailError?: string | null;
};

/**
 * Parsed components from a YouTube video title
 */
type ParsedYouTubeTitle = {
  speakerName: string | null;
  eventName: string | null;
  cleanTitle: string;
};

/**
 * Parse YouTube video title to extract speaker name, event name, and clean title
 * Handles common TED/TEDx title formats:
 * - "Speaker Name: Talk Title"
 * - "Speaker Name -- Talk Title"
 * - "Talk Title | Speaker Name"
 * - "Talk Title | Speaker Name | TEDxEvent"
 * - "Talk Title | Speaker Name | TED2023"
 */
function parseYouTubeTitle(rawTitle: string): ParsedYouTubeTitle {
  if (!rawTitle) {
    return { speakerName: null, eventName: null, cleanTitle: '' };
  }

  // Event name detection regex: TED, TED2023, TEDx, TEDxBoston, TEDx San Francisco
  const eventRegex = /^TED(x[A-Za-z\s]+|\d{4})?$/i;

  // Helper to check if a string looks like a speaker name
  const looksLikeSpeakerName = (str: string): boolean => {
    const trimmed = str.trim();
    // Speaker names typically:
    // - Are 2-4 words
    // - Start with capital letters
    // - Don't start with common title words
    const words = trimmed.split(/\s+/);
    if (words.length < 1 || words.length > 5) return false;

    const titleWords = ['how', 'why', 'what', 'the', 'a', 'an', 'when', 'where', 'is', 'are', 'can', 'do', 'does', 'your', 'my', 'our', 'this', 'that', 'these', 'inside', 'beyond'];
    if (titleWords.includes(words[0].toLowerCase())) return false;

    // Should have at least one capital letter (proper noun)
    if (!/[A-Z]/.test(trimmed)) return false;

    return true;
  };

  let speakerName: string | null = null;
  let eventName: string | null = null;
  let cleanTitle: string = rawTitle;

  // Pattern 1: "Speaker Name: Talk Title" (colon format)
  const colonMatch = rawTitle.match(/^([^:]+):\s*(.+)$/);
  if (colonMatch) {
    const potentialSpeaker = colonMatch[1].trim();
    const potentialTitle = colonMatch[2].trim();

    if (looksLikeSpeakerName(potentialSpeaker)) {
      speakerName = potentialSpeaker;
      cleanTitle = potentialTitle;

      // Check if title ends with event name after pipe
      const pipeMatch = cleanTitle.match(/^(.+)\|\s*([^|]+)$/);
      if (pipeMatch) {
        const lastSegment = pipeMatch[2].trim();
        if (eventRegex.test(lastSegment)) {
          eventName = lastSegment;
          cleanTitle = pipeMatch[1].trim();
        }
      }

      return { speakerName, eventName, cleanTitle };
    }
  }

  // Pattern 2: "Speaker Name -- Talk Title" (double dash format)
  const dashMatch = rawTitle.match(/^([^-]+)\s*--\s*(.+)$/);
  if (dashMatch) {
    const potentialSpeaker = dashMatch[1].trim();
    const potentialTitle = dashMatch[2].trim();

    if (looksLikeSpeakerName(potentialSpeaker)) {
      speakerName = potentialSpeaker;
      cleanTitle = potentialTitle;

      // Check if title ends with event name after pipe
      const pipeMatch = cleanTitle.match(/^(.+)\|\s*([^|]+)$/);
      if (pipeMatch) {
        const lastSegment = pipeMatch[2].trim();
        if (eventRegex.test(lastSegment)) {
          eventName = lastSegment;
          cleanTitle = pipeMatch[1].trim();
        }
      }

      return { speakerName, eventName, cleanTitle };
    }
  }

  // Pattern 3: Pipe-separated format "Title | Speaker | Event" or "Title | Speaker"
  const segments = rawTitle.split('|').map((s) => s.trim());

  if (segments.length >= 2) {
    // Check last segment for event name
    const lastSegment = segments[segments.length - 1];
    if (eventRegex.test(lastSegment)) {
      eventName = lastSegment;
      segments.pop(); // Remove event from segments
    }

    // Now find speaker name among remaining segments
    // Heuristic: speaker name is typically shorter and looks like a name
    if (segments.length >= 2) {
      // Find the segment that looks most like a speaker name
      let speakerIndex = -1;
      let shortestNameLength = Infinity;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (looksLikeSpeakerName(segment) && segment.length < shortestNameLength) {
          speakerIndex = i;
          shortestNameLength = segment.length;
        }
      }

      if (speakerIndex !== -1) {
        speakerName = segments[speakerIndex];
        // Remove speaker from segments and join remaining as title
        segments.splice(speakerIndex, 1);
        cleanTitle = segments.join(' | ').trim();
      } else {
        // No clear speaker found, use all segments as title
        cleanTitle = segments.join(' | ').trim();
      }
    } else if (segments.length === 1) {
      cleanTitle = segments[0];
    }
  }

  return { speakerName, eventName, cleanTitle };
}

type YoutubeMetadata = {
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  year: number;
  durationSeconds: number;
};

type MergedMetadata = {
  title: string | null;
  description: string | null;
  durationSeconds: number | null;
  year: number | null;
  thumbnailUrl: string | null;
  speakerName: string | null;
  eventName: string | null;
  source: {
    title?: 'ted' | 'youtube';
    description?: 'youtube';
    thumbnailUrl?: 'ted' | 'youtube';
    year?: 'youtube';
    durationSeconds?: 'youtube';
    speakerName?: 'ted' | 'youtube';
    eventName?: 'youtube';
  };
};

/**
 * POST /api/admin/fetch-metadata
 * Fetch metadata from TED and/or YouTube APIs
 *
 * Request body:
 * {
 *   tedUrl?: string;
 *   youtubeUrl?: string;
 * }
 *
 * Response:
 * {
 *   ted: TedMetadata | null;
 *   youtube: YoutubeMetadata | null;
 *   merged: MergedMetadata;
 *   errors: {
 *     ted?: string;
 *     youtube?: string;
 *   };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check (10 requests per minute per IP)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip, 10, 60000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    let { tedUrl, youtubeUrl } = body;

    // Trim URLs and convert empty strings to null
    tedUrl = tedUrl?.trim() || null;
    youtubeUrl = youtubeUrl?.trim() || null;

    if (!tedUrl && !youtubeUrl) {
      return NextResponse.json(
        { error: 'At least one URL (tedUrl or youtubeUrl) is required' },
        { status: 400 }
      );
    }

    const errors: { ted?: string; youtube?: string; tedThumbnail?: string } = {};
    let tedData: TedMetadata | null = null;
    let youtubeData: YoutubeMetadata | null = null;

    // Fetch from TED if URL provided
    if (tedUrl) {
      const result = await fetchTedMetadata(tedUrl);
      if ('error' in result) {
        errors.ted = result.error;
      } else {
        tedData = result;
        // Report thumbnail validation error separately (not a full failure)
        if (result.thumbnailError) {
          errors.tedThumbnail = result.thumbnailError;
        }
      }
    }

    // Fetch from YouTube if URL provided
    if (youtubeUrl) {
      const videoId = extractYoutubeVideoId(youtubeUrl);
      if (!videoId) {
        errors.youtube = 'Invalid YouTube URL format';
      } else {
        const result = await fetchYoutubeMetadata(videoId);
        if ('error' in result) {
          errors.youtube = result.error;
        } else {
          youtubeData = result;
        }
      }
    }

    // Parse YouTube title for speaker/event extraction
    const parsedYouTube = youtubeData?.title
      ? parseYouTubeTitle(youtubeData.title)
      : null;

    // Merge metadata (TED data preferred for title/thumbnail, YouTube fills rest)
    const merged: MergedMetadata = {
      title: tedData?.title || youtubeData?.title || null,
      description: youtubeData?.description || null,
      durationSeconds: youtubeData?.durationSeconds || null,
      year: youtubeData?.year || null,
      thumbnailUrl: tedData?.thumbnailUrl || youtubeData?.thumbnailUrl || null,
      speakerName: tedData?.authorName || parsedYouTube?.speakerName || null,
      eventName: parsedYouTube?.eventName || null,
      source: {},
    };

    // Track where each field came from
    if (merged.title) {
      merged.source.title = tedData?.title ? 'ted' : 'youtube';
    }
    if (merged.description) {
      merged.source.description = 'youtube';
    }
    if (merged.thumbnailUrl) {
      merged.source.thumbnailUrl = tedData?.thumbnailUrl ? 'ted' : 'youtube';
    }
    if (merged.year) {
      merged.source.year = 'youtube';
    }
    if (merged.durationSeconds) {
      merged.source.durationSeconds = 'youtube';
    }
    if (merged.speakerName) {
      merged.source.speakerName = tedData?.authorName ? 'ted' : 'youtube';
    }
    if (merged.eventName) {
      merged.source.eventName = 'youtube';
    }

    return NextResponse.json({
      ted: tedData,
      youtube: youtubeData,
      merged,
      errors,
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}
