/**
 * Campaign Caption Generator
 *
 * Generates platform-aware caption variants using Gemini AI.
 * Reuses the existing generateWithGemini() infrastructure for retry,
 * rate limiting, and cost tracking.
 */

import { generateWithGemini } from '@/lib/services/gemini';
import type { CampaignItem, CampaignPlatform } from './types';

export interface CaptionSet {
  short: string;   // 1-2 sentences, punchy
  medium: string;  // 2-3 sentences, more context
  spicy: string;   // Provocative/curiosity hook
  hashtags: string[];
}

const PLATFORM_INSTRUCTIONS: Record<CampaignPlatform, string> = {
  instagram: `Instagram style: Use line breaks for readability. Include a call-to-action.
Hashtags should be a mix of popular and niche (15-20 tags).
Use emojis sparingly but effectively. Max ~2200 chars for medium.`,

  x: `Twitter/X style: Keep SHORT and PUNCHY. Max 280 characters for short caption.
Medium can be a thread-style thought (still concise). Use minimal hashtags (2-3 max).
No line-break formatting needed.`,

  bluesky: `Bluesky style: Conversational, thoughtful tone. Max 300 characters for short.
Medium can be 2-3 sentences. Skip hashtags (Bluesky doesn't use them widely).
Link to the page naturally.`,

  linkedin: `LinkedIn style: Professional but warm. Medium should read like a micro-article opener.
Use a hook question or bold statement. Include 3-5 relevant hashtags.
Encourage thoughtful engagement.`,

  threads: `Threads style: Casual, conversational. Similar to Instagram but shorter.
1-2 sentences for short, 2-3 for medium. Minimal hashtags (3-5).
Feel authentic and spontaneous.`,
};

/**
 * Generate caption variants for a single campaign item.
 */
export async function generateCaptions(
  item: CampaignItem,
  options?: { includeCta?: boolean }
): Promise<CaptionSet | null> {
  const includeCta = options?.includeCta !== false;
  const ctaUrl = `https://tarottalks.app/${item.category}/${item.slug}`;

  const contentDesc = item.category === 'cards'
    ? `Tarot card: "${item.card_name || item.slug}"`
    : `TED talk: "${item.talk_title || item.slug}" by ${item.speaker_name || 'unknown speaker'}`;

  const prompt = `You are writing social media captions for TarotTALKS, a platform that maps Tarot cards to TED talks.

## CONTENT
${contentDesc}
${item.speaker_name ? `Speaker: ${item.speaker_name}` : ''}
${item.speaker_handle ? `Speaker handle: ${item.speaker_handle}` : ''}

## PLATFORM
${PLATFORM_INSTRUCTIONS[item.platform]}

## TASK
Generate exactly 3 caption variants and a hashtag list. Return valid JSON:

\`\`\`json
{
  "short": "1-2 sentence punchy caption",
  "medium": "2-3 sentence caption with more context and depth",
  "spicy": "Provocative/curiosity-driven hook that makes people stop scrolling",
  "hashtags": ["hashtag1", "hashtag2", "..."]
}
\`\`\`

## RULES
- Each caption variant should feel distinct (not just longer/shorter versions)
- Reference the specific card or talk naturally
- ${includeCta ? `Include the link ${ctaUrl} in the medium caption` : 'Do not include links'}
- "spicy" should use a bold claim, contrarian take, or intriguing question
- Hashtags should NOT include the # symbol (just the word)
- Keep the TarotTALKS brand voice: wise, warm, a bit irreverent, never preachy

## OUTPUT (JSON only)`;

  const result = await generateWithGemini(prompt, 3, {
    source: 'campaign-captions',
  });

  if (!result.success) {
    console.error(`[Caption] Gemini error: ${result.error}`);
    return null;
  }

  try {
    const match = result.text.match(/```json\n([\s\S]*?)\n```/) || result.text.match(/({[\s\S]*})/);
    const jsonStr = match ? match[1] || match[0] : result.text;
    const data = JSON.parse(jsonStr);

    if (data.short && data.medium && data.spicy && Array.isArray(data.hashtags)) {
      return {
        short: data.short,
        medium: data.medium,
        spicy: data.spicy,
        hashtags: data.hashtags,
      };
    }

    console.error('[Caption] Invalid JSON structure:', data);
    return null;
  } catch (e) {
    console.error('[Caption] Failed to parse JSON:', result.text);
    return null;
  }
}

/**
 * Generate captions for a batch of items with rate limiting.
 */
export async function generateCaptionsBatch(
  items: CampaignItem[],
  options?: { includeCta?: boolean; delayMs?: number }
): Promise<Map<string, CaptionSet>> {
  const results = new Map<string, CaptionSet>();
  const delay = options?.delayMs ?? 2000;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = `${item.platform}:${item.slug}`;

    console.log(`[Caption] Generating ${i + 1}/${items.length}: ${key}`);

    const captionSet = await generateCaptions(item, options);
    if (captionSet) {
      results.set(key, captionSet);
    }

    // Rate limit protection between calls
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}
