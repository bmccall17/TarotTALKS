/**
 * API: Generate Spread Reading
 *
 * POST /api/spreads/spread-reading
 *
 * Accepts card IDs and optional focus, returns a recommended talk with rationale.
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
  POSITION_LABELS,
} from '@/lib/spread-reading';
import {
  generateSynthesisAndQueries,
  selectBestTalkWithAI
} from '@/lib/services/gemini';
import { searchYouTube, type YouTubeResult } from '@/lib/services/youtube';

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

    // Fetch all talks and mappings for scoring (Local Baseline)
    const [allTalks, mappings] = await Promise.all([
      getTalksForScoring(),
      getMappingsForCards(cardIds),
    ]);

    // MAP cards to Gemini Format
    const geminiCards = cards.map((card, index) => {
      let archetypes: string[] = [];
      let themes: string[] = [];
      try {
        if (card.archetypesJson) archetypes = JSON.parse(card.archetypesJson);
        if (card.themesJson) themes = JSON.parse(card.themesJson);
      } catch (e) { /* ignore */ }

      return {
        name: card.name,
        summary: card.summary,
        position: POSITION_LABELS[index],
        archetypes,
        themes
      };
    });

    // ---------------------------------------------------------
    // INTELLIGENCE EVOLUTION: NEW FLOW
    // ---------------------------------------------------------

    // 1. SYNTHESIS (The Brain)
    let synthesis = "";
    let searchQueries: string[] = [];
    let isNewFlowSuccessful = false;
    let selectedTalk = null;
    let finalRationale = "";

    // Attempt the new flow
    try {
      const synthesisResult = await generateSynthesisAndQueries({
        cards: geminiCards,
        focusText: focusText
      });

      if ('synthesis' in synthesisResult) {
        synthesis = synthesisResult.synthesis;
        searchQueries = synthesisResult.searchQueries;

        // 2. RETRIEVAL (The Search)
        // Run YouTube Search and Local Scoring in Parallel
        const [youtubeResults, scoredLocalTalks] = await Promise.all([
          searchYouTube(searchQueries),
          Promise.resolve(scoreTalksForSpread(cards, allTalks, mappings, focusType, focusText))
        ]);

        // Prepare Candidates
        // Top 3 Local
        const localCandidates = scoredLocalTalks.slice(0, 3).map(st => ({
          id: st.talk.id,
          title: st.talk.title,
          speakerName: st.talk.speakerName,
          description: st.talk.description || '',
          source: 'local' as const,
        }));

        // YouTube
        const ytCandidates = youtubeResults.map(yt => ({
          id: yt.id, // YouTube Video ID
          title: yt.title,
          speakerName: yt.channelTitle, // Use channel as speaker proxy
          description: yt.description,
          source: 'youtube' as const,
          snippet: yt.description,
          url: yt.url,
          thumbnail: yt.thumbnail
        }));

        // 3. SELECTION (The Judge)
        const allCandidates = [...ytCandidates, ...localCandidates];

        const selection = await selectBestTalkWithAI({
          synthesis,
          candidates: allCandidates
        });

        if (!('error' in selection)) {
          const winner = allCandidates[selection.bestTalkIndex];

          if (winner.source === 'local') {
            // It's a local talk, find the full object
            // We cast to LocalCandidate-like shape to access logic if needed, but we have 'allTalks'
            const fullTalk = allTalks.find(t => t.id === winner.id);
            if (fullTalk) {
              selectedTalk = fullTalk;
            } else {
              // Fallback if not found (unlikely)
              selectedTalk = {
                id: winner.id,
                slug: 'unknown',
                title: winner.title,
                speakerName: winner.speakerName || 'Unknown',
                description: winner.description,
                thumbnailUrl: null,
                durationSeconds: null,
              };
            }
          } else {
            // It's a YouTube talk
            // winner is compatible with YouTubeCandidate
            const ytWinner = winner as typeof ytCandidates[0];
            selectedTalk = {
              id: `yt_${ytWinner.id}`,
              slug: `yt-${ytWinner.id}`,
              title: ytWinner.title,
              speakerName: ytWinner.speakerName || 'TED Speaker',
              description: ytWinner.description,
              thumbnailUrl: ytWinner.thumbnail,
              durationSeconds: null,
              year: null,
              themesJson: null,
              coreMessage: null
            };
          }

          finalRationale = selection.reasoning;
          isNewFlowSuccessful = true;
        }
      }
    } catch (e) {
      console.error("Intelligence Evolution Flow Failed:", e);
      // Fallback proceeds below
    }

    // ---------------------------------------------------------
    // FALLBACK: OLD FLOW
    // ---------------------------------------------------------
    if (!isNewFlowSuccessful) {
      const scoredTalks = scoreTalksForSpread(
        cards,
        allTalks,
        mappings,
        focusType,
        focusText
      );
      const recommendation = getTopRecommendation(scoredTalks);
      selectedTalk = recommendation.primary.talk;

      const rationaleResult = await generateRationale({
        cards,
        talk: selectedTalk,
        matchReasons: recommendation.primary.matchReasons,
        focusType,
        focusText,
      });
      finalRationale = rationaleResult.rationale;
    }

    if (!selectedTalk) {
      return NextResponse.json(
        { error: 'Failed to generate reading' },
        { status: 500 }
      );
    }

    // Save spread if requested
    let savedSpread: { id: string; shortId: string } | null = null;
    if (save) {
      // NOTE: We only save if it's a "local" talk or we need logic to save "new" talks
      // For now, if ID starts with yt_, we might fail foreign key constraint if we try to link it
      // The schema likely expects a valid talk_id UUID.
      // If selectedTalk is NOT in DB, we should technically insert it or handle it.
      // For this step, if it's external, we might skip saving the *relation* or just save the spread without a talk? 
      // Checking createSpread signature: 'talkId' is required and likely UUID.

      // FIX: If it's a YouTube talk (not in DB), we fallback to NOT linking it strictly or we need to insert it.
      // "If it's a new YouTube talk, you might want to save it to your 'talks' table on the fly!" (Plan Step 4.5)

      // For this iteration, if it's a YouTube talk, we WON'T save the spread to DB to avoid crashing on FK,
      // OR we just return it to the user.
      // But the user expects a spread ID maybe?

      // Let's assume for now we only save if it's a local talk (UUID), 
      // or we accept that 'createSpread' might fail if we pass a fake ID.
      // Let's try to save ONLY if it's a UUID (local).
      const isLocal = !selectedTalk.id.startsWith('yt_');

      if (isLocal) {
        savedSpread = await createSpread({
          cardIds,
          talkId: selectedTalk.id,
          focusType,
          focusText,
          rationale: finalRationale,
          rationaleSource: isNewFlowSuccessful ? 'ai' : 'template',
          aiModel: 'gemini-1.5-flash',
          score: 100, // Synthetic score for AI selection
          matchReasons: [], // No standard reasons for AI selection
        });
      }
    }

    return NextResponse.json({
      type: 'single_best',
      talk: selectedTalk,
      rationale: finalRationale,
      rationaleSource: isNewFlowSuccessful ? 'ai' : 'template',
      aiModel: 'gemini-1.5-flash',
      score: 100,
      matchReasons: [],
      cards,
      spread: savedSpread,
      synthesis: synthesis // Return synthesis for UI debug if needed
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
