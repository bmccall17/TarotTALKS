import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { behaviorEvents } from '@/lib/db/schema';
import { checkRateLimit } from '@/lib/utils/rate-limit';

// Allowed event names - whitelist for security
const ALLOWED_EVENTS = new Set([
  'session_start',
  'card_flip',
  'spread_ready',
  'read_spread_click',
  'talk_click',
  'card_detail_click',
  // Spread reading flow events
  'reading_started',
  'focus_selected',
  'reading_generated',
  'talk_from_reading',
  'share_initiated',
]);

type EventPayload = {
  name: string;
  timestamp: number;
  properties: Record<string, unknown>;
};

type RequestBody = {
  sessionId: string;
  events: EventPayload[];
};

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Rate limit: 30 requests per minute per IP
    if (!checkRateLimit(`events:${ip}`, 30, 60000)) {
      return new NextResponse(null, { status: 429 });
    }

    const body = await request.json() as RequestBody;
    const { sessionId, events } = body;

    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length !== 12) {
      return new NextResponse('Invalid session ID', { status: 400 });
    }

    // Validate events array
    if (!Array.isArray(events) || events.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    // Filter to valid events only
    const validEvents = events.filter(
      (e): e is EventPayload =>
        e &&
        typeof e.name === 'string' &&
        ALLOWED_EVENTS.has(e.name) &&
        typeof e.timestamp === 'number'
    );

    if (validEvents.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    // Batch insert valid events
    await db.insert(behaviorEvents).values(
      validEvents.map((e) => ({
        sessionId,
        eventName: e.name,
        timestamp: e.timestamp,
        properties: JSON.stringify(e.properties || {}),
      }))
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error processing events:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
