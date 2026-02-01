/**
 * Talk Scoring Algorithm for Spread Reading
 *
 * Scores talks based on how well they match a spread of cards.
 * Points distribution (0-50 total):
 *   1. MAPPING STRENGTH (0-15): Sum of strength ratings for mapped cards
 *   2. MULTI-CARD BONUS (0-10): +5 for 2 cards, +10 for 3 cards matched
 *   3. THEME OVERLAP (0-10): Compare talk.themes_json with card themes
 *   4. PRIMARY TALK BONUS (0-5): If talk is primary for any spread card
 *   5. FOCUS MATCH (0-5): Focus type matches talk themes
 *   6. KEYWORD MATCH (0-5): Custom focus text matches talk content
 */

import {
  SpreadCard,
  SpreadTalk,
  CardTalkMapping,
  ScoredTalk,
  MatchReason,
  FocusType,
  FOCUS_THEMES,
} from './types';

interface ScoreConfig {
  cards: SpreadCard[];
  mappings: CardTalkMapping[];
  focusType?: FocusType;
  focusText?: string;
}

/**
 * Score a single talk against a spread
 */
function scoreTalk(talk: SpreadTalk, config: ScoreConfig): ScoredTalk {
  const { cards, mappings, focusType, focusText } = config;
  const matchReasons: MatchReason[] = [];
  let totalScore = 0;

  // Get mappings for this talk
  const cardIds = new Set(cards.map(c => c.id));
  const talkMappings = mappings.filter(m =>
    m.talkId === talk.id && cardIds.has(m.cardId)
  );

  // 1. MAPPING STRENGTH (0-15 points)
  // Sum strength ratings for all cards mapped to this talk
  const mappingStrengthSum = talkMappings.reduce((sum, m) => sum + m.strength, 0);
  const mappingScore = Math.min(mappingStrengthSum, 15); // Cap at 15
  if (mappingScore > 0) {
    totalScore += mappingScore;
    matchReasons.push({
      type: 'mapping',
      description: `Mapped to ${talkMappings.length} card(s) with combined strength ${mappingStrengthSum}`,
      points: mappingScore,
    });
  }

  // 2. MULTI-CARD BONUS (0-10 points)
  // Bonus for talks that connect multiple cards
  const uniqueCardsMatched = new Set(talkMappings.map(m => m.cardId)).size;
  if (uniqueCardsMatched >= 3) {
    totalScore += 10;
    matchReasons.push({
      type: 'multi_card',
      description: 'Connects all 3 cards in your spread',
      points: 10,
    });
  } else if (uniqueCardsMatched === 2) {
    totalScore += 5;
    matchReasons.push({
      type: 'multi_card',
      description: 'Connects 2 cards in your spread',
      points: 5,
    });
  }

  // 3. THEME OVERLAP (0-10 points)
  // Compare talk themes with card themes
  const talkThemes = parseThemes(talk.themesJson);
  const cardThemes = cards.flatMap(c => parseThemes(c.themesJson));
  const themeOverlap = countOverlap(talkThemes, cardThemes);
  const themeScore = Math.min(themeOverlap * 2, 10); // 2 points per overlap, cap at 10
  if (themeScore > 0) {
    totalScore += themeScore;
    matchReasons.push({
      type: 'theme',
      description: `Shares ${themeOverlap} thematic connection${themeOverlap > 1 ? 's' : ''} with your cards`,
      points: themeScore,
    });
  }

  // 4. PRIMARY TALK BONUS (0-5 points)
  // If this talk is the primary for any card in the spread
  const isPrimary = talkMappings.some(m => m.isPrimary);
  if (isPrimary) {
    totalScore += 5;
    matchReasons.push({
      type: 'primary',
      description: 'Primary talk for one of your cards',
      points: 5,
    });
  }

  // 5. FOCUS MATCH (0-5 points)
  // If focus type themes match talk themes
  if (focusType && focusType !== 'surprise_me' && focusType !== 'custom') {
    const focusThemes = FOCUS_THEMES[focusType];
    const focusOverlap = countOverlapWithText(focusThemes, [
      ...talkThemes,
      talk.title.toLowerCase(),
      (talk.description || '').toLowerCase(),
      (talk.coreMessage || '').toLowerCase(),
    ]);
    const focusScore = Math.min(focusOverlap * 2, 5);
    if (focusScore > 0) {
      totalScore += focusScore;
      matchReasons.push({
        type: 'focus',
        description: `Aligns with your ${focusType.replace('_', ' ')} focus`,
        points: focusScore,
      });
    }
  }

  // 6. KEYWORD MATCH (0-5 points)
  // Custom focus text matches talk content
  if (focusText && focusText.length > 3) {
    const keywords = extractKeywords(focusText);
    const talkContent = [
      talk.title.toLowerCase(),
      (talk.description || '').toLowerCase(),
      (talk.coreMessage || '').toLowerCase(),
      ...talkThemes,
    ].join(' ');

    const keywordMatches = keywords.filter(k => talkContent.includes(k)).length;
    const keywordScore = Math.min(keywordMatches, 5);
    if (keywordScore > 0) {
      totalScore += keywordScore;
      matchReasons.push({
        type: 'keyword',
        description: `Matches ${keywordMatches} keyword${keywordMatches > 1 ? 's' : ''} from your focus`,
        points: keywordScore,
      });
    }
  }

  return {
    talk,
    score: totalScore,
    matchReasons,
  };
}

/**
 * Score all talks and return sorted results
 */
export function scoreTalksForSpread(
  cards: SpreadCard[],
  talks: SpreadTalk[],
  mappings: CardTalkMapping[],
  focusType?: FocusType,
  focusText?: string
): ScoredTalk[] {
  const config: ScoreConfig = { cards, mappings, focusType, focusText };

  const scored = talks.map(talk => scoreTalk(talk, config));

  // Sort by score descending
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Get the top talk recommendation
 * Returns top talk, or multiple options if score is low
 */
export function getTopRecommendation(scoredTalks: ScoredTalk[]): {
  type: 'single' | 'multiple_options';
  primary: ScoredTalk;
  alternatives?: ScoredTalk[];
} {
  if (scoredTalks.length === 0) {
    throw new Error('No talks available for scoring');
  }

  const topTalk = scoredTalks[0];

  // If score is very low, return multiple options
  if (topTalk.score < 10 && scoredTalks.length > 1) {
    return {
      type: 'multiple_options',
      primary: topTalk,
      alternatives: scoredTalks.slice(1, 3), // Top 2 alternatives
    };
  }

  return {
    type: 'single',
    primary: topTalk,
  };
}

// Helper functions

function parseThemes(themesJson: string | null | undefined): string[] {
  if (!themesJson) return [];
  try {
    const parsed = JSON.parse(themesJson);
    return Array.isArray(parsed) ? parsed.map(t => String(t).toLowerCase()) : [];
  } catch {
    return [];
  }
}

function countOverlap(arr1: string[], arr2: string[]): number {
  const set1 = new Set(arr1);
  return arr2.filter(item => set1.has(item)).length;
}

function countOverlapWithText(keywords: string[], textSources: string[]): number {
  const combinedText = textSources.join(' ').toLowerCase();
  return keywords.filter(k => combinedText.includes(k.toLowerCase())).length;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction: split by spaces, filter short words and common words
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'with', 'they', 'been', 'have', 'this', 'will', 'your', 'from', 'about', 'what', 'how', 'more']);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
}
