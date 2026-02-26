/**
 * Content Assistant Service
 *
 * Core generation engine for Content Lab.
 * Builds prompts using brand config + platform style data + top performers,
 * generates weekly content calendars via Gemini in 2 steps (strategy + content).
 */

import { generateWithGemini, type ApiCallContext } from './gemini';
import { estimateOperationCost as estimatePlatformStyleCost } from './platform-style-ai';
import type { PlatformStylePattern } from './platform-style-analyzer';
import type { AIStyleInsights } from './platform-style-ai';
import type { BrandConfig } from '@/lib/db/queries/admin-content-assistant';

// ============================================================================
// Types
// ============================================================================

export type ContentType = 'authority' | 'story' | 'offer' | 'engagement';
export type Framework = '3_things' | 'hook_story_offer' | 'pas' | 'open_loop' | 'before_after' | 'aida';
type Platform = 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram' | 'other';

export type WeeklyMixItem = {
  dayOfWeek: number; // 0=Mon through 6=Sun
  contentType: ContentType;
  framework: Framework;
};

export const DEFAULT_WEEKLY_MIX: WeeklyMixItem[] = [
  { dayOfWeek: 0, contentType: 'authority', framework: '3_things' },
  { dayOfWeek: 1, contentType: 'story', framework: 'hook_story_offer' },
  { dayOfWeek: 2, contentType: 'engagement', framework: 'open_loop' },
  { dayOfWeek: 3, contentType: 'offer', framework: 'pas' },
  { dayOfWeek: 4, contentType: 'authority', framework: 'before_after' },
  { dayOfWeek: 5, contentType: 'story', framework: 'hook_story_offer' },
  { dayOfWeek: 6, contentType: 'engagement', framework: 'open_loop' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  authority: 'Authority',
  story: 'Story',
  offer: 'Offer',
  engagement: 'Engagement',
};

const FRAMEWORK_LABELS: Record<Framework, string> = {
  '3_things': '3 Things I Know About [X]',
  hook_story_offer: 'Hook-Story-Offer',
  pas: 'Problem-Agitate-Solve',
  open_loop: 'Open Loop (Question/Poll)',
  before_after: 'Before-After',
  aida: 'AIDA (Attention-Interest-Desire-Action)',
};

const PLATFORM_LIMITS: Record<Platform, number> = {
  x: 280,
  bluesky: 300,
  threads: 500,
  linkedin: 3000,
  instagram: 2200,
  other: 280,
};

export type StrategyItem = {
  dayOfWeek: number;
  dayName: string;
  contentType: ContentType;
  framework: Framework;
  topic: string;
  hookIdea: string;
  cardName?: string;
  cardSlug?: string;
  cardId?: string;
  talkTitle?: string;
  talkId?: string;
  speakerName?: string;
};

export type StrategyResult = {
  items: StrategyItem[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type GeneratedPost = {
  dayOfWeek: number;
  contentType: ContentType;
  framework: Framework;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  cardId?: string;
  talkId?: string;
};

export type ContentResult = {
  posts: GeneratedPost[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type VoiceContext = {
  brandConfig: BrandConfig;
  stylePattern?: PlatformStylePattern | null;
  aiInsights?: AIStyleInsights | null;
  topPerformers?: Array<{ notes: string; engagement: number }>;
};

export type ContentCards = Array<{
  id: string;
  name: string;
  slug: string;
  keywords: string;
  summary: string;
}>;

export type ContentTalks = Array<{
  id: string;
  title: string;
  slug: string;
  speakerName: string;
  description: string | null;
}>;

// ============================================================================
// Step 1: Generate Weekly Strategy
// ============================================================================

/**
 * Generate a 7-day content strategy (topics, hooks, card/talk assignments)
 */
export async function generateWeekStrategy(
  platform: Platform,
  weekStartDate: string,
  voice: VoiceContext,
  contentCards: ContentCards,
  contentTalks: ContentTalks,
  context?: ApiCallContext
): Promise<StrategyResult | { error: string }> {
  const prompt = buildStrategyPrompt(platform, weekStartDate, voice, contentCards, contentTalks);

  const result = await generateWithGemini(prompt, 3, {
    ...context,
    source: 'content_assistant_strategy',
  }, {
    maxOutputTokens: 2048,
    temperature: 0.8,
  });

  if (!result.success) {
    return { error: result.error || 'Failed to generate strategy' };
  }

  try {
    const parsed = parseStrategyResponse(result.text, contentCards, contentTalks);
    return {
      items: parsed,
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      costUsd: result.costUsd || 0,
    };
  } catch (e) {
    console.error('Failed to parse strategy response:', e, result.text);
    return { error: 'Failed to parse AI strategy response' };
  }
}

function buildStrategyPrompt(
  platform: Platform,
  weekStartDate: string,
  voice: VoiceContext,
  contentCards: ContentCards,
  contentTalks: ContentTalks
): string {
  const { brandConfig, stylePattern, aiInsights, topPerformers } = voice;
  const charLimit = PLATFORM_LIMITS[platform];

  // Build voice context
  const voiceParts: string[] = [];
  if (brandConfig.offerDescription) {
    voiceParts.push(`Offer: ${brandConfig.offerDescription}`);
  }
  if (brandConfig.audiencePersona) {
    voiceParts.push(`Target audience: ${brandConfig.audiencePersona}`);
  }
  if (brandConfig.keyMessagingPillars) {
    try {
      const pillars = JSON.parse(brandConfig.keyMessagingPillars);
      if (pillars.length > 0) voiceParts.push(`Key messaging pillars: ${pillars.join(', ')}`);
    } catch { /* ignore */ }
  }
  if (brandConfig.brandToneDescription) {
    voiceParts.push(`Brand tone: ${brandConfig.brandToneDescription}`);
  }

  // Platform style context
  if (stylePattern) {
    voiceParts.push(`Typical post length: ${stylePattern.lengthStats.avg} chars (max: ${charLimit})`);
    if (stylePattern.hashtagPatterns.usagePct > 30) {
      voiceParts.push(`Uses hashtags ~${Math.round(stylePattern.hashtagPatterns.avgCount)} per post`);
    }
  } else {
    voiceParts.push(`Platform character limit: ${charLimit}`);
  }

  // AI voice fingerprint
  if (aiInsights?.voiceFingerprint) {
    voiceParts.push(`Voice fingerprint: ${aiInsights.voiceFingerprint}`);
  }

  // Top performers as exemplars
  let exemplarSection = '';
  if (topPerformers && topPerformers.length > 0) {
    exemplarSection = `\n## TOP-PERFORMING POSTS (match this voice)\n${topPerformers.map((p, i) =>
      `Example ${i + 1} (${p.engagement} engagements):\n${p.notes.slice(0, 300)}`
    ).join('\n\n')}`;
  }

  // Available content
  const cardsSection = contentCards.map(c =>
    `- ${c.name} (${c.slug}): ${c.summary.slice(0, 100)}`
  ).join('\n');

  const talksSection = contentTalks.map(t =>
    `- "${t.title}" by ${t.speakerName}: ${(t.description || '').slice(0, 100)}`
  ).join('\n');

  // Weekly mix
  const mixSection = DEFAULT_WEEKLY_MIX.map(m =>
    `${DAY_NAMES[m.dayOfWeek]}: ${CONTENT_TYPE_LABELS[m.contentType]} — ${FRAMEWORK_LABELS[m.framework]}`
  ).join('\n');

  // CTA options
  let ctaSection = '';
  if (brandConfig.ctaOptions) {
    try {
      const ctas = JSON.parse(brandConfig.ctaOptions);
      if (ctas.length > 0) ctaSection = `\n## AVAILABLE CTAs\n${ctas.join('\n')}`;
    } catch { /* ignore */ }
  }

  return `You are a social media strategist for TarotTALKS, planning a week of ${platform.toUpperCase()} content.

## BRAND VOICE
${voiceParts.join('\n')}
${exemplarSection}

## WEEKLY CONTENT MIX
${mixSection}

## AVAILABLE TAROT CARDS
${cardsSection}

## AVAILABLE TED TALKS
${talksSection}
${ctaSection}

## YOUR TASK
Plan 7 days of content for the week starting ${weekStartDate}. For each day:
1. Pick a topic/angle that fits the content type and framework
2. Assign a relevant tarot card AND/OR TED talk when it fits naturally
3. Write a brief hook idea (the opening line concept)
4. Ensure variety across the week — don't repeat themes

Return ONLY valid JSON:
\`\`\`json
[
  {
    "dayOfWeek": 0,
    "dayName": "Monday",
    "contentType": "authority",
    "framework": "3_things",
    "topic": "brief topic description",
    "hookIdea": "opening line concept",
    "cardName": "The Tower",
    "cardSlug": "the-tower",
    "talkTitle": "Talk title if relevant",
    "speakerName": "Speaker if relevant"
  }
]
\`\`\`

Return exactly 7 items, one per day (dayOfWeek 0-6).`;
}

function parseStrategyResponse(
  text: string,
  contentCards: ContentCards,
  contentTalks: ContentTalks
): StrategyItem[] {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error('No JSON found in strategy response');

  const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  if (!Array.isArray(data)) throw new Error('Expected JSON array');

  // Map card/talk names back to IDs
  const cardsBySlug = Object.fromEntries(contentCards.map(c => [c.slug, c]));
  const cardsByName = Object.fromEntries(contentCards.map(c => [c.name.toLowerCase(), c]));
  const talksByTitle = Object.fromEntries(contentTalks.map(t => [t.title.toLowerCase(), t]));

  return data.map((item: Record<string, unknown>) => {
    // Resolve card ID
    let cardId: string | undefined;
    const cardSlug = item.cardSlug as string | undefined;
    const cardName = item.cardName as string | undefined;
    if (cardSlug && cardsBySlug[cardSlug]) {
      cardId = cardsBySlug[cardSlug].id;
    } else if (cardName && cardsByName[cardName.toLowerCase()]) {
      cardId = cardsByName[cardName.toLowerCase()].id;
    }

    // Resolve talk ID
    let talkId: string | undefined;
    const talkTitle = item.talkTitle as string | undefined;
    if (talkTitle && talksByTitle[talkTitle.toLowerCase()]) {
      talkId = talksByTitle[talkTitle.toLowerCase()].id;
    }

    return {
      dayOfWeek: item.dayOfWeek as number,
      dayName: item.dayName as string || DAY_NAMES[item.dayOfWeek as number] || 'Unknown',
      contentType: (item.contentType as ContentType) || DEFAULT_WEEKLY_MIX[item.dayOfWeek as number]?.contentType || 'authority',
      framework: (item.framework as Framework) || DEFAULT_WEEKLY_MIX[item.dayOfWeek as number]?.framework || '3_things',
      topic: item.topic as string || '',
      hookIdea: item.hookIdea as string || '',
      cardName: cardName,
      cardSlug: cardSlug,
      cardId,
      talkTitle: talkTitle,
      talkId,
      speakerName: item.speakerName as string | undefined,
    };
  });
}

// ============================================================================
// Step 2: Generate Post Content
// ============================================================================

/**
 * Generate full post bodies from a strategy
 */
export async function generateWeekContent(
  platform: Platform,
  strategy: StrategyItem[],
  voice: VoiceContext,
  context?: ApiCallContext
): Promise<ContentResult | { error: string }> {
  const prompt = buildContentPrompt(platform, strategy, voice);

  const result = await generateWithGemini(prompt, 3, {
    ...context,
    source: 'content_assistant_content',
  }, {
    maxOutputTokens: 4096,
    temperature: 0.7,
  });

  if (!result.success) {
    return { error: result.error || 'Failed to generate content' };
  }

  try {
    const parsed = parseContentResponse(result.text, strategy);
    return {
      posts: parsed,
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      costUsd: result.costUsd || 0,
    };
  } catch (e) {
    console.error('Failed to parse content response:', e, result.text);
    return { error: 'Failed to parse AI content response' };
  }
}

function buildContentPrompt(
  platform: Platform,
  strategy: StrategyItem[],
  voice: VoiceContext
): string {
  const { brandConfig, stylePattern, aiInsights, topPerformers } = voice;
  const charLimit = PLATFORM_LIMITS[platform];

  // Voice context (condensed for step 2)
  const voiceParts: string[] = [];
  if (brandConfig.brandToneDescription) voiceParts.push(`Tone: ${brandConfig.brandToneDescription}`);
  if (aiInsights?.voiceFingerprint) voiceParts.push(`Voice: ${aiInsights.voiceFingerprint}`);
  if (stylePattern) {
    voiceParts.push(`Target length: ~${stylePattern.lengthStats.avg} chars (max ${charLimit})`);
    if (stylePattern.hashtagPatterns.commonTags.length > 0) {
      voiceParts.push(`Common hashtags: ${stylePattern.hashtagPatterns.commonTags.slice(0, 5).join(', ')}`);
    }
  } else {
    voiceParts.push(`Character limit: ${charLimit}`);
  }

  // Top performer exemplars
  let exemplarSection = '';
  if (topPerformers && topPerformers.length > 0) {
    exemplarSection = `\n## VOICE EXEMPLARS\n${topPerformers.map((p, i) =>
      `Example ${i + 1}:\n${p.notes.slice(0, 250)}`
    ).join('\n\n')}`;
  }

  // CTA options
  let ctaSection = '';
  if (brandConfig.ctaOptions) {
    try {
      const ctas = JSON.parse(brandConfig.ctaOptions);
      if (ctas.length > 0) ctaSection = `\nAvailable CTAs to rotate: ${ctas.join(' | ')}`;
    } catch { /* ignore */ }
  }

  // Strategy items
  const strategySection = strategy.map(s => {
    const parts = [
      `Day ${s.dayOfWeek} (${s.dayName}): ${CONTENT_TYPE_LABELS[s.contentType]}`,
      `Framework: ${FRAMEWORK_LABELS[s.framework]}`,
      `Topic: ${s.topic}`,
      `Hook idea: ${s.hookIdea}`,
    ];
    if (s.cardName) parts.push(`Card: ${s.cardName}`);
    if (s.talkTitle) parts.push(`Talk: "${s.talkTitle}" by ${s.speakerName || 'unknown'}`);
    return parts.join('\n  ');
  }).join('\n\n');

  // Framework instructions
  const frameworkGuide = `
## FRAMEWORK GUIDE
- **3 Things**: "3 things I know about [X]:" followed by 3 punchy points
- **Hook-Story-Offer**: Attention-grabbing hook → brief personal story → link/CTA
- **PAS**: State the Problem → Agitate the pain → Solve with your offer
- **Open Loop**: Ask a provocative question or pose a "which would you choose?" scenario
- **Before-After**: Paint the "before" state → show the "after" transformation`;

  return `You are a social media copywriter for TarotTALKS writing ${platform.toUpperCase()} posts.

## VOICE & STYLE
${voiceParts.join('\n')}
${exemplarSection}
${ctaSection}
${frameworkGuide}

## CONTENT PLAN
${strategySection}

## YOUR TASK
Write the full post for each of the 7 days. For each post:
1. Write a strong hook (opening 1-2 lines)
2. Write the body following the assigned framework
3. Include a CTA
4. Suggest 2-4 relevant hashtags
5. Stay within ${charLimit} characters total

The URL for any card is: https://tarottalks.app/cards/[slug]
The main site URL is: https://tarottalks.app

Return ONLY valid JSON:
\`\`\`json
[
  {
    "dayOfWeek": 0,
    "hook": "opening line(s)",
    "body": "full post text including the hook",
    "cta": "call to action line",
    "hashtags": ["tag1", "tag2"]
  }
]
\`\`\`

Return exactly 7 items.`;
}

function parseContentResponse(
  text: string,
  strategy: StrategyItem[]
): GeneratedPost[] {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error('No JSON found in content response');

  const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  if (!Array.isArray(data)) throw new Error('Expected JSON array');

  return data.map((item: Record<string, unknown>, i: number) => {
    const dayOfWeek = (item.dayOfWeek as number) ?? i;
    const strategyItem = strategy.find(s => s.dayOfWeek === dayOfWeek) || strategy[i];

    return {
      dayOfWeek,
      contentType: strategyItem?.contentType || 'authority',
      framework: strategyItem?.framework || '3_things',
      hook: (item.hook as string) || '',
      body: (item.body as string) || '',
      cta: (item.cta as string) || '',
      hashtags: Array.isArray(item.hashtags) ? item.hashtags as string[] : [],
      cardId: strategyItem?.cardId,
      talkId: strategyItem?.talkId,
    };
  });
}

// ============================================================================
// Single Post Regeneration
// ============================================================================

/**
 * Regenerate a single post with optional custom instructions
 */
export async function regenerateSinglePost(
  platform: Platform,
  contentType: ContentType,
  framework: Framework,
  voice: VoiceContext,
  customInstructions?: string,
  cardName?: string,
  talkTitle?: string,
  context?: ApiCallContext
): Promise<GeneratedPost | { error: string }> {
  const charLimit = PLATFORM_LIMITS[platform];

  const voiceParts: string[] = [];
  if (voice.brandConfig.brandToneDescription) voiceParts.push(`Tone: ${voice.brandConfig.brandToneDescription}`);
  if (voice.aiInsights?.voiceFingerprint) voiceParts.push(`Voice: ${voice.aiInsights.voiceFingerprint}`);
  if (voice.stylePattern) {
    voiceParts.push(`Target length: ~${voice.stylePattern.lengthStats.avg} chars (max ${charLimit})`);
  }

  const prompt = `You are a social media copywriter for TarotTALKS writing one ${platform.toUpperCase()} post.

## VOICE
${voiceParts.join('\n')}

## POST REQUIREMENTS
- Content type: ${CONTENT_TYPE_LABELS[contentType]}
- Framework: ${FRAMEWORK_LABELS[framework]}
- Character limit: ${charLimit}
${cardName ? `- Feature card: ${cardName}` : ''}
${talkTitle ? `- Feature talk: "${talkTitle}"` : ''}
${customInstructions ? `- Special instructions: ${customInstructions}` : ''}

The URL for any card is: https://tarottalks.app/cards/[slug]
The main site URL is: https://tarottalks.app

Return ONLY valid JSON:
\`\`\`json
{
  "hook": "opening line(s)",
  "body": "full post text including the hook",
  "cta": "call to action line",
  "hashtags": ["tag1", "tag2"]
}
\`\`\``;

  const result = await generateWithGemini(prompt, 3, {
    ...context,
    source: 'content_assistant_regenerate',
  }, {
    maxOutputTokens: 1024,
    temperature: 0.8,
  });

  if (!result.success) {
    return { error: result.error || 'Failed to regenerate post' };
  }

  try {
    const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || result.text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) throw new Error('No JSON found');
    const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    return {
      dayOfWeek: 0,
      contentType,
      framework,
      hook: data.hook || '',
      body: data.body || '',
      cta: data.cta || '',
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    };
  } catch (e) {
    console.error('Failed to parse regeneration response:', e, result.text);
    return { error: 'Failed to parse AI response' };
  }
}

// ============================================================================
// Cost Estimation
// ============================================================================

const INPUT_COST_PER_TOKEN = 0.10 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 0.40 / 1_000_000;

/**
 * Estimate cost for content generation operations
 */
export function estimateOperationCost(operation: 'strategy' | 'content' | 'regenerate' | 'full-week'): {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costRange: { min: number; max: number };
} {
  const estimates = {
    strategy: { inputTokens: 3000, outputTokens: 2000 },
    content: { inputTokens: 4000, outputTokens: 4000 },
    regenerate: { inputTokens: 1500, outputTokens: 500 },
    'full-week': { inputTokens: 7000, outputTokens: 6000 },
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

/**
 * Get voice status summary for a platform (shown before generation)
 */
export function getVoiceStatus(voice: VoiceContext, platform: Platform): {
  hasStyleData: boolean;
  hasAiInsights: boolean;
  hasTopPerformers: boolean;
  summary: string;
} {
  const hasStyleData = !!voice.stylePattern;
  const hasAiInsights = !!voice.aiInsights;
  const hasTopPerformers = (voice.topPerformers?.length || 0) > 0;
  const postCount = voice.stylePattern?.postsAnalyzed || 0;

  let summary: string;
  if (hasAiInsights && hasTopPerformers) {
    const daysAgo = voice.aiInsights?.generatedAt
      ? Math.floor((Date.now() - new Date(voice.aiInsights.generatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    summary = `Using voice data from ${postCount} ${platform} posts (analyzed ${daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`})`;
  } else if (hasStyleData) {
    summary = `Using statistical patterns from ${postCount} ${platform} posts. Generate AI insights in Platform Style for better voice matching.`;
  } else {
    summary = `No voice data for ${platform} yet — using brand config only. Log 3+ posts in Signal Deck to enable voice matching.`;
  }

  return { hasStyleData, hasAiInsights, hasTopPerformers, summary };
}
