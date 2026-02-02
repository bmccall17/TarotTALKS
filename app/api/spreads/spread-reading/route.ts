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
import { createTalk, getTalkByYouTubeId } from '@/lib/db/queries/admin-talks';
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
  skipAI?: boolean; // Skip Gemini/YouTube for testing (uses fallback flow)
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { cardIds, focusType, focusText, save = true, skipAI = false } = body;

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
    // INTELLIGENCE EVOLUTION: NEW FLOW (with independent fallbacks)
    // ---------------------------------------------------------

    // Track API states independently
    let synthesis = "";
    let searchQueries: string[] = [];
    let isNewFlowSuccessful = false;
    let selectedTalk = null;
    let finalRationale = "";

    // Independent API status tracking
    let geminiAvailable = true;
    let youtubeAvailable = true;
    let youtubeUsed = false;

    // Skip AI if requested (test mode)
    if (skipAI) {
      console.log('[ReadMySpread] ⚠️ skipAI=true, bypassing Intelligence Evolution flow');
      geminiAvailable = false;
      youtubeAvailable = false;
    }

    // Pre-compute local scoring (always needed as fallback or candidate pool)
    const scoredLocalTalks = scoreTalksForSpread(cards, allTalks, mappings, focusType, focusText);
    const localCandidates = scoredLocalTalks.slice(0, 3).map(st => ({
      id: st.talk.id,
      title: st.talk.title,
      speakerName: st.talk.speakerName,
      description: st.talk.description || '',
      source: 'local' as const,
    }));

    // Attempt the new flow (unless skipAI is set)
    if (!skipAI) {
      console.log('[ReadMySpread] Starting Intelligence Evolution flow...');

      // 1. SYNTHESIS (The Brain) - Gemini
      try {
        const synthesisResult = await generateSynthesisAndQueries({
          cards: geminiCards,
          focusText: focusText
        });

        console.log('[ReadMySpread] Synthesis result:', JSON.stringify(synthesisResult).slice(0, 200));

        if ('synthesis' in synthesisResult) {
          synthesis = synthesisResult.synthesis;
          searchQueries = synthesisResult.searchQueries;
          console.log('[ReadMySpread] Search queries:', searchQueries);
        } else {
          console.log('[ReadMySpread] ⚠️ Gemini synthesis failed:', synthesisResult.error);
          geminiAvailable = false;
        }
      } catch (e) {
        console.error("[ReadMySpread] ⚠️ Gemini synthesis exception:", e);
        geminiAvailable = false;
      }

      // 2. RETRIEVAL (YouTube Search) - only if we have synthesis
      let ytCandidates: Array<{
        id: string;
        title: string;
        speakerName: string;
        description: string;
        source: 'youtube';
        snippet: string;
        url: string;
        thumbnail: string;
      }> = [];

      if (geminiAvailable && searchQueries.length > 0) {
        try {
          const youtubeResults = await searchYouTube(searchQueries);
          console.log('[ReadMySpread] YouTube results:', youtubeResults.length);

          if (youtubeResults.length > 0) {
            youtubeUsed = true;
            ytCandidates = youtubeResults.map(yt => ({
              id: yt.id,
              title: yt.title,
              speakerName: yt.channelTitle,
              description: yt.description,
              source: 'youtube' as const,
              snippet: yt.description,
              url: yt.url,
              thumbnail: yt.thumbnail
            }));
          } else {
            console.log('[ReadMySpread] ⚠️ YouTube returned no results (API may be limited)');
            youtubeAvailable = false;
          }
        } catch (e) {
          console.error("[ReadMySpread] ⚠️ YouTube search exception:", e);
          youtubeAvailable = false;
        }
      }

      // 3. SELECTION (The Judge) - only if Gemini worked
      if (geminiAvailable) {
        try {
          // Combine candidates: YouTube (if available) + Local
          const allCandidates = [...ytCandidates, ...localCandidates];
          console.log('[ReadMySpread] Candidates for AI selection:', allCandidates.length,
            `(${ytCandidates.length} YouTube, ${localCandidates.length} local)`);

          const selection = await selectBestTalkWithAI({
            synthesis,
            candidates: allCandidates
          });

          console.log('[ReadMySpread] Selection result:', JSON.stringify(selection).slice(0, 300));

          if (!('error' in selection)) {
            const winner = allCandidates[selection.bestTalkIndex];

            if (winner.source === 'local') {
              const fullTalk = allTalks.find(t => t.id === winner.id);
              if (fullTalk) {
                selectedTalk = fullTalk;
              } else {
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
            console.log('[ReadMySpread] ✅ New flow SUCCESS! Selected:', selectedTalk?.title?.slice(0, 50),
              youtubeUsed ? '(with YouTube)' : '(local only)');
          } else {
            console.log('[ReadMySpread] ⚠️ AI selection failed:', selection.error);
            geminiAvailable = false;
          }
        } catch (e) {
          console.error("[ReadMySpread] ⚠️ AI selection exception:", e);
          geminiAvailable = false;
        }
      }
    }

    // ---------------------------------------------------------
    // FALLBACK: OLD FLOW
    // ---------------------------------------------------------
    if (!isNewFlowSuccessful) {
      console.log('[ReadMySpread] ⚠️ Using FALLBACK (old scoring flow)');
      const scoredTalks = scoreTalksForSpread(
        cards,
        allTalks,
        mappings,
        focusType,
        focusText
      );
      const recommendation = getTopRecommendation(scoredTalks);
      selectedTalk = recommendation.primary.talk;

      const rationaleResult = await generateRationale(
        {
          cards,
          talk: selectedTalk,
          matchReasons: recommendation.primary.matchReasons,
          focusType,
          focusText,
        },
        false, // forceAI
        skipAI // skipAI - use template only in test mode
      );
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
      let talkIdForSpread = selectedTalk.id;

      // If it's a YouTube talk (not in DB), check if it exists or insert it
      if (selectedTalk.id.startsWith('yt_')) {
        const youtubeVideoId = selectedTalk.id.replace('yt_', '');

        // Check if this YouTube talk already exists in our DB
        const existingTalk = await getTalkByYouTubeId(youtubeVideoId);

        if (existingTalk) {
          // Use existing record
          talkIdForSpread = existingTalk.id;
          selectedTalk = { ...selectedTalk, id: existingTalk.id, slug: existingTalk.slug };
        } else {
          // Insert new talk
          const speakerName = extractSpeakerFromYouTube(selectedTalk);

          const newTalk = await createTalk({
            title: selectedTalk.title,
            speakerName: speakerName,
            youtubeVideoId: youtubeVideoId,
            youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
            description: selectedTalk.description,
            thumbnailUrl: selectedTalk.thumbnailUrl,
          });

          talkIdForSpread = newTalk.id;
          selectedTalk = { ...selectedTalk, id: newTalk.id, slug: newTalk.slug };
        }
      }

      savedSpread = await createSpread({
        cardIds,
        talkId: talkIdForSpread,
        focusType,
        focusText,
        rationale: finalRationale,
        rationaleSource: isNewFlowSuccessful ? 'ai' : 'template',
        aiModel: 'gemini-1.5-flash',
        score: 100,
        matchReasons: [],
      });
    }

    return NextResponse.json({
      type: 'single_best',
      talk: selectedTalk,
      rationale: finalRationale,
      rationaleSource: isNewFlowSuccessful ? 'ai' : 'template',
      youtubeUsed, // Whether YouTube candidates were included
      aiModel: 'gemini-1.5-flash',
      score: 100,
      matchReasons: [],
      cards,
      spread: savedSpread,
      synthesis: synthesis, // Return synthesis for UI debug if needed
      _debug: {
        newFlowUsed: isNewFlowSuccessful,
        skipAI,
        geminiAvailable,
        youtubeAvailable,
        youtubeUsed,
        hasGeminiKey: !!process.env.GOOGLE_GEMINI_API_KEY,
        hasYouTubeKey: !!process.env.YOUTUBE_API_KEY,
        searchQueriesGenerated: searchQueries.length,
      }
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

/**
 * Extract speaker name from YouTube talk data
 * TED videos often format: "Title | Speaker" or "Speaker: Title"
 */
function extractSpeakerFromYouTube(talk: { title: string; speakerName?: string | null }): string {
  // If we have a speaker name that's not just the channel name, use it
  if (talk.speakerName && talk.speakerName !== 'TED' && talk.speakerName !== 'TEDx Talks') {
    return talk.speakerName;
  }

  // Try to parse from title: "Title | Speaker Name"
  const pipeMatch = talk.title.match(/\|\s*([^|]+)$/);
  if (pipeMatch) return pipeMatch[1].trim();

  // Try to parse from title: "Speaker Name: Title"
  const colonMatch = talk.title.match(/^([^:]+):/);
  if (colonMatch) return colonMatch[1].trim();

  return 'TED Speaker'; // Fallback
}
