import { pgTable, text, integer, boolean, timestamp, uuid, varchar, pgEnum, bigint, index, jsonb, real } from 'drizzle-orm/pg-core';

// Enums
export const arcanaTypeEnum = pgEnum('arcana_type', ['major', 'minor']);
export const suitEnum = pgEnum('suit', ['wands', 'cups', 'swords', 'pentacles']);
export const themeCategoryEnum = pgEnum('theme_category', ['emotion', 'life_phase', 'role', 'other']);
export const platformEnum = pgEnum('platform', ['x', 'bluesky', 'threads', 'linkedin', 'instagram', 'other']);
export const shareStatusEnum = pgEnum('share_status', ['draft', 'posted', 'verified', 'discovered', 'acknowledged']);

// Spread reading enums (0009_spreads.sql)
export const focusTypeEnum = pgEnum('focus_type', [
  'relationships', 'work', 'courage', 'grief',
  'creativity', 'money', 'identity', 'surprise_me', 'custom'
]);
export const privacyLevelEnum = pgEnum('privacy_level', ['full', 'cards_only', 'cards_and_talk']);

// Cards table
export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  arcanaType: arcanaTypeEnum('arcana_type').notNull(),
  suit: suitEnum('suit'),
  number: integer('number'),
  sequenceIndex: integer('sequence_index').notNull(),
  imageUrl: text('image_url').notNull(),
  keywords: text('keywords').notNull(), // JSON array as string
  summary: text('summary').notNull(),
  uprightMeaning: text('upright_meaning'),
  reversedMeaning: text('reversed_meaning'),
  symbolism: text('symbolism'),
  adviceWhenDrawn: text('advice_when_drawn'),
  journalingPrompts: text('journaling_prompts'), // JSON array as string
  astrologicalCorrespondence: text('astrological_correspondence'),
  numerologicalSignificance: text('numerological_significance'),
  // Spread reading enrichment (0008_spread_enrichment.sql)
  themesJson: text('themes_json'),
  archetypesJson: text('archetypes_json'),
  meaningAwareSelf: text('meaning_aware_self'),
  meaningSupportingShadow: text('meaning_supporting_shadow'),
  meaningEmergingPath: text('meaning_emerging_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Talks table
export const talks = pgTable('talks', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 200 }).notNull().unique(),
  title: varchar('title', { length: 300 }).notNull(),
  speakerName: varchar('speaker_name', { length: 200 }).notNull(),
  tedUrl: text('ted_url'), // TED.com URL only, nullable if not on TED
  youtubeUrl: text('youtube_url'), // Full YouTube URL, nullable
  youtubeVideoId: varchar('youtube_video_id', { length: 20 }), // For metadata fetching
  description: text('description'),
  durationSeconds: integer('duration_seconds'),
  eventName: varchar('event_name', { length: 200 }),
  year: integer('year'),
  thumbnailUrl: text('thumbnail_url'),
  language: varchar('language', { length: 10 }),
  // Social Media Handles (Tag Pack)
  speakerTwitterHandle: varchar('speaker_twitter_handle', { length: 50 }),
  speakerBlueskyHandle: varchar('speaker_bluesky_handle', { length: 100 }),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  // Spread reading enrichment (0008_spread_enrichment.sql)
  themesJson: text('themes_json'),
  coreMessage: text('core_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Card-Talk Mappings table
export const cardTalkMappings = pgTable('card_talk_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id').references(() => cards.id, { onDelete: 'cascade' }).notNull(),
  talkId: uuid('talk_id').references(() => talks.id, { onDelete: 'cascade' }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  strength: integer('strength').notNull(), // 1-5
  rationaleShort: text('rationale_short').notNull(),
  rationaleLong: text('rationale_long'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Themes table
export const themes = pgTable('themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  shortDescription: text('short_description').notNull(),
  longDescription: text('long_description'),
  category: themeCategoryEnum('category'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Card-Themes join table
export const cardThemes = pgTable('card_themes', {
  cardId: uuid('card_id').references(() => cards.id, { onDelete: 'cascade' }).notNull(),
  themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'cascade' }).notNull(),
});

// Talk-Themes join table
export const talkThemes = pgTable('talk_themes', {
  talkId: uuid('talk_id').references(() => talks.id, { onDelete: 'cascade' }).notNull(),
  themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'cascade' }).notNull(),
});

// Behavior Events table (for analytics)
export const behaviorEvents = pgTable('behavior_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: varchar('session_id', { length: 12 }).notNull(),
  eventName: varchar('event_name', { length: 50 }).notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  properties: text('properties').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxEventsSession: index('idx_events_session').on(table.sessionId),
  idxEventsNameTime: index('idx_events_name_time').on(table.eventName, table.timestamp),
  idxEventsCreated: index('idx_events_created').on(table.createdAt),
}));

// Social Shares table (Signal Deck - manual share tracking)
export const socialShares = pgTable('social_shares', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Core fields
  platform: platformEnum('platform').notNull(),
  postUrl: varchar('post_url', { length: 500 }),
  status: shareStatusEnum('status').default('posted').notNull(),
  postedAt: timestamp('posted_at').defaultNow().notNull(),

  // What was shared (optional FK refs)
  cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
  talkId: uuid('talk_id').references(() => talks.id, { onDelete: 'set null' }),
  sharedUrl: varchar('shared_url', { length: 500 }), // the TarotTALKS URL shared

  // Speaker tracking
  speakerHandle: varchar('speaker_handle', { length: 100 }),
  speakerName: varchar('speaker_name', { length: 200 }),

  // Notes
  notes: text('notes'),

  // Phase 2: Metrics
  likeCount: integer('like_count').default(0),
  repostCount: integer('repost_count').default(0),
  replyCount: integer('reply_count').default(0),
  metricsUpdatedAt: timestamp('metrics_updated_at'),
  // NOTE: metricsSource column requires migration 0007_multi_platform_signal_deck.sql
  // Uncomment after running migration:
  // metricsSource: varchar('metrics_source', { length: 20 }).default('auto'),

  // Phase 3: Relationship tracking
  followingSpeaker: boolean('following_speaker'),
  relationshipUpdatedAt: timestamp('relationship_updated_at'),

  // Phase 4: Mention discovery
  discoveredAt: timestamp('discovered_at'),
  atUri: varchar('at_uri', { length: 500 }),
  authorDid: varchar('author_did', { length: 100 }),
  authorHandle: varchar('author_handle', { length: 100 }),
  authorDisplayName: varchar('author_display_name', { length: 200 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxPostedAt: index('idx_social_shares_posted_at').on(table.postedAt),
  idxPlatform: index('idx_social_shares_platform').on(table.platform),
  idxStatus: index('idx_social_shares_status').on(table.status),
  idxAtUri: index('idx_social_shares_at_uri').on(table.atUri),
}));

// API Usage Events table (API health monitoring + cost tracking)
export const apiUsageEvents = pgTable('api_usage_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiName: varchar('api_name', { length: 20 }).notNull(), // 'gemini' | 'youtube'
  success: boolean('success').notNull(),
  errorType: varchar('error_type', { length: 30 }), // 'rate_limit', 'quota_exceeded', 'network', 'api_error'
  sessionId: varchar('session_id', { length: 12 }), // Links to user session for attribution
  source: varchar('source', { length: 30 }).notNull(), // 'spread_reading', etc.
  properties: text('properties').default('{}'),
  // Token and cost tracking (Gemini paid tier)
  inputTokens: integer('input_tokens'), // Prompt tokens
  outputTokens: integer('output_tokens'), // Completion tokens
  costUsd: real('cost_usd'), // Cost in USD (e.g., 0.0025 for $0.0025)
  modelId: varchar('model_id', { length: 50 }), // e.g., 'gemini-1.5-pro'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxApiName: index('idx_api_usage_api_name').on(table.apiName),
  idxCreated: index('idx_api_usage_created').on(table.createdAt),
  idxSuccess: index('idx_api_usage_success').on(table.success),
  idxSession: index('idx_api_usage_session').on(table.sessionId),
}));

// Spreads table (Read My Spread feature - 0009_spreads.sql)
export const spreads = pgTable('spreads', {
  id: uuid('id').defaultRandom().primaryKey(),
  shortId: varchar('short_id', { length: 12 }).notNull().unique(),

  // Cards (ordered by position: 1=Aware Self, 2=Supporting Shadow, 3=Emerging Path)
  card1Id: uuid('card_1_id').references(() => cards.id, { onDelete: 'set null' }),
  card2Id: uuid('card_2_id').references(() => cards.id, { onDelete: 'set null' }),
  card3Id: uuid('card_3_id').references(() => cards.id, { onDelete: 'set null' }),

  // User input
  focusType: focusTypeEnum('focus_type'),
  focusText: text('focus_text'),

  // Generated result
  talkId: uuid('talk_id').references(() => talks.id, { onDelete: 'set null' }),
  rationale: text('rationale').notNull(),
  rationaleSource: varchar('rationale_source', { length: 20 }).default('template'),
  aiModel: varchar('ai_model', { length: 50 }),
  score: integer('score'),
  matchReasons: jsonb('match_reasons'),

  // Privacy
  privacyLevel: privacyLevelEnum('privacy_level').default('full'),

  // Cleanup tracking (for identifying orphaned spreads)
  viewCount: integer('view_count').default(0),
  lastViewedAt: timestamp('last_viewed_at'),
  isShared: boolean('is_shared').default(false),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxShortId: index('idx_spreads_short_id').on(table.shortId),
  idxCreatedAt: index('idx_spreads_created_at').on(table.createdAt),
  idxCard1: index('idx_spreads_card_1').on(table.card1Id),
  idxCard2: index('idx_spreads_card_2').on(table.card2Id),
  idxCard3: index('idx_spreads_card_3').on(table.card3Id),
  idxTalk: index('idx_spreads_talk').on(table.talkId),
}));
