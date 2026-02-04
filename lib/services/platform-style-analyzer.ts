/**
 * Platform Style Analyzer
 *
 * Analyzes social media posts to learn platform-specific messaging patterns.
 * Supports engagement-weighted analysis when metrics are available.
 */

// Types
export type Platform = 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

export type PostForAnalysis = {
  id: string;
  platform: Platform;
  notes: string | null; // The post text
  likeCount: number | null;
  repostCount: number | null;
  replyCount: number | null;
};

export type LengthStats = {
  avg: number;
  min: number;
  max: number;
  median: number;
  weightedAvg: number | null; // Only when engagement data exists
};

export type HashtagPatterns = {
  usagePct: number; // Percentage of posts using hashtags
  avgCount: number; // Average count when used
  commonTags: string[]; // Most common hashtags
};

export type EmojiPatterns = {
  usagePct: number;
  avgCount: number;
  commonEmojis: string[];
  positions: {
    start: number; // Percentage at start
    middle: number;
    end: number;
  };
};

export type MentionPatterns = {
  usagePct: number;
  avgCount: number;
  types: {
    speaker: number; // Percentage that look like speaker handles
    org: number; // Organization handles (TED, TEDx, etc.)
    other: number;
  };
};

export type TopPerformerTraits = {
  avgLength: number;
  hashtagUsagePct: number;
  emojiUsagePct: number;
  mentionUsagePct: number;
  commonPatterns: string[]; // Human-readable patterns
};

export type PlatformStylePattern = {
  platform: Platform;
  lengthStats: LengthStats;
  hashtagPatterns: HashtagPatterns;
  emojiPatterns: EmojiPatterns;
  mentionPatterns: MentionPatterns;
  engagementThreshold: number | null;
  topPerformerTraits: TopPerformerTraits | null;
  topPerformerCount: number;
  examplePostIds: string[];
  postsAnalyzed: number;
};

// Regex patterns
const HASHTAG_REGEX = /#[\w]+/g;
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
const MENTION_REGEX = /@[\w.-]+/g;

// Organization handles to identify
const ORG_HANDLES = [
  'ted', 'tedtalks', 'tedx', 'tedxtalks', 'tedconferneces',
  'tarottalks', 'tarottalks.app'
];

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_REGEX);
  return matches ? matches.map(h => h.toLowerCase()) : [];
}

/**
 * Extract emojis from text
 */
export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_REGEX);
  return matches || [];
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(MENTION_REGEX);
  return matches ? matches.map(m => m.toLowerCase()) : [];
}

/**
 * Calculate engagement score for a post
 * Likes + (reposts * 2) + (replies * 3)
 */
export function calculateEngagementScore(post: PostForAnalysis): number {
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;
  return likes + (reposts * 2) + (replies * 3);
}

/**
 * Calculate length statistics from posts
 */
export function calculateLengthStats(
  posts: PostForAnalysis[],
  topPerformers?: PostForAnalysis[]
): LengthStats {
  const lengths = posts
    .filter(p => p.notes)
    .map(p => p.notes!.length);

  if (lengths.length === 0) {
    return { avg: 0, min: 0, max: 0, median: 0, weightedAvg: null };
  }

  const sorted = [...lengths].sort((a, b) => a - b);
  const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];

  // Calculate weighted average if top performers exist
  let weightedAvg: number | null = null;
  if (topPerformers && topPerformers.length > 0) {
    // Weight top performers 2x in the average
    const regularPosts = posts.filter(
      p => !topPerformers.some(tp => tp.id === p.id)
    );
    const regularLengths = regularPosts
      .filter(p => p.notes)
      .map(p => p.notes!.length);
    const topLengths = topPerformers
      .filter(p => p.notes)
      .map(p => p.notes!.length);

    const totalWeight = regularLengths.length + (topLengths.length * 2);
    if (totalWeight > 0) {
      const regularSum = regularLengths.reduce((a, b) => a + b, 0);
      const topSum = topLengths.reduce((a, b) => a + b, 0) * 2;
      weightedAvg = Math.round((regularSum + topSum) / totalWeight);
    }
  }

  return { avg, min, max, median, weightedAvg };
}

/**
 * Analyze hashtag patterns from posts
 */
export function analyzeHashtagPatterns(posts: PostForAnalysis[]): HashtagPatterns {
  const postsWithText = posts.filter(p => p.notes);
  if (postsWithText.length === 0) {
    return { usagePct: 0, avgCount: 0, commonTags: [] };
  }

  const hashtagCounts: Map<string, number> = new Map();
  let postsWithHashtags = 0;
  let totalHashtags = 0;

  for (const post of postsWithText) {
    const hashtags = extractHashtags(post.notes!);
    if (hashtags.length > 0) {
      postsWithHashtags++;
      totalHashtags += hashtags.length;
      for (const tag of hashtags) {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      }
    }
  }

  const usagePct = Math.round((postsWithHashtags / postsWithText.length) * 100);
  const avgCount = postsWithHashtags > 0
    ? Math.round((totalHashtags / postsWithHashtags) * 10) / 10
    : 0;

  // Get top 10 most common hashtags
  const commonTags = Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  return { usagePct, avgCount, commonTags };
}

/**
 * Analyze emoji patterns from posts
 */
export function analyzeEmojiPatterns(posts: PostForAnalysis[]): EmojiPatterns {
  const postsWithText = posts.filter(p => p.notes);
  if (postsWithText.length === 0) {
    return {
      usagePct: 0,
      avgCount: 0,
      commonEmojis: [],
      positions: { start: 0, middle: 0, end: 0 }
    };
  }

  const emojiCounts: Map<string, number> = new Map();
  let postsWithEmojis = 0;
  let totalEmojis = 0;
  let startCount = 0;
  let middleCount = 0;
  let endCount = 0;

  for (const post of postsWithText) {
    const text = post.notes!;
    const emojis = extractEmojis(text);

    if (emojis.length > 0) {
      postsWithEmojis++;
      totalEmojis += emojis.length;

      for (const emoji of emojis) {
        emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
      }

      // Analyze positions (where do emojis appear?)
      const firstEmojiIndex = text.search(EMOJI_REGEX);
      const textLength = text.length;

      if (firstEmojiIndex !== -1) {
        const position = firstEmojiIndex / textLength;
        if (position < 0.2) {
          startCount++;
        } else if (position > 0.8) {
          endCount++;
        } else {
          middleCount++;
        }
      }
    }
  }

  const usagePct = Math.round((postsWithEmojis / postsWithText.length) * 100);
  const avgCount = postsWithEmojis > 0
    ? Math.round((totalEmojis / postsWithEmojis) * 10) / 10
    : 0;

  // Get top 10 most common emojis
  const commonEmojis = Array.from(emojiCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([emoji]) => emoji);

  // Calculate position percentages
  const totalPositions = startCount + middleCount + endCount;
  const positions = totalPositions > 0
    ? {
      start: Math.round((startCount / totalPositions) * 100) / 100,
      middle: Math.round((middleCount / totalPositions) * 100) / 100,
      end: Math.round((endCount / totalPositions) * 100) / 100
    }
    : { start: 0, middle: 0, end: 0 };

  return { usagePct, avgCount, commonEmojis, positions };
}

/**
 * Analyze mention patterns from posts
 */
export function analyzeMentionPatterns(posts: PostForAnalysis[]): MentionPatterns {
  const postsWithText = posts.filter(p => p.notes);
  if (postsWithText.length === 0) {
    return {
      usagePct: 0,
      avgCount: 0,
      types: { speaker: 0, org: 0, other: 0 }
    };
  }

  let postsWithMentions = 0;
  let totalMentions = 0;
  let speakerMentions = 0;
  let orgMentions = 0;
  let otherMentions = 0;

  for (const post of postsWithText) {
    const mentions = extractMentions(post.notes!);

    if (mentions.length > 0) {
      postsWithMentions++;
      totalMentions += mentions.length;

      for (const mention of mentions) {
        const handle = mention.replace('@', '').toLowerCase();

        if (ORG_HANDLES.some(org => handle.includes(org))) {
          orgMentions++;
        } else {
          // Assume non-org mentions are speaker mentions
          // (In reality, this is a simplification - could be improved)
          speakerMentions++;
        }
      }
    }
  }

  const usagePct = Math.round((postsWithMentions / postsWithText.length) * 100);
  const avgCount = postsWithMentions > 0
    ? Math.round((totalMentions / postsWithMentions) * 10) / 10
    : 0;

  // Calculate type percentages
  const totalTyped = speakerMentions + orgMentions + otherMentions;
  const types = totalTyped > 0
    ? {
      speaker: Math.round((speakerMentions / totalTyped) * 100) / 100,
      org: Math.round((orgMentions / totalTyped) * 100) / 100,
      other: Math.round((otherMentions / totalTyped) * 100) / 100
    }
    : { speaker: 0, org: 0, other: 0 };

  return { usagePct, avgCount, types };
}

/**
 * Identify top performers (top 25% by engagement)
 */
export function identifyTopPerformers(posts: PostForAnalysis[]): PostForAnalysis[] {
  // Only consider posts with any engagement
  const postsWithEngagement = posts.filter(p =>
    (p.likeCount || 0) + (p.repostCount || 0) + (p.replyCount || 0) > 0
  );

  if (postsWithEngagement.length < 4) {
    // Need at least 4 posts to identify top 25%
    return [];
  }

  const sorted = [...postsWithEngagement].sort(
    (a, b) => calculateEngagementScore(b) - calculateEngagementScore(a)
  );

  const topCount = Math.max(1, Math.floor(sorted.length * 0.25));
  return sorted.slice(0, topCount);
}

/**
 * Analyze traits of top performing posts
 */
export function analyzeTopPerformerTraits(
  topPerformers: PostForAnalysis[]
): TopPerformerTraits | null {
  if (topPerformers.length === 0) {
    return null;
  }

  const postsWithText = topPerformers.filter(p => p.notes);
  if (postsWithText.length === 0) {
    return null;
  }

  // Length analysis
  const lengths = postsWithText.map(p => p.notes!.length);
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

  // Hashtag usage
  const withHashtags = postsWithText.filter(p => extractHashtags(p.notes!).length > 0);
  const hashtagUsagePct = Math.round((withHashtags.length / postsWithText.length) * 100);

  // Emoji usage
  const withEmojis = postsWithText.filter(p => extractEmojis(p.notes!).length > 0);
  const emojiUsagePct = Math.round((withEmojis.length / postsWithText.length) * 100);

  // Mention usage
  const withMentions = postsWithText.filter(p => extractMentions(p.notes!).length > 0);
  const mentionUsagePct = Math.round((withMentions.length / postsWithText.length) * 100);

  // Generate common patterns (human-readable insights)
  const commonPatterns: string[] = [];

  if (avgLength > 200) {
    commonPatterns.push('Longer posts (200+ chars) perform better');
  } else if (avgLength < 100) {
    commonPatterns.push('Shorter posts (<100 chars) perform better');
  }

  if (hashtagUsagePct > 75) {
    commonPatterns.push('Most top posts use hashtags');
  } else if (hashtagUsagePct < 25) {
    commonPatterns.push('Top posts rarely use hashtags');
  }

  if (emojiUsagePct > 75) {
    commonPatterns.push('Top posts frequently use emojis');
  }

  if (mentionUsagePct > 75) {
    commonPatterns.push('Top posts frequently mention people');
  }

  return {
    avgLength,
    hashtagUsagePct,
    emojiUsagePct,
    mentionUsagePct,
    commonPatterns
  };
}

/**
 * Select representative example posts
 * Prioritizes top performers, then most recent
 */
export function selectExamplePosts(
  posts: PostForAnalysis[],
  topPerformers: PostForAnalysis[],
  limit: number = 5
): string[] {
  const examples: string[] = [];

  // Add top performers first (up to 3)
  for (const post of topPerformers.slice(0, 3)) {
    if (!examples.includes(post.id)) {
      examples.push(post.id);
    }
  }

  // Fill remaining with other posts
  for (const post of posts) {
    if (examples.length >= limit) break;
    if (!examples.includes(post.id)) {
      examples.push(post.id);
    }
  }

  return examples;
}

/**
 * Main analysis function - analyzes all posts for a platform
 */
export function analyzePatterns(
  posts: PostForAnalysis[],
  platform: Platform
): PlatformStylePattern {
  const postsWithText = posts.filter(p => p.notes && p.notes.trim().length > 0);

  // Identify top performers
  const topPerformers = identifyTopPerformers(postsWithText);

  // Calculate engagement threshold (score of lowest top performer)
  const engagementThreshold = topPerformers.length > 0
    ? calculateEngagementScore(topPerformers[topPerformers.length - 1])
    : null;

  // Run all analyses
  const lengthStats = calculateLengthStats(postsWithText, topPerformers);
  const hashtagPatterns = analyzeHashtagPatterns(postsWithText);
  const emojiPatterns = analyzeEmojiPatterns(postsWithText);
  const mentionPatterns = analyzeMentionPatterns(postsWithText);
  const topPerformerTraits = analyzeTopPerformerTraits(topPerformers);
  const examplePostIds = selectExamplePosts(postsWithText, topPerformers);

  return {
    platform,
    lengthStats,
    hashtagPatterns,
    emojiPatterns,
    mentionPatterns,
    engagementThreshold,
    topPerformerTraits,
    topPerformerCount: topPerformers.length,
    examplePostIds,
    postsAnalyzed: postsWithText.length
  };
}
