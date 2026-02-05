import { db } from '../index';
import { platformStylePatterns, socialShares } from '../schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import {
  analyzePatterns,
  type Platform,
  type PlatformStylePattern,
  type PostForAnalysis
} from '@/lib/services/platform-style-analyzer';

// Types
export type StoredPlatformStylePattern = typeof platformStylePatterns.$inferSelect;

export type PlatformStyleWithExamples = StoredPlatformStylePattern & {
  examplePosts?: Array<{
    id: string;
    notes: string | null;
    postUrl: string | null;
    likeCount: number | null;
    repostCount: number | null;
    replyCount: number | null;
  }>;
};

/**
 * Get all stored platform style patterns
 */
export async function getAllPlatformStyles(): Promise<StoredPlatformStylePattern[]> {
  return db
    .select()
    .from(platformStylePatterns)
    .orderBy(platformStylePatterns.platform);
}

/**
 * Get style pattern for a specific platform
 */
export async function getPlatformStyle(
  platform: Platform
): Promise<PlatformStyleWithExamples | null> {
  const [pattern] = await db
    .select()
    .from(platformStylePatterns)
    .where(eq(platformStylePatterns.platform, platform))
    .limit(1);

  if (!pattern) return null;

  // Fetch example posts if we have IDs
  let examplePosts: PlatformStyleWithExamples['examplePosts'] = [];
  if (pattern.examplePostIds) {
    try {
      const postIds = JSON.parse(pattern.examplePostIds) as string[];
      if (postIds.length > 0) {
        examplePosts = await db
          .select({
            id: socialShares.id,
            notes: socialShares.notes,
            postUrl: socialShares.postUrl,
            likeCount: socialShares.likeCount,
            repostCount: socialShares.repostCount,
            replyCount: socialShares.replyCount,
          })
          .from(socialShares)
          .where(sql`${socialShares.id} IN (${sql.join(postIds.map(id => sql`${id}::uuid`), sql`, `)})`);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return { ...pattern, examplePosts };
}

/**
 * Get posts for analysis (with notes field populated)
 */
export async function getPostsForAnalysis(platform: Platform): Promise<PostForAnalysis[]> {
  const posts = await db
    .select({
      id: socialShares.id,
      platform: socialShares.platform,
      notes: socialShares.notes,
      likeCount: socialShares.likeCount,
      repostCount: socialShares.repostCount,
      replyCount: socialShares.replyCount,
    })
    .from(socialShares)
    .where(
      and(
        eq(socialShares.platform, platform),
        isNotNull(socialShares.notes),
        // Exclude discovered mentions - only analyze our own posts
        sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`
      )
    );

  return posts as PostForAnalysis[];
}

/**
 * Run analysis for a platform and store results
 */
export async function analyzeAndStorePlatformStyle(
  platform: Platform
): Promise<StoredPlatformStylePattern> {
  // Get posts for analysis
  const posts = await getPostsForAnalysis(platform);

  // Run the analyzer
  const patterns = analyzePatterns(posts, platform);

  // Convert to database format
  const dbData = {
    platform,
    avgLength: patterns.lengthStats.avg,
    minLength: patterns.lengthStats.min,
    maxLength: patterns.lengthStats.max,
    medianLength: patterns.lengthStats.median,
    weightedAvgLength: patterns.lengthStats.weightedAvg,
    hashtagUsagePct: patterns.hashtagPatterns.usagePct,
    hashtagAvgCount: patterns.hashtagPatterns.avgCount,
    commonHashtags: JSON.stringify(patterns.hashtagPatterns.commonTags),
    emojiUsagePct: patterns.emojiPatterns.usagePct,
    emojiAvgCount: patterns.emojiPatterns.avgCount,
    commonEmojis: JSON.stringify(patterns.emojiPatterns.commonEmojis),
    emojiPositions: JSON.stringify(patterns.emojiPatterns.positions),
    mentionUsagePct: patterns.mentionPatterns.usagePct,
    mentionAvgCount: patterns.mentionPatterns.avgCount,
    mentionTypes: JSON.stringify(patterns.mentionPatterns.types),
    engagementThreshold: patterns.engagementThreshold,
    topPerformerTraits: patterns.topPerformerTraits
      ? JSON.stringify(patterns.topPerformerTraits)
      : null,
    topPerformerCount: patterns.topPerformerCount,
    examplePostIds: JSON.stringify(patterns.examplePostIds),
    postsAnalyzed: patterns.postsAnalyzed,
    lastAnalyzedAt: new Date(),
    updatedAt: new Date(),
  };

  // Upsert - update if exists, insert if not
  const [existing] = await db
    .select({ id: platformStylePatterns.id })
    .from(platformStylePatterns)
    .where(eq(platformStylePatterns.platform, platform))
    .limit(1);

  if (existing) {
    const [result] = await db
      .update(platformStylePatterns)
      .set(dbData)
      .where(eq(platformStylePatterns.platform, platform))
      .returning();
    return result;
  } else {
    const [result] = await db
      .insert(platformStylePatterns)
      .values({
        ...dbData,
        createdAt: new Date(),
      })
      .returning();
    return result;
  }
}

/**
 * Get summary stats for all platforms
 */
export async function getPlatformStyleSummary(): Promise<{
  platforms: Array<{
    platform: Platform;
    postsAnalyzed: number;
    lastAnalyzedAt: Date | null;
    avgLength: number | null;
  }>;
  totalPostsWithNotes: number;
}> {
  // Get stored patterns
  const patterns = await db
    .select({
      platform: platformStylePatterns.platform,
      postsAnalyzed: platformStylePatterns.postsAnalyzed,
      lastAnalyzedAt: platformStylePatterns.lastAnalyzedAt,
      avgLength: platformStylePatterns.avgLength,
    })
    .from(platformStylePatterns);

  // Count total posts with notes
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(socialShares)
    .where(
      and(
        isNotNull(socialShares.notes),
        sql`${socialShares.status} NOT IN ('discovered', 'acknowledged')`
      )
    );

  return {
    platforms: patterns.map(p => ({
      platform: p.platform as Platform,
      postsAnalyzed: p.postsAnalyzed,
      lastAnalyzedAt: p.lastAnalyzedAt,
      avgLength: p.avgLength,
    })),
    totalPostsWithNotes: countResult?.count || 0,
  };
}

/**
 * Delete style pattern for a platform
 */
export async function deletePlatformStyle(platform: Platform): Promise<void> {
  await db
    .delete(platformStylePatterns)
    .where(eq(platformStylePatterns.platform, platform));
}

/**
 * Convert stored pattern to the analyzer's format for display
 */
export function parseStoredPattern(
  stored: StoredPlatformStylePattern
): PlatformStylePattern {
  return {
    platform: stored.platform as Platform,
    lengthStats: {
      avg: stored.avgLength || 0,
      min: stored.minLength || 0,
      max: stored.maxLength || 0,
      median: stored.medianLength || 0,
      weightedAvg: stored.weightedAvgLength,
    },
    hashtagPatterns: {
      usagePct: stored.hashtagUsagePct || 0,
      avgCount: stored.hashtagAvgCount || 0,
      commonTags: stored.commonHashtags ? JSON.parse(stored.commonHashtags) : [],
    },
    emojiPatterns: {
      usagePct: stored.emojiUsagePct || 0,
      avgCount: stored.emojiAvgCount || 0,
      commonEmojis: stored.commonEmojis ? JSON.parse(stored.commonEmojis) : [],
      positions: stored.emojiPositions
        ? JSON.parse(stored.emojiPositions)
        : { start: 0, middle: 0, end: 0 },
    },
    mentionPatterns: {
      usagePct: stored.mentionUsagePct || 0,
      avgCount: stored.mentionAvgCount || 0,
      types: stored.mentionTypes
        ? JSON.parse(stored.mentionTypes)
        : { speaker: 0, org: 0, other: 0 },
    },
    engagementThreshold: stored.engagementThreshold,
    topPerformerTraits: stored.topPerformerTraits
      ? JSON.parse(stored.topPerformerTraits)
      : null,
    topPerformerCount: stored.topPerformerCount || 0,
    examplePostIds: stored.examplePostIds ? JSON.parse(stored.examplePostIds) : [],
    postsAnalyzed: stored.postsAnalyzed,
  };
}

/**
 * Update AI insights cache for a platform
 */
export async function updatePlatformStyleAiCache(
  platform: Platform,
  cacheJson: string
): Promise<void> {
  await db
    .update(platformStylePatterns)
    .set({
      aiInsightsCache: cacheJson,
      aiAnalyzedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(platformStylePatterns.platform, platform));
}

/**
 * Get AI insights cache for a platform
 */
export async function getAiInsightsCache(
  platform: Platform
): Promise<{ cache: string | null; analyzedAt: Date | null } | null> {
  const [result] = await db
    .select({
      cache: platformStylePatterns.aiInsightsCache,
      analyzedAt: platformStylePatterns.aiAnalyzedAt,
    })
    .from(platformStylePatterns)
    .where(eq(platformStylePatterns.platform, platform))
    .limit(1);

  return result || null;
}

/**
 * Get platforms that are stale (need re-analysis)
 * Stale = 5+ new posts since last analysis OR 7+ days since analysis
 */
export async function getStalePlatforms(): Promise<Array<{
  platform: Platform;
  postsAnalyzed: number;
  currentPostCount: number;
  daysSinceAnalysis: number;
}>> {
  const patterns = await getAllPlatformStyles();
  const result: Array<{
    platform: Platform;
    postsAnalyzed: number;
    currentPostCount: number;
    daysSinceAnalysis: number;
  }> = [];

  for (const pattern of patterns) {
    const posts = await getPostsForAnalysis(pattern.platform as Platform);
    const currentPostCount = posts.length;
    const daysSinceAnalysis = pattern.lastAnalyzedAt
      ? Math.floor((Date.now() - pattern.lastAnalyzedAt.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    if (currentPostCount - pattern.postsAnalyzed >= 5 || daysSinceAnalysis >= 7) {
      result.push({
        platform: pattern.platform as Platform,
        postsAnalyzed: pattern.postsAnalyzed,
        currentPostCount,
        daysSinceAnalysis,
      });
    }
  }

  return result;
}
