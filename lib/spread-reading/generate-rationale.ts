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
  const firstCard = cards[0];
  const hasMultiCard = matchReasons.some(r => r.type === 'multi_card');
  const isPrimary = matchReasons.some(r => r.type === 'primary');
  const hasThemeMatch = matchReasons.some(r => r.type === 'theme');

  // Full rationale templates - each is a complete, warm message
  // These avoid the formulaic "With X guiding you, Y offers wisdom in Z" pattern
  const fullTemplates: string[] = [];

  if (hasMultiCard) {
    const cardCount = matchReasons.find(r => r.type === 'multi_card')?.points === 10 ? 'all three of your cards' : 'the cards in your spread';
    fullTemplates.push(
      `${talk.speakerName}'s "${talk.title}" speaks to ${cardCount} in a way that feels almost uncanny. There's a thread here worth following.`,
      `Your cards drew "${talk.title}" into your reading. ${talk.speakerName} explores territory that touches each card you've pulled—see what lands.`,
      `"${talk.title}" emerged from your spread as a talk that bridges ${cardCount}. ${talk.speakerName} might have something you need to hear.`,
    );
  }

  if (isPrimary) {
    fullTemplates.push(
      `${firstCard.name} in your spread points directly to "${talk.title}" by ${talk.speakerName}. This pairing runs deep.`,
      `"${talk.title}" is a natural companion to ${firstCard.name}. ${talk.speakerName}'s perspective may illuminate what this card is asking of you.`,
      `When ${firstCard.name} appears, "${talk.title}" often follows. There's wisdom here that's meant for you.`,
    );
  }

  if (hasThemeMatch) {
    fullTemplates.push(
      `The themes in your spread echo through "${talk.title}." ${talk.speakerName} walks similar ground—give it a watch.`,
      `Your cards share a conversation with "${talk.title}" by ${talk.speakerName}. Something in this talk may speak to where you are.`,
    );
  }

  // Generic fallbacks that still feel warm
  fullTemplates.push(
    `${firstCard.name} opens your spread, and "${talk.title}" by ${talk.speakerName} carries that energy forward. See what resonates.`,
    `Your reading drew "${talk.title}" to the surface. ${talk.speakerName} explores questions your cards are raising—take what serves you.`,
    `"${talk.title}" rose from your spread for a reason. ${talk.speakerName}'s words might hold exactly what you need right now.`,
    `The cards suggest "${talk.title}" by ${talk.speakerName}. Sometimes the right talk finds you at the right moment.`,
  );

  return fullTemplates[Math.floor(Math.random() * fullTemplates.length)];
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
 * @param forceAI - Force AI generation even if not needed
 * @param skipAI - Force template generation, never use AI (for testing)
 */
export async function generateRationale(
  input: RationaleInput,
  forceAI: boolean = false,
  skipAI: boolean = false
): Promise<RationaleResult> {
  // If skipAI is set, always use template (test mode)
  if (skipAI) {
    return {
      rationale: generateTemplateRationale(input),
      source: 'template',
    };
  }

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
        model: 'gemini-2.0-flash',
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
