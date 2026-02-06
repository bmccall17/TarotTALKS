import { db } from '../index';
import { socialShares } from '../schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

export type PublicShare = {
  platform: 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram';
  postUrl: string;
  postedAt: Date;
};

export async function getPublicSharesForCard(cardId: string): Promise<PublicShare[]> {
  const rows = await db
    .select({
      platform: socialShares.platform,
      postUrl: socialShares.postUrl,
      postedAt: socialShares.postedAt,
    })
    .from(socialShares)
    .where(
      and(
        eq(socialShares.showPublicly, true),
        eq(socialShares.cardId, cardId),
        isNotNull(socialShares.postUrl)
      )
    )
    .orderBy(desc(socialShares.postedAt))
    .limit(10);

  return rows.filter(
    (r): r is PublicShare => r.postUrl !== null && r.platform !== 'other'
  );
}

export async function getPublicSharesForTalk(talkId: string): Promise<PublicShare[]> {
  const rows = await db
    .select({
      platform: socialShares.platform,
      postUrl: socialShares.postUrl,
      postedAt: socialShares.postedAt,
    })
    .from(socialShares)
    .where(
      and(
        eq(socialShares.showPublicly, true),
        eq(socialShares.talkId, talkId),
        isNotNull(socialShares.postUrl)
      )
    )
    .orderBy(desc(socialShares.postedAt))
    .limit(10);

  return rows.filter(
    (r): r is PublicShare => r.postUrl !== null && r.platform !== 'other'
  );
}
