import { db } from '../index';
import { talks, cards, cardTalkMappings, socialShares } from '../schema';
import { eq, and, sql, isNull, or, lt, count } from 'drizzle-orm';
import { isSupabaseStorageUrl } from '@/lib/supabase';

/**
 * Validation Issues Interface
 */
export interface ValidationIssues {
  // Critical
  duplicateYoutubeIds: Array<{
    youtubeVideoId: string;
    talks: Array<{ id: string; title: string; speakerName: string; slug: string }>;
  }>;

  // Important
  missingBothUrls: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    thumbnailUrl: string | null;
  }>;
  missingThumbnails: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    thumbnailUrl: string | null;
  }>;
  externalThumbnails: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    thumbnailUrl: string | null;
  }>;
  shortDescriptions: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    description: string | null;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    thumbnailUrl: string | null;
  }>;

  // Mapping Issues
  cardsWithoutPrimaryMapping: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    mappingsCount: number;
  }>;
  talksNotMappedToAnyCard: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    thumbnailUrl: string | null;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
  }>;
  mappingsMissingLongRationale: Array<{
    mappingId: string;
    cardId: string;
    cardName: string;
    cardSlug: string;
    cardImageUrl: string;
    talkId: string;
    talkTitle: string;
    talkSpeakerName: string;
    talkSlug: string;
    rationaleShort: string | null;
  }>;

  // Info
  softDeletedTalks: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    deletedAt: Date | null;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    thumbnailUrl: string | null;
  }>;
  youtubeOnlyTalks: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    tedUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    thumbnailUrl: string | null;
  }>;
  missingSocialHandles: Array<{
    id: string;
    title: string;
    speakerName: string;
    slug: string;
    speakerTwitterHandle: string | null;
    speakerBlueskyHandle: string | null;
    tedUrl: string | null;
    youtubeUrl: string | null;
  }>;
  unpostedCards: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    sequenceIndex: number;
  }>;
}

/**
 * Get all validation issues
 * Runs queries sequentially to avoid connection pool exhaustion on Vercel Postgres
 */
export async function getValidationIssues(): Promise<ValidationIssues> {
  const duplicateYoutubeIds = await getDuplicateYoutubeIds();
  const missingBothUrls = await getMissingBothUrls();
  const missingThumbnails = await getMissingThumbnails();
  const externalThumbnails = await getExternalThumbnails();
  const shortDescriptions = await getShortDescriptions();
  const cardsWithoutPrimaryMapping = await getCardsWithoutPrimaryMapping();
  const talksNotMappedToAnyCard = await getTalksNotMappedToAnyCard();
  const mappingsMissingLongRationale = await getMappingsMissingLongRationale();
  const softDeletedTalks = await getSoftDeletedTalks();
  const youtubeOnlyTalks = await getYoutubeOnlyTalks();
  const missingSocialHandles = await getMissingSocialHandles();
  const unpostedCards = await getUnpostedCardsForValidation();

  return {
    duplicateYoutubeIds,
    missingBothUrls,
    missingThumbnails,
    externalThumbnails,
    shortDescriptions,
    cardsWithoutPrimaryMapping,
    talksNotMappedToAnyCard,
    mappingsMissingLongRationale,
    softDeletedTalks,
    youtubeOnlyTalks,
    missingSocialHandles,
    unpostedCards,
  };
}

/**
 * Get duplicate YouTube video IDs
 * Runs queries sequentially to avoid connection pool exhaustion
 */
async function getDuplicateYoutubeIds() {
  // First, find YouTube IDs that appear more than once
  const duplicates = await db
    .select({
      youtubeVideoId: talks.youtubeVideoId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        sql`${talks.youtubeVideoId} IS NOT NULL`
      )
    )
    .groupBy(talks.youtubeVideoId)
    .having(sql`COUNT(*) > 1`);

  // For each duplicate, get the talks sequentially
  const result = [];
  for (const dup of duplicates) {
    const affectedTalks = await db
      .select({
        id: talks.id,
        title: talks.title,
        speakerName: talks.speakerName,
        slug: talks.slug,
      })
      .from(talks)
      .where(
        and(
          eq(talks.isDeleted, false),
          eq(talks.youtubeVideoId, dup.youtubeVideoId!)
        )
      );

    result.push({
      youtubeVideoId: dup.youtubeVideoId!,
      talks: affectedTalks,
    });
  }

  return result;
}

/**
 * Get talks missing both URLs (should not happen with CHECK constraint)
 */
async function getMissingBothUrls() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
      thumbnailUrl: talks.thumbnailUrl,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        isNull(talks.tedUrl),
        isNull(talks.youtubeUrl)
      )
    )
    .orderBy(talks.title);
}

/**
 * Get talks missing thumbnails
 */
async function getMissingThumbnails() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
      thumbnailUrl: talks.thumbnailUrl,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        or(isNull(talks.thumbnailUrl), eq(talks.thumbnailUrl, ''))
      )
    )
    .orderBy(talks.title);
}

/**
 * Get talks with external thumbnail URLs (not in Supabase Storage)
 * These need to be uploaded to Supabase for reliability
 */
async function getExternalThumbnails() {
  // First, get all talks with external URLs
  const allExternalThumbnails = await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
      thumbnailUrl: talks.thumbnailUrl,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        sql`${talks.thumbnailUrl} IS NOT NULL`,
        sql`${talks.thumbnailUrl} != ''`,
        // External URLs start with http:// or https://
        sql`(${talks.thumbnailUrl} LIKE 'http://%' OR ${talks.thumbnailUrl} LIKE 'https://%')`
      )
    )
    .orderBy(talks.title);

  // Filter out Supabase Storage URLs (those are already uploaded)
  return allExternalThumbnails.filter(
    (talk) => !isSupabaseStorageUrl(talk.thumbnailUrl)
  );
}

/**
 * Get talks with short or missing descriptions
 */
async function getShortDescriptions() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      description: talks.description,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
      thumbnailUrl: talks.thumbnailUrl,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        or(
          isNull(talks.description),
          sql`LENGTH(${talks.description}) < 50`
        )
      )
    )
    .orderBy(talks.title);
}

/**
 * Get cards without a primary mapping
 */
async function getCardsWithoutPrimaryMapping() {
  return await db
    .select({
      id: cards.id,
      name: cards.name,
      slug: cards.slug,
      imageUrl: cards.imageUrl,
      mappingsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${cardTalkMappings}
        WHERE ${cardTalkMappings.cardId} = ${cards.id}
      )`,
    })
    .from(cards)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${cardTalkMappings}
        WHERE ${cardTalkMappings.cardId} = ${cards.id}
        AND ${cardTalkMappings.isPrimary} = true
      )`
    )
    .orderBy(cards.sequenceIndex);
}

/**
 * Get talks not mapped to any card
 */
async function getTalksNotMappedToAnyCard() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      thumbnailUrl: talks.thumbnailUrl,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        sql`NOT EXISTS (
          SELECT 1 FROM ${cardTalkMappings}
          WHERE ${cardTalkMappings.talkId} = ${talks.id}
        )`
      )
    )
    .orderBy(talks.title);
}

/**
 * Get mappings that are missing long rationale
 */
async function getMappingsMissingLongRationale() {
  return await db
    .select({
      mappingId: cardTalkMappings.id,
      cardId: cardTalkMappings.cardId,
      cardName: cards.name,
      cardSlug: cards.slug,
      cardImageUrl: cards.imageUrl,
      talkId: cardTalkMappings.talkId,
      talkTitle: talks.title,
      talkSpeakerName: talks.speakerName,
      talkSlug: talks.slug,
      rationaleShort: cardTalkMappings.rationaleShort,
    })
    .from(cardTalkMappings)
    .innerJoin(cards, eq(cardTalkMappings.cardId, cards.id))
    .innerJoin(talks, eq(cardTalkMappings.talkId, talks.id))
    .where(
      and(
        eq(talks.isDeleted, false),
        or(
          isNull(cardTalkMappings.rationaleLong),
          sql`${cardTalkMappings.rationaleLong} = ''`
        )
      )
    )
    .orderBy(cards.sequenceIndex, talks.title);
}

/**
 * Get soft-deleted talks
 */
async function getSoftDeletedTalks() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      deletedAt: talks.deletedAt,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
      thumbnailUrl: talks.thumbnailUrl,
    })
    .from(talks)
    .where(eq(talks.isDeleted, true))
    .orderBy(talks.deletedAt);
}

/**
 * Get talks that only have YouTube URL (no TED URL)
 */
async function getYoutubeOnlyTalks() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
      youtubeVideoId: talks.youtubeVideoId,
      thumbnailUrl: talks.thumbnailUrl,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        isNull(talks.tedUrl),
        sql`${talks.youtubeUrl} IS NOT NULL`
      )
    )
    .orderBy(talks.title);
}

/**
 * Get talks missing social media handles (Tag Pack)
 */
async function getMissingSocialHandles() {
  return await db
    .select({
      id: talks.id,
      title: talks.title,
      speakerName: talks.speakerName,
      slug: talks.slug,
      speakerTwitterHandle: talks.speakerTwitterHandle,
      speakerBlueskyHandle: talks.speakerBlueskyHandle,
      tedUrl: talks.tedUrl,
      youtubeUrl: talks.youtubeUrl,
    })
    .from(talks)
    .where(
      and(
        eq(talks.isDeleted, false),
        or(
          isNull(talks.speakerTwitterHandle),
          isNull(talks.speakerBlueskyHandle)
        )
      )
    )
    .orderBy(talks.speakerName);
}

/**
 * Get cards that have never been shared on social media
 */
async function getUnpostedCardsForValidation() {
  return await db
    .select({
      id: cards.id,
      name: cards.name,
      slug: cards.slug,
      imageUrl: cards.imageUrl,
      sequenceIndex: cards.sequenceIndex,
    })
    .from(cards)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${socialShares}
        WHERE ${socialShares.cardId} = ${cards.id}
      )`
    )
    .orderBy(cards.sequenceIndex);
}

/**
 * Get validation summary counts
 */
export async function getValidationSummary() {
  const issues = await getValidationIssues();

  return {
    critical: issues.duplicateYoutubeIds.length,
    important:
      issues.missingBothUrls.length +
      issues.missingThumbnails.length +
      issues.externalThumbnails.length +
      issues.shortDescriptions.length,
    mappings:
      issues.cardsWithoutPrimaryMapping.length +
      issues.talksNotMappedToAnyCard.length +
      issues.mappingsMissingLongRationale.length,
    info: issues.softDeletedTalks.length + issues.missingSocialHandles.length + issues.unpostedCards.length,
    total:
      issues.duplicateYoutubeIds.length +
      issues.missingBothUrls.length +
      issues.missingThumbnails.length +
      issues.externalThumbnails.length +
      issues.shortDescriptions.length +
      issues.cardsWithoutPrimaryMapping.length +
      issues.talksNotMappedToAnyCard.length +
      issues.mappingsMissingLongRationale.length +
      issues.softDeletedTalks.length +
      issues.missingSocialHandles.length +
      issues.unpostedCards.length,
    details: {
      duplicateYoutubeIds: issues.duplicateYoutubeIds.length,
      missingBothUrls: issues.missingBothUrls.length,
      missingThumbnails: issues.missingThumbnails.length,
      externalThumbnails: issues.externalThumbnails.length,
      shortDescriptions: issues.shortDescriptions.length,
      cardsWithoutPrimaryMapping: issues.cardsWithoutPrimaryMapping.length,
      talksNotMappedToAnyCard: issues.talksNotMappedToAnyCard.length,
      mappingsMissingLongRationale: issues.mappingsMissingLongRationale.length,
      softDeletedTalks: issues.softDeletedTalks.length,
      missingSocialHandles: issues.missingSocialHandles.length,
      unpostedCards: issues.unpostedCards.length,
    },
  };
}
