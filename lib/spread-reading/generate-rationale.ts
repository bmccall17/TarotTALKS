/**
 * Rationale Generation for Spread Readings
 *
 * Generates explanatory text for why a talk was recommended for a spread.
 * Uses template-based generation by default, with Gemini AI enhancement
 * for high-intent users.
 */

import { generateSpreadRationale as geminiGenerate } from '@/lib/services/gemini';
import { SpreadCard, SpreadTalk, MatchReason, FocusType, POSITION_LABELS } from './types';

interface RationaleInput {
  cards: SpreadCard[];
  talk: SpreadTalk;
  matchReasons: MatchReason[];
  focusType?: FocusType;
  focusText?: string;
}

interface RationaleResult {
  rationale: string;
  source: 'template' | 'ai';
  model?: string;
}

/**
 * Generate a template-based rationale
 * Fast and free, used as default and fallback
 */
function generateTemplateRationale(input: RationaleInput): string {
  const { cards, talk, matchReasons } = input;

  // Opening: Link first card to talk
  const firstCard = cards[0];
  const templates = [
    `As ${firstCard.name} appears in your spread, "${talk.title}" offers a powerful perspective.`,
    `Your spread begins with ${firstCard.name}, and ${talk.speakerName}'s talk "${talk.title}" speaks directly to its themes.`,
    `${firstCard.name} sets the tone for your reading, and "${talk.title}" by ${talk.speakerName} deepens this message.`,
    `With ${firstCard.name} guiding you, ${talk.speakerName} offers wisdom in "${talk.title}".`,
  ];
  const opening = templates[Math.floor(Math.random() * templates.length)];

  // Middle: Describe the connection
  let middle = '';
  if (matchReasons.some(r => r.type === 'multi_card')) {
    const cardCount = matchReasons.find(r => r.type === 'multi_card')?.points === 10 ? 'all three' : 'multiple';
    middle = `This talk weaves together ${cardCount} cards in your spread. `;
  } else if (matchReasons.some(r => r.type === 'primary')) {
    middle = `This is a deeply aligned talk for your cards. `;
  } else if (matchReasons.some(r => r.type === 'theme')) {
    middle = `The themes resonate with the cards you've drawn. `;
  }

  // Closing: Encouragement
  const closings = [
    `Let ${talk.speakerName}'s words illuminate your path.`,
    `This talk may reveal what your cards are trying to show you.`,
    `Take what resonates and leave the rest.`,
    `Sometimes the right talk finds you at the right time.`,
  ];
  const closing = closings[Math.floor(Math.random() * closings.length)];

  return `${opening} ${middle}${closing}`;
}

/**
 * Determine if we should use AI for this reading
 */
function shouldUseAI(input: RationaleInput): boolean {
  // Use AI when:
  // 1. User provided custom focus text (high intent)
  // 2. Score is low and we need a more compelling rationale
  if (input.focusText && input.focusText.length > 10) {
    return true;
  }

  return false;
}

/**
 * Generate rationale with AI enhancement if appropriate
 */
export async function generateRationale(
  input: RationaleInput,
  forceAI: boolean = false
): Promise<RationaleResult> {
  const useAI = forceAI || shouldUseAI(input);

  if (!useAI) {
    return {
      rationale: generateTemplateRationale(input),
      source: 'template',
    };
  }

  // Try Gemini AI
  try {
    const cardParams = input.cards.map((card, index) => {
      let archetypes: string[] = [];
      let themes: string[] = [];

      try {
        if (card.archetypesJson) archetypes = JSON.parse(card.archetypesJson);
      } catch (e) {
        // Ignore parse error
      }

      try {
        if (card.themesJson) themes = JSON.parse(card.themesJson);
      } catch (e) {
        // Ignore parse error
      }

      return {
        name: card.name,
        summary: card.summary,
        position: POSITION_LABELS[index],
        archetypes,
        themes,
      };
    });

    const result = await geminiGenerate({
      cards: cardParams,
      talk: {
        title: input.talk.title,
        speakerName: input.talk.speakerName,
        description: input.talk.description,
      },
      focusText: input.focusText,
    });

    if (result.success) {
      return {
        rationale: result.text,
        source: 'ai',
        model: 'gemini-1.5-flash',
      };
    }

    // AI failed, fall back to template
    console.warn('Gemini failed, using template:', result.error);
    return {
      rationale: generateTemplateRationale(input),
      source: 'template',
    };
  } catch (error) {
    console.error('Error generating AI rationale:', error);
    return {
      rationale: generateTemplateRationale(input),
      source: 'template',
    };
  }
}

/**
 * Generate rationale for sharing (always tries AI first)
 */
export async function generateShareRationale(input: RationaleInput): Promise<RationaleResult> {
  return generateRationale(input, true);
}
