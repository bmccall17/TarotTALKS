/**
 * Platform Style AI Service
 *
 * AI-enhanced analysis and draft generation for platform-specific messaging patterns.
 * Uses Gemini 2.0 Flash for cost-effective inference.
 */

import { generateWithGemini, type ApiCallContext } from './gemini';
import type { Platform, PlatformStylePattern, PostForAnalysis } from './platform-style-analyzer';
import { extractHashtags, extractEmojis, extractMentions } from './platform-style-analyzer';

// ============================================================================
// Types
// ============================================================================

export type ToneAnalysis = {
  primaryTone: string;          // e.g., "conversational", "professional"
  secondaryTones: string[];
  formalityScore: number;       // 1-5, 1=casual, 5=formal
  confidence: number;           // 0-100
};

export type StructuralPattern = {
  openingPatterns: string[];    // e.g., "Card name first", "Emoji lead-in"
  closingPatterns: string[];    // e.g., "Call-to-action", "Hashtag cluster"
  contentOrder: string[];       // e.g., ["card_name", "speaker_tag", "talk_title"]
  typicalStructure: string;     // Human-readable summary
};

export type SentimentProfile = {
  overallSentiment: 'positive' | 'neutral' | 'mixed';
  emotionalRange: string[];     // e.g., ["inspirational", "curious", "warm"]
  avoidedTones: string[];       // e.g., ["negative", "sarcastic"]
};

export type AIStyleInsights = {
  platform: Platform;
  tone: ToneAnalysis;
  structure: StructuralPattern;
  sentiment: SentimentProfile;
  voiceFingerprint: string;     // 2-3 sentence summary
  writingTips: string[];        // 3-5 actionable tips
  generatedAt: string;          // ISO timestamp
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type DraftGenerationInput = {
  platform: Platform;
  cardName?: string;
  cardSlug?: string;
  talkTitle?: string;
  speakerName?: string;
  speakerHandle?: string;       // Platform-specific handle
  customContext?: string;       // User's additional notes
};

export type GeneratedDraft = {
  draft: string;
  characterCount: number;
  complianceIndicators: StyleComplianceIndicator[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type StyleComplianceIndicator = {
  metric: 'length' | 'hashtags' | 'emojis' | 'mentions' | 'tone';
  status: 'compliant' | 'warning' | 'deviation';
  message: string;
  suggestion?: string;
};

export type CachedInsight = {
  insights: AIStyleInsights;
  postsAnalyzedHash: string;    // Hash of post IDs
  expiresAt: string;            // ISO timestamp
};

// ============================================================================
// Constants
// ============================================================================

const INSIGHTS_CACHE_TTL_HOURS = 168; // 7 days
const MAX_POSTS_FOR_ANALYSIS = 20;    // Limit tokens in prompt
const MAX_POST_LENGTH_IN_PROMPT = 300; // Truncate long posts

// Platform character limits
const PLATFORM_LIMITS: Record<Platform, number> = {
  x: 280,
  bluesky: 300,
  threads: 500,
  linkedin: 3000,
  instagram: 2200,
  other: 280,
};

// ============================================================================
// Insight Analysis Functions
// ============================================================================

/**
 * Generate AI-enhanced style insights for a platform
 */
export async function analyzeStyleWithAI(
  posts: PostForAnalysis[],
  platform: Platform,
  statisticalPatterns: PlatformStylePattern,
  context?: ApiCallContext
): Promise<AIStyleInsights | { error: string }> {
  // Filter and limit posts
  const samplePosts = posts
    .filter(p => p.notes && p.notes.trim().length > 0)
    .slice(0, MAX_POSTS_FOR_ANALYSIS);

  if (samplePosts.length < 3) {
    return { error: 'Need at least 3 posts for meaningful AI analysis' };
  }

  // Prepare posts for prompt
  const postsForPrompt = samplePosts.map((p, i) => {
    const text = p.notes!.slice(0, MAX_POST_LENGTH_IN_PROMPT);
    const truncated = p.notes!.length > MAX_POST_LENGTH_IN_PROMPT ? '...' : '';
    return `POST ${i + 1}:\n${text}${truncated}`;
  }).join('\n\n');

  const prompt = buildInsightsPrompt(platform, postsForPrompt, statisticalPatterns);

  const result = await generateWithGemini(prompt, 3, {
    ...context,
    source: 'platform_style_ai_insights'
  });

  if (!result.success) {
    return { error: result.error || 'Failed to analyze style' };
  }

  try {
    const parsed = parseInsightsResponse(result.text, platform);
    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      costUsd: result.costUsd || 0,
    };
  } catch (e) {
    console.error('Failed to parse AI insights:', e, result.text);
    return { error: 'Failed to parse AI response' };
  }
}

function buildInsightsPrompt(
  platform: Platform,
  postsText: string,
  stats: PlatformStylePattern
): string {
  return `You are a social media style analyst. Analyze these ${platform.toUpperCase()} posts to extract voice and style patterns.

## STATISTICAL CONTEXT (already computed)
- Average post length: ${stats.lengthStats.avg} characters
- Hashtag usage: ${stats.hashtagPatterns.usagePct}% of posts
- Emoji usage: ${stats.emojiPatterns.usagePct}% of posts
- Mention usage: ${stats.mentionPatterns.usagePct}% of posts

## POSTS TO ANALYZE
${postsText}

## YOUR TASK
Analyze the tone, structure, and voice patterns. Return ONLY valid JSON:

\`\`\`json
{
  "tone": {
    "primaryTone": "string (e.g., conversational, professional, enthusiastic)",
    "secondaryTones": ["string"],
    "formalityScore": number (1-5, 1=casual, 5=formal),
    "confidence": number (0-100)
  },
  "structure": {
    "openingPatterns": ["how posts typically start"],
    "closingPatterns": ["how posts typically end"],
    "contentOrder": ["card_name", "speaker_tag", etc - sequence of elements],
    "typicalStructure": "2-sentence summary of post structure"
  },
  "sentiment": {
    "overallSentiment": "positive" | "neutral" | "mixed",
    "emotionalRange": ["emotions conveyed"],
    "avoidedTones": ["tones never used"]
  },
  "voiceFingerprint": "2-3 sentences capturing the unique voice",
  "writingTips": ["3-5 actionable tips to match this style"]
}
\`\`\``;
}

function parseInsightsResponse(
  text: string,
  platform: Platform
): Omit<AIStyleInsights, 'generatedAt' | 'inputTokens' | 'outputTokens' | 'costUsd'> {
  // Extract JSON from markdown code block or raw text
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);

  // Validate required fields
  if (!data.tone || !data.structure || !data.sentiment) {
    throw new Error('Missing required fields in response');
  }

  return {
    platform,
    tone: {
      primaryTone: data.tone.primaryTone || 'conversational',
      secondaryTones: data.tone.secondaryTones || [],
      formalityScore: data.tone.formalityScore || 3,
      confidence: data.tone.confidence || 50,
    },
    structure: {
      openingPatterns: data.structure.openingPatterns || [],
      closingPatterns: data.structure.closingPatterns || [],
      contentOrder: data.structure.contentOrder || [],
      typicalStructure: data.structure.typicalStructure || '',
    },
    sentiment: {
      overallSentiment: data.sentiment.overallSentiment || 'neutral',
      emotionalRange: data.sentiment.emotionalRange || [],
      avoidedTones: data.sentiment.avoidedTones || [],
    },
    voiceFingerprint: data.voiceFingerprint || '',
    writingTips: data.writingTips || [],
  };
}

// ============================================================================
// Draft Generation Functions
// ============================================================================

/**
 * Generate a platform-specific post draft matching learned style
 */
export async function generateDraft(
  input: DraftGenerationInput,
  stylePattern: PlatformStylePattern,
  aiInsights?: AIStyleInsights | null,
  context?: ApiCallContext
): Promise<GeneratedDraft | { error: string }> {
  const prompt = buildDraftPrompt(input, stylePattern, aiInsights);

  const result = await generateWithGemini(prompt, 3, {
    ...context,
    source: 'platform_style_draft_generation'
  });

  if (!result.success) {
    return { error: result.error || 'Failed to generate draft' };
  }

  try {
    const parsed = parseDraftResponse(result.text, stylePattern);
    return {
      ...parsed,
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      costUsd: result.costUsd || 0,
    };
  } catch (e) {
    console.error('Failed to parse draft response:', e, result.text);
    return { error: 'Failed to parse AI response' };
  }
}

function buildDraftPrompt(
  input: DraftGenerationInput,
  stats: PlatformStylePattern,
  insights?: AIStyleInsights | null
): string {
  const platformName = input.platform.toUpperCase();
  const charLimit = PLATFORM_LIMITS[input.platform];

  // Build content section
  const contentParts: string[] = [];
  if (input.cardName) contentParts.push(`Card: ${input.cardName}`);
  if (input.talkTitle) contentParts.push(`Talk: "${input.talkTitle}"`);
  if (input.speakerName) contentParts.push(`Speaker: ${input.speakerName}`);
  if (input.speakerHandle) contentParts.push(`Handle: @${input.speakerHandle.replace('@', '')}`);
  if (input.customContext) contentParts.push(`Context: ${input.customContext}`);
  if (input.cardSlug) contentParts.push(`URL: https://tarottalks.app/cards/${input.cardSlug}`);

  // Build style guide
  const styleGuideParts: string[] = [
    `Target length: ${stats.lengthStats.avg} characters (max: ${charLimit})`,
  ];

  if (stats.hashtagPatterns.usagePct > 50) {
    styleGuideParts.push(`Use ${Math.round(stats.hashtagPatterns.avgCount)} hashtags`);
    if (stats.hashtagPatterns.commonTags.length > 0) {
      styleGuideParts.push(`Common hashtags: ${stats.hashtagPatterns.commonTags.slice(0, 5).join(', ')}`);
    }
  } else if (stats.hashtagPatterns.usagePct < 20) {
    styleGuideParts.push('Avoid hashtags (rarely used on this platform)');
  }

  if (stats.emojiPatterns.usagePct > 50) {
    const position = stats.emojiPatterns.positions.end > 0.4 ? 'end' :
                     stats.emojiPatterns.positions.start > 0.4 ? 'start' : 'middle';
    styleGuideParts.push(`Include ${Math.round(stats.emojiPatterns.avgCount)} emoji(s), typically at ${position}`);
  }

  if (stats.mentionPatterns.usagePct > 50 && input.speakerHandle) {
    styleGuideParts.push('Include speaker mention');
  }

  // Add AI insights if available
  if (insights) {
    styleGuideParts.push(`Tone: ${insights.tone.primaryTone}`);
    if (insights.voiceFingerprint) {
      styleGuideParts.push(`Voice: ${insights.voiceFingerprint.slice(0, 200)}`);
    }
    if (insights.structure.typicalStructure) {
      styleGuideParts.push(`Structure: ${insights.structure.typicalStructure}`);
    }
  }

  return `You are a social media copywriter for TarotTALKS, matching the established voice for ${platformName}.

## CONTENT TO SHARE
${contentParts.join('\n')}

## STYLE GUIDE
${styleGuideParts.join('\n')}

## YOUR TASK
Write ONE social media post for ${platformName} that:
1. Promotes this card/talk combination
2. Matches the style guide exactly
3. Sounds authentic to the established voice
4. Stays within ${charLimit} characters

Return ONLY valid JSON:
\`\`\`json
{
  "draft": "your post text here",
  "characterCount": number
}
\`\`\``;
}

function parseDraftResponse(
  text: string,
  stats: PlatformStylePattern
): Omit<GeneratedDraft, 'inputTokens' | 'outputTokens' | 'costUsd'> {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);

  if (!data.draft) {
    throw new Error('No draft field in response');
  }

  const draft = data.draft.trim();
  const characterCount = draft.length;
  const complianceIndicators = calculateCompliance(draft, stats);

  return {
    draft,
    characterCount,
    complianceIndicators,
  };
}

/**
 * Calculate style compliance indicators for a draft
 */
export function calculateCompliance(
  draft: string,
  stats: PlatformStylePattern
): StyleComplianceIndicator[] {
  const indicators: StyleComplianceIndicator[] = [];
  const length = draft.length;

  // Length compliance
  const lengthDiff = Math.abs(length - stats.lengthStats.avg);
  const lengthTolerance = stats.lengthStats.avg * 0.3; // 30% tolerance

  if (lengthDiff <= lengthTolerance) {
    indicators.push({
      metric: 'length',
      status: 'compliant',
      message: `Length (${length}) matches your typical ${stats.lengthStats.avg} chars`,
    });
  } else if (length < stats.lengthStats.min || length > stats.lengthStats.max) {
    indicators.push({
      metric: 'length',
      status: 'deviation',
      message: length < stats.lengthStats.min
        ? `At ${length} chars, this is shorter than your minimum (${stats.lengthStats.min})`
        : `At ${length} chars, this exceeds your maximum (${stats.lengthStats.max})`,
      suggestion: `Target ${stats.lengthStats.avg} characters`,
    });
  } else {
    indicators.push({
      metric: 'length',
      status: 'warning',
      message: `Length (${length}) is outside your typical range (~${stats.lengthStats.avg})`,
    });
  }

  // Hashtag compliance
  const hashtagCount = extractHashtags(draft).length;
  if (stats.hashtagPatterns.usagePct < 20) {
    if (hashtagCount === 0) {
      indicators.push({
        metric: 'hashtags',
        status: 'compliant',
        message: 'No hashtags (matches your style)',
      });
    } else {
      indicators.push({
        metric: 'hashtags',
        status: 'warning',
        message: `${hashtagCount} hashtag(s) - you rarely use them on this platform`,
        suggestion: 'Consider removing hashtags',
      });
    }
  } else if (stats.hashtagPatterns.usagePct > 50) {
    if (hashtagCount >= 1) {
      indicators.push({
        metric: 'hashtags',
        status: 'compliant',
        message: `${hashtagCount} hashtag(s) (you typically use ${stats.hashtagPatterns.avgCount.toFixed(1)})`,
      });
    } else {
      indicators.push({
        metric: 'hashtags',
        status: 'warning',
        message: 'Missing hashtags - you usually include them',
        suggestion: `Add ${Math.round(stats.hashtagPatterns.avgCount)} hashtag(s)`,
      });
    }
  }

  // Emoji compliance
  const emojiCount = extractEmojis(draft).length;
  if (stats.emojiPatterns.usagePct > 50 && emojiCount === 0) {
    indicators.push({
      metric: 'emojis',
      status: 'warning',
      message: 'No emojis - you usually include them',
      suggestion: 'Add an emoji',
    });
  } else if (stats.emojiPatterns.usagePct < 20 && emojiCount > 0) {
    indicators.push({
      metric: 'emojis',
      status: 'warning',
      message: `${emojiCount} emoji(s) - you rarely use them on this platform`,
    });
  } else if (emojiCount > 0) {
    indicators.push({
      metric: 'emojis',
      status: 'compliant',
      message: `${emojiCount} emoji(s) matches your style`,
    });
  }

  // Mention compliance
  const mentionCount = extractMentions(draft).length;
  if (stats.mentionPatterns.usagePct > 50 && mentionCount === 0) {
    indicators.push({
      metric: 'mentions',
      status: 'warning',
      message: 'No mentions - you usually tag people',
      suggestion: 'Consider adding speaker mention',
    });
  } else if (mentionCount > 0) {
    indicators.push({
      metric: 'mentions',
      status: 'compliant',
      message: `${mentionCount} mention(s) included`,
    });
  }

  return indicators;
}

// ============================================================================
// Caching Utilities
// ============================================================================

/**
 * Generate a hash for cache invalidation based on analyzed posts
 */
export function generatePostsHash(posts: PostForAnalysis[]): string {
  const ids = posts.map(p => p.id).sort().join(',');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < ids.length; i++) {
    const char = ids.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if cached insights are still valid
 */
export function isCacheValid(
  cached: CachedInsight | null,
  currentPostsHash: string
): boolean {
  if (!cached) return false;

  // Check expiration
  const expiresAt = new Date(cached.expiresAt);
  if (expiresAt < new Date()) return false;

  // Check if posts changed
  if (cached.postsAnalyzedHash !== currentPostsHash) return false;

  return true;
}

/**
 * Create a cache entry
 */
export function createCacheEntry(
  insights: AIStyleInsights,
  postsHash: string
): CachedInsight {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INSIGHTS_CACHE_TTL_HOURS);

  return {
    insights,
    postsAnalyzedHash: postsHash,
    expiresAt: expiresAt.toISOString(),
  };
}

// ============================================================================
// Cost Estimation
// ============================================================================

/**
 * Estimate cost for an operation
 */
export function estimateOperationCost(operation: 'ai-insights' | 'generate-draft'): {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costRange: { min: number; max: number };
} {
  // Gemini 2.0 Flash pricing: $0.10/1M input, $0.40/1M output
  const INPUT_COST_PER_TOKEN = 0.10 / 1_000_000;
  const OUTPUT_COST_PER_TOKEN = 0.40 / 1_000_000;

  const estimates = {
    'ai-insights': { inputTokens: 2000, outputTokens: 800 },
    'generate-draft': { inputTokens: 1500, outputTokens: 400 },
  };

  const { inputTokens, outputTokens } = estimates[operation];
  const costUsd = (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN);

  return {
    inputTokens,
    outputTokens,
    costUsd,
    costRange: {
      min: costUsd * 0.5,
      max: costUsd * 2.0,
    },
  };
}
