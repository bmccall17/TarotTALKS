/**
 * Spread Reading Types
 */

// Position names for 3-card spread
export const POSITION_LABELS = ['Aware Self', 'Supporting Shadow', 'Emerging Path'] as const;
export type PositionLabel = typeof POSITION_LABELS[number];

// Focus types that users can select
export const FOCUS_TYPES = [
  'relationships',
  'work',
  'courage',
  'grief',
  'creativity',
  'money',
  'identity',
  'surprise_me',
  'custom',
] as const;
export type FocusType = typeof FOCUS_TYPES[number];

// Focus type labels for UI
export const FOCUS_TYPE_LABELS: Record<Exclude<FocusType, 'custom'>, string> = {
  relationships: 'Relationships',
  work: 'Work / Calling',
  courage: 'Courage / Change',
  grief: 'Grief / Healing',
  creativity: 'Creativity',
  money: 'Money / Stability',
  identity: 'Identity / Purpose',
  surprise_me: 'Surprise me',
};

// Focus type theme keywords (for scoring)
export const FOCUS_THEMES: Record<Exclude<FocusType, 'custom' | 'surprise_me'>, string[]> = {
  relationships: ['love', 'connection', 'family', 'partnership', 'community', 'trust', 'intimacy', 'belonging'],
  work: ['career', 'purpose', 'leadership', 'success', 'ambition', 'calling', 'profession', 'business'],
  courage: ['change', 'fear', 'bravery', 'transformation', 'risk', 'growth', 'resilience', 'challenge'],
  grief: ['loss', 'healing', 'sorrow', 'death', 'mourning', 'acceptance', 'letting go', 'grief'],
  creativity: ['art', 'imagination', 'innovation', 'expression', 'creation', 'inspiration', 'design', 'play'],
  money: ['wealth', 'finance', 'abundance', 'security', 'prosperity', 'stability', 'resources', 'material'],
  identity: ['self', 'authenticity', 'identity', 'purpose', 'meaning', 'values', 'who am I', 'becoming'],
};

// Privacy levels for shared spreads
export const PRIVACY_LEVELS = ['full', 'cards_only', 'cards_and_talk'] as const;
export type PrivacyLevel = typeof PRIVACY_LEVELS[number];

// Card data for spread reading
export interface SpreadCard {
  id: string;
  slug: string;
  name: string;
  summary: string;
  keywords: string[];
  themesJson?: string | null;
  archetypesJson?: string | null;
  imageUrl: string;
}

// Talk data for scoring
export interface SpreadTalk {
  id: string;
  slug: string;
  title: string;
  speakerName: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  themesJson?: string | null;
  coreMessage?: string | null;
}

// Card-talk mapping from database
export interface CardTalkMapping {
  cardId: string;
  talkId: string;
  isPrimary: boolean;
  strength: number; // 1-5
  rationaleShort: string;
}

// Scored talk result
export interface ScoredTalk {
  talk: SpreadTalk;
  score: number;
  matchReasons: MatchReason[];
}

// Reasons why a talk matched
export interface MatchReason {
  type: 'mapping' | 'multi_card' | 'theme' | 'primary' | 'focus' | 'keyword';
  description: string;
  points: number;
}

// Spread reading request
export interface SpreadReadingRequest {
  cardIds: string[]; // 2-3 card IDs in position order
  focusType?: FocusType;
  focusText?: string;
}

// Spread reading result
export interface SpreadReadingResult {
  type: 'single' | 'multiple_options';
  talk: SpreadTalk;
  rationale: string;
  rationaleSource: 'template' | 'ai';
  aiModel?: string;
  score: number;
  matchReasons: MatchReason[];
  alternativeTalks?: SpreadTalk[]; // For multiple_options type
}

// Saved spread record
export interface SavedSpread {
  id: string;
  shortId: string;
  cards: SpreadCard[];
  focusType?: FocusType;
  focusText?: string;
  talk: SpreadTalk;
  rationale: string;
  rationaleSource: 'template' | 'ai';
  score: number;
  matchReasons: MatchReason[];
  privacyLevel: PrivacyLevel;
  createdAt: Date;
}
