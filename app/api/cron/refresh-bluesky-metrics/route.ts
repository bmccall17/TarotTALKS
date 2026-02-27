import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStaleBlueskyShares } from '@/lib/db/queries/admin-social-shares';
import { getMetricsFromUrl, extractAtUriFromPostUrl } from '@/lib/services/bluesky';
import { updateMetrics, updateShare } from '@/lib/db/queries/admin-social-shares';

const TIME_LIMIT_MS = 8500; // Stop processing at 8.5s to stay within Vercel's 10s timeout

/**
 * Refresh Bluesky engagement metrics for stale shares.
 * Called by:
 *  - Vercel Cron (weekly, Authorization: Bearer <CRON_SECRET>)
 *  - Admin UI "Refresh All" button (via HttpOnly admin_token cookie)
 */
export async function GET(request: Request) {
  // Auth: accept CRON_SECRET via header, or ADMIN_TOKEN via header or cookie
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('admin_token')?.value;

  const cronSecret = process.env.CRON_SECRET;
  const adminToken = process.env.ADMIN_TOKEN;

  const isValidCron = cronSecret && bearerToken === cronSecret;
  const isValidAdmin = adminToken && (bearerToken === adminToken || cookieToken === adminToken);

  if (!isValidCron && !isValidAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let refreshed = 0;
  let failed = 0;
  let atUriBackfilled = 0;
  let skippedTimeout = 0;

  try {
    const staleShares = await getStaleBlueskyShares();

    for (const share of staleShares) {
      // Time guard: stop if we're approaching the timeout
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        skippedTimeout = staleShares.length - refreshed - failed;
        break;
      }

      try {
        // Backfill atUri if missing (one-time per share)
        if (!share.atUri && share.postUrl) {
          const atUri = await extractAtUriFromPostUrl(share.postUrl);
          if (atUri) {
            await updateShare(share.id, { atUri });
            atUriBackfilled++;
          }
        }

        // Fetch current metrics from Bluesky
        if (!share.postUrl) {
          failed++;
          continue;
        }

        const metrics = await getMetricsFromUrl(share.postUrl);
        if (!metrics) {
          failed++;
          continue;
        }

        await updateMetrics(share.id, {
          likeCount: metrics.likeCount,
          repostCount: metrics.repostCount,
          replyCount: metrics.replyCount,
          source: 'auto',
        });
        refreshed++;
      } catch (err) {
        console.error(`[Cron] Failed to refresh share ${share.id}:`, err);
        failed++;
      }
    }

    const elapsedMs = Date.now() - startTime;

    return NextResponse.json({
      refreshed,
      failed,
      atUriBackfilled,
      skippedTimeout,
      total: staleShares.length,
      elapsedMs,
    });
  } catch (err) {
    console.error('[Cron] Bluesky metrics refresh failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
