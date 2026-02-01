/**
 * Staged API: Generate Spread Reading
 *
 * POST /api/update/spread-reading
 *
 * Accepts card IDs and optional focus, returns a recommended talk with rationale.
 * This is the staged version at /update for testing before go-live.
 */

import { NextResponse } from 'next/server';
import {
  getCardsForSpread,
  getTalksForScoring,
  getMappingsForCards,
  createSpread,
} from '@/lib/db/queries/spreads';
import {
  scoreTalksForSpread,
  getTopRecommendation,
  generateRationale,
  type FocusType,
  type SpreadReadingResult,
} from '@/lib/spread-reading';

interface RequestBody {
  cardIds: string[];
  focusType?: FocusType;
  focusText?: string;
  save?: boolean; // Whether to persist the spread
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { cardIds, focusType, focusText, save = true } = body;

    // Validate card IDs
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length < 2 || cardIds.length > 3) {
      return NextResponse.json(
        { error: 'cardIds must be an array of 2-3 card IDs' },
        { status: 400 }
      );
    }

    // Fetch cards
    const cards = await getCardsForSpread(cardIds);
    if (cards.length !== cardIds.length) {
      return NextResponse.json(
        { error: 'One or more card IDs not found' },
        { status: 404 }
      );
    }

    // Fetch all talks and mappings for scoring
    const [allTalks, mappings] = await Promise.all([
      getTalksForScoring(),
      getMappingsForCards(cardIds),
    ]);

    if (allTalks.length === 0) {
      return NextResponse.json(
        { error: 'No talks available' },
        { status: 500 }
      );
    }

    // Score talks
    const scoredTalks = scoreTalksForSpread(
      cards,
      allTalks,
      mappings,
      focusType,
      focusText
    );

    // Get recommendation
    const recommendation = getTopRecommendation(scoredTalks);

    // Generate rationale
    const rationaleResult = await generateRationale({
      cards,
      talk: recommendation.primary.talk,
      matchReasons: recommendation.primary.matchReasons,
      focusType,
      focusText,
    });

    // Build result
    const result: SpreadReadingResult = {
      type: recommendation.type,
      talk: recommendation.primary.talk,
      rationale: rationaleResult.rationale,
      rationaleSource: rationaleResult.source,
      aiModel: rationaleResult.model,
      score: recommendation.primary.score,
      matchReasons: recommendation.primary.matchReasons,
    };

    // Add alternatives if multiple options
    if (recommendation.type === 'multiple_options' && recommendation.alternatives) {
      result.alternativeTalks = recommendation.alternatives.map(a => a.talk);
    }

    // Save spread if requested
    let savedSpread: { id: string; shortId: string } | null = null;
    if (save) {
      savedSpread = await createSpread({
        cardIds,
        talkId: recommendation.primary.talk.id,
        focusType,
        focusText,
        rationale: rationaleResult.rationale,
        rationaleSource: rationaleResult.source,
        aiModel: rationaleResult.model,
        score: recommendation.primary.score,
        matchReasons: recommendation.primary.matchReasons,
      });
    }

    return NextResponse.json({
      ...result,
      cards,
      spread: savedSpread,
    }, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error creating spread reading:', error);
    return NextResponse.json(
      { error: 'Failed to create spread reading' },
      { status: 500 }
    );
  }
}
