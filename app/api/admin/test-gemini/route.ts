import { NextResponse } from 'next/server';
import { GEMINI_MODEL, GEMINI_MODEL_ENDPOINT, getCircuitBreakerStatus } from '@/lib/services/gemini';

export async function GET() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  // Check circuit breaker status
  const circuitBreaker = getCircuitBreakerStatus();

  if (!apiKey) {
    return NextResponse.json({
      error: 'No API key configured',
      model: GEMINI_MODEL,
      endpoint: GEMINI_MODEL_ENDPOINT,
      circuitBreaker,
      envCheck: {
        hasApiKey: false,
      },
    }, { status: 500 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ENDPOINT}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "Gemini 1.5 Pro is working!" in exactly those words.' }] }],
      }),
    });

    const status = response.status;
    const data = await response.json();

    return NextResponse.json({
      model: GEMINI_MODEL,
      endpoint: GEMINI_MODEL_ENDPOINT,
      apiUrl: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ENDPOINT}:generateContent`,
      status,
      success: response.ok,
      circuitBreaker,
      envCheck: {
        hasApiKey: true,
        keyPrefix: apiKey.slice(0, 8) + '...',
      },
      response: response.ok ? data.candidates?.[0]?.content?.parts?.[0]?.text : data,
      usageMetadata: response.ok ? data.usageMetadata : undefined,
    });
  } catch (error) {
    return NextResponse.json({
      model: GEMINI_MODEL,
      endpoint: GEMINI_MODEL_ENDPOINT,
      circuitBreaker,
      envCheck: {
        hasApiKey: true,
        keyPrefix: apiKey.slice(0, 8) + '...',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
