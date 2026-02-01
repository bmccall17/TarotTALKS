/**
 * Gemini API Service
 *
 * Wrapper for Google Gemini API with rate limiting for free tier.
 * Free tier limits: 15 RPM, 1M TPM
 */

// Rate limiting state (in-memory, resets on server restart)
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 10; // Conservative limit (15 allowed, use 10)
const RESET_INTERVAL_MS = 60 * 1000; // 1 minute

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
 * Generate content using Gemini API
 *
 * @param prompt - The prompt to send to Gemini
 * @returns Generated text or error
 */
export async function generateWithGemini(prompt: string): Promise<GeminiResponse> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('GOOGLE_GEMINI_API_KEY not configured');
    return { error: 'Gemini API not configured', success: false };
  }

  // Check rate limit
  if (!checkRateLimit()) {
    console.warn('Gemini rate limit reached');
    return { error: 'Rate limit reached', success: false, rateLimited: true };
  }

  try {
    incrementRateLimit();

    // Use Gemini 1.5 Flash (free tier)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 256,
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

      // Check for rate limit response from Google
      if (response.status === 429) {
        return { error: 'Rate limit exceeded', success: false, rateLimited: true };
      }

      return { error: `API error: ${response.status}`, success: false };
    }

    const data = await response.json();

    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('No text in Gemini response:', data);
      return { error: 'No content generated', success: false };
    }

    return { text: text.trim(), success: true };
  } catch (error) {
    console.error('Gemini API fetch error:', error);
    return { error: 'Network error', success: false };
  }
}

/**
 * Generate a spread rationale using Gemini
 */
export async function generateSpreadRationale(params: {
  cards: Array<{
    name: string;
    summary: string;
    position: string;
  }>;
  talk: {
    title: string;
    speakerName: string;
    description: string | null;
  };
  focusText?: string;
}): Promise<GeminiResponse> {
  const { cards, talk, focusText } = params;

  const cardDescriptions = cards.map(c =>
    `- ${c.position}: ${c.name} - ${c.summary}`
  ).join('\n');

  const prompt = `You are a TarotTALKS spread reader. Given these cards and this TED talk, write a 2-3 sentence rationale explaining why this talk speaks to this spread.

Cards:
${cardDescriptions}

${focusText ? `User's focus: ${focusText}\n` : ''}
Recommended talk: "${talk.title}" by ${talk.speakerName}
${talk.description ? `Talk description: ${talk.description}` : ''}

Write a warm, insightful rationale using second person ("you"). Keep it under 100 words. Don't mention the card positions by name ("Aware Self", etc.) - just weave the themes together naturally. Focus on the emotional resonance between the cards and the talk.`;

  return generateWithGemini(prompt);
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
