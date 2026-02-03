/**
 * Gemini API Service
 *
 * Wrapper for Google Gemini API with rate limiting for free tier.
 * Free tier limits: 15 RPM, 1M TPM
 */

import { logApiCall } from '@/lib/db/queries/api-usage';
import type { FocusType } from '@/lib/spread-reading/types';
import { FOCUS_TYPE_LABELS } from '@/lib/spread-reading/types';

// Context for API call logging (optional)
export interface ApiCallContext {
  sessionId?: string;
  source?: string;
}

// Rate limiting state (in-memory, resets on server restart)
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 10; // Conservative limit (15 allowed, use 10)
const RESET_INTERVAL_MS = 60 * 1000; // 1 minute

// Circuit breaker state - persistent across requests (resets on server restart)
let circuitBreakerCooldownUntil: Date | null = null;

/**
 * Check if the circuit breaker is open (quota exhausted, in cooldown)
 */
function isCircuitBreakerOpen(): boolean {
  if (!circuitBreakerCooldownUntil) return false;
  if (new Date() >= circuitBreakerCooldownUntil) {
    // Cooldown expired, reset circuit breaker
    circuitBreakerCooldownUntil = null;
    console.log('[Gemini] Circuit breaker reset - cooldown expired');
    return false;
  }
  return true;
}

/**
 * Trip the circuit breaker - sets cooldown until next midnight Pacific Time
 */
function tripCircuitBreaker(): void {
  // Set cooldown until next midnight Pacific Time (UTC-8)
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(8, 0, 0, 0); // Midnight PT = 8 AM UTC
  if (midnight <= now) {
    midnight.setDate(midnight.getDate() + 1);
  }
  circuitBreakerCooldownUntil = midnight;
  console.log(`[Gemini] Circuit breaker tripped - cooldown until ${midnight.toISOString()}`);
}

/**
 * Get circuit breaker status for monitoring/admin
 */
export function getCircuitBreakerStatus(): {
  isOpen: boolean;
  cooldownUntil: string | null;
} {
  return {
    isOpen: isCircuitBreakerOpen(),
    cooldownUntil: circuitBreakerCooldownUntil?.toISOString() || null,
  };
}

/**
 * Force reset the circuit breaker (admin action)
 * WARNING: This allows API calls to proceed even if quota may still be exhausted
 */
export function forceResetCircuitBreaker(): { success: boolean; message: string } {
  if (!circuitBreakerCooldownUntil) {
    return { success: false, message: 'Circuit breaker is not currently tripped' };
  }

  const wasOpenUntil = circuitBreakerCooldownUntil.toISOString();
  circuitBreakerCooldownUntil = null;
  console.log(`[Gemini] Circuit breaker force reset by admin (was open until ${wasOpenUntil})`);

  return { success: true, message: `Circuit breaker reset. Was scheduled until ${wasOpenUntil}` };
}

// Gemini 2.0 Flash free tier daily limit (approximate)
export const GEMINI_DAILY_QUOTA = 1500;

type GeminiResponse = {
  text: string;
  success: true;
} | {
  error: string;
  success: false;
  rateLimited?: boolean;
};

/**
 * Check if we're within rate limits
 */
function checkRateLimit(): boolean {
  const now = Date.now();

  // Reset counter if minute has passed
  if (now - lastResetTime >= RESET_INTERVAL_MS) {
    requestCount = 0;
    lastResetTime = now;
  }

  return requestCount < MAX_REQUESTS_PER_MINUTE;
}

/**
 * Increment rate limit counter
 */
function incrementRateLimit(): void {
  requestCount++;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate content using Gemini API with retry logic for rate limiting
 *
 * @param prompt - The prompt to send to Gemini
 * @param maxRetries - Maximum number of retries on rate limit (default: 3)
 * @param context - Optional context for API call logging (sessionId, source)
 * @returns Generated text or error
 */
export async function generateWithGemini(
  prompt: string,
  maxRetries: number = 3,
  context?: ApiCallContext
): Promise<GeminiResponse> {
  // CHECK CIRCUIT BREAKER FIRST - skip API call if quota exhausted
  if (isCircuitBreakerOpen()) {
    console.log('[Gemini] Circuit breaker open - skipping API call');
    logApiCall({
      apiName: 'gemini',
      success: false,
      errorType: 'circuit_breaker',
      sessionId: context?.sessionId,
      source: context?.source,
      properties: { reason: 'circuit_breaker_open', cooldownUntil: circuitBreakerCooldownUntil?.toISOString() },
    });
    return {
      error: 'Gemini temporarily unavailable (quota cooldown)',
      success: false,
      rateLimited: true,
    };
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('GOOGLE_GEMINI_API_KEY not configured');
    return { error: 'Gemini API not configured', success: false };
  }

  // Check internal rate limit
  if (!checkRateLimit()) {
    console.warn('Gemini internal rate limit reached');
    // Log rate limit hit
    logApiCall({
      apiName: 'gemini',
      success: false,
      errorType: 'rate_limit',
      sessionId: context?.sessionId,
      source: context?.source,
      properties: { reason: 'internal_rate_limit' },
    });
    return { error: 'Rate limit reached', success: false, rateLimited: true };
  }

  let lastError: string = 'Unknown error';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s, 8s
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`[Gemini] Rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(delayMs);
      }

      incrementRateLimit();

      // Use Gemini 2.0 Flash (free tier model)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
              topP: 0.8,
              topK: 40,
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              }
            ]
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);

        // Detect if it's a quota issue (daily limit) vs rate limit (per-minute)
        const isQuotaExceeded = errorText.toLowerCase().includes('quota') ||
                                errorText.toLowerCase().includes('resource has been exhausted');

        // Check for rate limit response from Google - retry if we have attempts left
        // Don't retry quota exceeded - it won't help until midnight PT
        if (response.status === 429 && attempt < maxRetries && !isQuotaExceeded) {
          lastError = 'Rate limit exceeded';
          continue; // Retry with backoff
        }

        if (response.status === 429) {
          // TRIP CIRCUIT BREAKER on quota exhaustion to prevent further requests
          if (isQuotaExceeded) {
            tripCircuitBreaker();
          }

          // Log as quota_exceeded or rate_limit based on error message
          const errorType = isQuotaExceeded ? 'quota_exceeded' : 'rate_limit';
          logApiCall({
            apiName: 'gemini',
            success: false,
            errorType,
            sessionId: context?.sessionId,
            source: context?.source,
            properties: { status: 429, attempts: attempt + 1, isQuotaExceeded, circuitBreakerTripped: isQuotaExceeded },
          });
          const errorMsg = isQuotaExceeded
            ? 'Daily quota exceeded - resets at midnight PT'
            : 'Rate limit exceeded after retries';
          return { error: errorMsg, success: false, rateLimited: true };
        }

        // Log other API errors
        logApiCall({
          apiName: 'gemini',
          success: false,
          errorType: 'api_error',
          sessionId: context?.sessionId,
          source: context?.source,
          properties: { status: response.status },
        });
        return { error: `API error: ${response.status}`, success: false };
      }

      const data = await response.json();

      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error('No text in Gemini response:', data);
        // Log as API error (unexpected response format)
        logApiCall({
          apiName: 'gemini',
          success: false,
          errorType: 'api_error',
          sessionId: context?.sessionId,
          source: context?.source,
          properties: { reason: 'no_content' },
        });
        return { error: 'No content generated', success: false };
      }

      if (attempt > 0) {
        console.log(`[Gemini] Success after ${attempt + 1} attempts`);
      }

      // Log success
      logApiCall({
        apiName: 'gemini',
        success: true,
        sessionId: context?.sessionId,
        source: context?.source,
        properties: { attempts: attempt + 1 },
      });

      return { text: text.trim(), success: true };
    } catch (error) {
      console.error('Gemini API fetch error:', error);
      lastError = 'Network error';

      // Log network error and don't retry
      logApiCall({
        apiName: 'gemini',
        success: false,
        errorType: 'network',
        sessionId: context?.sessionId,
        source: context?.source,
        properties: { error: error instanceof Error ? error.message : 'unknown' },
      });
      return { error: 'Network error', success: false };
    }
  }

  // Log final failure after all retries
  logApiCall({
    apiName: 'gemini',
    success: false,
    errorType: 'rate_limit',
    sessionId: context?.sessionId,
    source: context?.source,
    properties: { reason: 'max_retries_exceeded' },
  });

  return { error: lastError, success: false, rateLimited: true };
}

/**
 * Generate a spread rationale using Gemini
 */
export async function generateSpreadRationale(params: {
  cards: Array<{
    name: string;
    summary: string;
    position: string;
    archetypes?: string[];
    themes?: string[];
  }>;
  talk: {
    title: string;
    speakerName: string;
    description: string | null;
  };
  focusText?: string;
  context?: ApiCallContext;
}): Promise<GeminiResponse> {
  const { cards, talk, focusText, context } = params;

  // Construct enriched card context
  const cardContext = cards.map(c => {
    const details = [
      `Position: ${c.position}`,
      `Card: ${c.name}`,
      `Summary: ${c.summary}`,
      c.archetypes && c.archetypes.length ? `Archetypes: ${c.archetypes.join(', ')}` : '',
      c.themes && c.themes.length ? `Themes: ${c.themes.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    return details;
  }).join('\n\n');

  const systemInstruction = `
You are the TarotTALKS Spread Reader, a wise guide who synthesizes Tarot spreads and recommends TED or TED-like talks.

## YOUR ROLE
You help users understand their 2-card or 3-card Tarot spreads by:
1. Identifying the cards and their positions.
2. Interpreting the narrative arc between the cards.
3. Weaving the cards into a unified narrative; be REAL, HONEST, and DIRECT. Do not sugarcoat.
4. Explaining WHY the specific recommended TED talk is the specific "medicine" for this spread.

## THE THREE POSITIONS
**Position 1: Aware Self** — What the user consciously knows.
**Position 2: Supporting Shadow** — Hidden influences, what they may not see.
**Position 3: Emerging Path** — The direction forward.

## YOUR READING STYLE
- **Tone**: Warm but not sycophantic. Speak with quiet authority (like a trusted friend who knows Tarot).
- **Format**: 2-3 succinct sentences.
- **Focus**: Focus on the *synthesis* (the tension and resolution between cards).
- **Constraints**: Do NOT mention the card positions by name ("Aware Self", etc.) or list card meanings. weave the themes naturally.

## THE RECOMMENDED TALK
You have been given a specific talk that matches this spread. Your job is to explain the connection.
Talk: "${talk.title}" by ${talk.speakerName}
Description: ${talk.description || 'N/A'}

## OUTPUT
Write a 2-3 sentence rationale explaining why this talk is the perfect insight for this specific card combination and what it offers the user. Use second person ("you").
`;

  const prompt = `
${systemInstruction}

## THE SPREAD
${cardContext}

${focusText ? `## USER FOCUS\n"${focusText}"\n` : ''}

## YOUR RATIONALE
`;

  return generateWithGemini(prompt, 3, context);
}

/**
 * Generate synthesis and search queries from a spread
 * (Phase 2: The "Brain" Upgrade)
 */
export interface SynthesisResult {
  synthesis: string;
  searchQueries: string[];
}

export async function generateSynthesisAndQueries(params: {
  cards: Array<{
    name: string;
    summary: string;
    position: string;
    archetypes?: string[];
    themes?: string[];
  }>;
  focusType?: FocusType;
  focusText?: string;
  context?: ApiCallContext;
}): Promise<SynthesisResult | { error: string }> {
  const { cards, focusType, focusText, context } = params;

  // Construct enriched card context
  const cardContext = cards.map(c => {
    const details = [
      `Position: ${c.position}`,
      `Card: ${c.name}`,
      `Summary: ${c.summary}`,
      c.archetypes && c.archetypes.length ? `Archetypes: ${c.archetypes.join(', ')}` : '',
      c.themes && c.themes.length ? `Themes: ${c.themes.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    return details;
  }).join('\n\n');

  const systemInstruction = `
You are the TarotTALKS Synthesis Engine. Your goal is to deeply analyze a Tarot spread and identify the core "struggle" or "tension" that needs resolution.

## YOUR TASK
1. Analyze the cards positions:
   - "Aware Self": What is known/conscious.
   - "Supporting Shadow": What is hidden/unconscious.
   - "Emerging Path": The potential resolution.
2. Identify the core tension between the Self and Shadow.
3. Formulate a "Synthesis": A 1-2 sentence statement of the specific problem/growth edge, addressing the user as "You".
4. Generate 3 targeted YouTube search queries to find a TED talk that acts as "medicine" for this synthesis.

## OUTPUT FORMAT
Return strictly valid JSON in the following format:
\`\`\`json
{
  "synthesis": "You are struggling with [Conflict] despite [Strength], and need to embrace [Path].",
  "searchQueries": [
    "site:youtube.com/@TED [Theme 1] [Theme 2]",
    "site:youtube.com/@TEDx [Theme 3] [Concept]",
    "[Specific Struggle] TED talk"
  ]
}
\`\`\`
`;

  const prompt = `
${systemInstruction}

## THE SPREAD
${cardContext}

${(focusType && focusType !== 'surprise_me') || focusText ? `## USER FOCUS\n${focusType && focusType !== 'surprise_me' && focusType !== 'custom' && FOCUS_TYPE_LABELS[focusType] ? `Area: ${FOCUS_TYPE_LABELS[focusType]}\n` : ''}${focusText ? `Context: "${focusText}"\n` : ''}` : ''}

## OUTPUT
`;

  const result = await generateWithGemini(prompt, 3, context);

  if (!result.success) {
    return { error: result.error || 'Failed to generate synthesis' };
  }

  if (!result.text) {
    return { error: 'No text returned from Gemini' };
  }

  try {
    // Extract JSON from markdown block
    const match = result.text.match(/```json\n([\s\S]*?)\n```/) || result.text.match(/({[\s\S]*})/);
    const jsonStr = match ? match[1] || match[0] : result.text;
    const data = JSON.parse(jsonStr);

    if (data.synthesis && Array.isArray(data.searchQueries)) {
      return {
        synthesis: data.synthesis,
        searchQueries: data.searchQueries
      };
    }
    return { error: 'Invalid JSON structure returned' };
  } catch (e) {
    console.error('Failed to parse synthesis JSON:', result.text);
    return { error: 'Failed to parse synthesis JSON' };
  }
}

/**
 * Get current rate limit status (for debugging/monitoring)
 */
export function getRateLimitStatus(): {
  requestsUsed: number;
  requestsRemaining: number;
  resetsIn: number;
} {
  const now = Date.now();
  const elapsed = now - lastResetTime;

  // Check if we need to reset
  if (elapsed >= RESET_INTERVAL_MS) {
    return {
      requestsUsed: 0,
      requestsRemaining: MAX_REQUESTS_PER_MINUTE,
      resetsIn: RESET_INTERVAL_MS,
    };
  }

  return {
    requestsUsed: requestCount,
    requestsRemaining: MAX_REQUESTS_PER_MINUTE - requestCount,
    resetsIn: RESET_INTERVAL_MS - elapsed,
  };
}

/**
 * Select the best talk from a list of candidates using Gemini
 * (Phase 3: The "Judge")
 */
export async function selectBestTalkWithAI(params: {
  synthesis: string;
  candidates: Array<{
    id?: string;
    title: string;
    speakerName?: string;
    channelTitle?: string;
    description: string;
    snippet?: string; // YouTube snippet
    source: 'youtube' | 'local';
    url?: string;
  }>;
  context?: string; // This is the "guidance" context for the AI
  apiCallContext?: ApiCallContext; // This is for logging
}): Promise<{
  bestTalkIndex: number; // Index in the candidates array
  reasoning: string;
  confidence: number; // 0-100
} | { error: string }> {
  const { synthesis, candidates, context, apiCallContext } = params;

  if (candidates.length === 0) {
    return { error: 'No candidates provided' };
  }

  const candidatesText = candidates.map((c, i) => `
CANDIDATE #${i}:
Title: ${c.title}
Speaker/Channel: ${c.speakerName || c.channelTitle || 'Unknown'}
Source: ${c.source}
Description: ${c.description}
${c.snippet ? `Snippet: ${c.snippet}` : ''}
`).join('\n-------------------\n');

  const systemInstruction = `
You are the TarotTALKS Curator. Your goal is to select the single best TED talk to serve as "medicine" for a specific Tarot reading synthesis.

## THE SYNTHESIS
"${synthesis}"

## YOUR TASK
1. Review the Candidate Talks below.
2. Select the ONE talk that most directly addresses the core tension in the synthesis.
3. Be picky. Look for emotional resonance and thematic fit, not just keyword matches.
4. ${context || 'Use your wisdom to pick the most transformative talk.'}
5. In the "reasoning" field, explain the selection to the user in the second person ("You").

## OUTPUT FORMAT
Return valid JSON:
\`\`\`json
{
  "bestTalkIndex": 0,
  "reasoning": "This talk is your medicine because it addresses your struggle with X by offering Z...",
  "confidence": 85
}
\`\`\`
`;

  const prompt = `
${systemInstruction}

## CANDIDATES
${candidatesText}

## OUTPUT
`;

  const result = await generateWithGemini(prompt, 3, apiCallContext);

  if (!result.success) {
    return { error: result.error || 'Failed to select talk' };
  }

  if (!result.text) {
    return { error: 'No text returned from Gemini' };
  }

  try {
    const match = result.text.match(/```json\n([\s\S]*?)\n```/) || result.text.match(/({[\s\S]*})/);
    const jsonStr = match ? match[1] || match[0] : result.text;
    const data = JSON.parse(jsonStr);

    if (typeof data.bestTalkIndex === 'number' && data.reasoning) {
      return {
        bestTalkIndex: data.bestTalkIndex,
        reasoning: data.reasoning,
        confidence: data.confidence || 50
      };
    }
    return { error: 'Invalid JSON structure returned' };
  } catch (e) {
    console.error('Failed to parse selection JSON:', result.text);
    return { error: 'Failed to parse selection JSON' };
  }
}
