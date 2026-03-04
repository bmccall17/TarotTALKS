import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { Video, Link as LinkIcon, AlertTriangle, LayoutGrid, Sparkles, CheckCircle, AlertCircle, XCircle, Radio, Share2 } from 'lucide-react';
import { ApiHealthSection } from '@/components/admin/dashboard/ApiHealthSection';
import { PlatformQuotasSection } from '@/components/admin/dashboard/PlatformQuotasSection';

// Force dynamic rendering - admin page should not be statically generated
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  try {
    // ONE query for ALL dashboard stats (previous: ~23 queries, then 4, now 1)
    // Date computation done in SQL to avoid Drizzle parameter serialization issues
    const result = await db.execute<{
      cards_count: number;
      mappings_count: number;
      primary_mappings: number;
      themes_count: number;
      card_themes_count: number;
      talk_themes_count: number;
      cards_without_primary: number;
      unmapped_talks: number;
      talks_total: number;
      talks_deleted: number;
      talks_with_youtube: number;
      talks_without_thumbnail: number;
      shares_total: number;
      shares_today: number;
      shares_this_week: number;
      shared_cards: number;
      unposted_overall: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM cards) AS cards_count,
        (SELECT COUNT(*)::int FROM card_talk_mappings) AS mappings_count,
        (SELECT COUNT(*)::int FROM card_talk_mappings WHERE is_primary = true) AS primary_mappings,
        (SELECT COUNT(*)::int FROM themes) AS themes_count,
        (SELECT COUNT(*)::int FROM card_themes) AS card_themes_count,
        (SELECT COUNT(*)::int FROM talk_themes) AS talk_themes_count,
        (SELECT COUNT(*)::int FROM cards c WHERE NOT EXISTS (
          SELECT 1 FROM card_talk_mappings m WHERE m.card_id = c.id AND m.is_primary = true
        )) AS cards_without_primary,
        (SELECT COUNT(*)::int FROM talks t WHERE t.is_deleted = false AND NOT EXISTS (
          SELECT 1 FROM card_talk_mappings m WHERE m.talk_id = t.id
        )) AS unmapped_talks,
        (SELECT COUNT(*)::int FROM talks WHERE is_deleted = false) AS talks_total,
        (SELECT COUNT(*)::int FROM talks WHERE is_deleted = true) AS talks_deleted,
        (SELECT COUNT(*)::int FROM talks WHERE is_deleted = false AND youtube_video_id IS NOT NULL) AS talks_with_youtube,
        (SELECT COUNT(*)::int FROM talks WHERE is_deleted = false AND thumbnail_url IS NULL) AS talks_without_thumbnail,
        (SELECT COUNT(*)::int FROM social_shares) AS shares_total,
        (SELECT COUNT(*)::int FROM social_shares WHERE posted_at >= CURRENT_DATE) AS shares_today,
        (SELECT COUNT(*)::int FROM social_shares WHERE posted_at >= CURRENT_DATE - INTERVAL '7 days') AS shares_this_week,
        (SELECT COUNT(DISTINCT card_id)::int FROM social_shares WHERE card_id IS NOT NULL) AS shared_cards,
        (SELECT COUNT(*)::int FROM cards c2 WHERE NOT EXISTS (
          SELECT 1 FROM social_shares ss WHERE ss.card_id = c2.id
        )) AS unposted_overall
    `);

    const dc = result[0];

  const talksTotal = Number(dc?.talks_total ?? 0);
  const talksDeleted = Number(dc?.talks_deleted ?? 0);
  const talksWithYoutube = Number(dc?.talks_with_youtube ?? 0);
  const talksWithoutThumbnail = Number(dc?.talks_without_thumbnail ?? 0);

  const stats = {
    cards: Number(dc?.cards_count ?? 0),
    talks: talksTotal,
    activeTalks: talksTotal - talksDeleted,
    mappings: Number(dc?.mappings_count ?? 0),
    primaryMappings: Number(dc?.primary_mappings ?? 0),
    themes: Number(dc?.themes_count ?? 0),
    cardThemeLinks: Number(dc?.card_themes_count ?? 0),
    talkThemeLinks: Number(dc?.talk_themes_count ?? 0),
    deletedTalks: talksDeleted,
    talksWithYoutube,
    talksWithoutThumbnail,
    // Share stats
    totalShares: Number(dc?.shares_total ?? 0),
    sharesToday: Number(dc?.shares_today ?? 0),
    sharesThisWeek: Number(dc?.shares_this_week ?? 0),
    sharedCards: Number(dc?.shared_cards ?? 0),
    unpostedCards: Number(dc?.unposted_overall ?? 0),
  };

  const validation = {
    cardsWithoutPrimary: Number(dc?.cards_without_primary ?? 0),
    unmappedTalks: Number(dc?.unmapped_talks ?? 0),
    missingThumbnails: talksWithoutThumbnail,
    softDeleted: talksDeleted,
  };

  const totalIssues = validation.cardsWithoutPrimary + validation.unmappedTalks + validation.missingThumbnails;

  // Determine health status with explicit Tailwind classes
  const getHealthStatus = () => {
    if (totalIssues === 0) return {
      icon: CheckCircle,
      text: 'All Clear',
      bgClass: 'bg-green-500/10',
      borderClass: 'border-green-500/30',
      textClass: 'text-green-400'
    };
    if (totalIssues <= 5) return {
      icon: AlertCircle,
      text: 'Minor Issues',
      bgClass: 'bg-yellow-500/10',
      borderClass: 'border-yellow-500/30',
      textClass: 'text-yellow-400'
    };
    return {
      icon: XCircle,
      text: 'Needs Attention',
      bgClass: 'bg-red-500/10',
      borderClass: 'border-red-500/30',
      textClass: 'text-red-400'
    };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-gray-400 mt-1">TarotTALKS Content Management</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${health.bgClass} border ${health.borderClass}`}>
            <HealthIcon className={`w-5 h-5 ${health.textClass}`} />
            <span className={`${health.textClass} font-medium`}>{health.text}</span>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <LayoutGrid className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-gray-400 text-sm font-medium">Cards</span>
            </div>
            <p className="text-3xl font-bold text-gray-100">{stats.cards}</p>
            <p className="text-xs text-gray-500 mt-1">Complete deck</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm font-medium">Talks</span>
            </div>
            <p className="text-3xl font-bold text-gray-100">{stats.activeTalks}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.deletedTalks > 0 ? `+${stats.deletedTalks} archived` : 'Active talks'}
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <LinkIcon className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-gray-400 text-sm font-medium">Mappings</span>
            </div>
            <p className="text-3xl font-bold text-gray-100">{stats.mappings}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.primaryMappings} primary</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-gray-400 text-sm font-medium">Themes</span>
            </div>
            <p className="text-3xl font-bold text-gray-100">{stats.themes}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.cardThemeLinks + stats.talkThemeLinks} links</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Share2 className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm font-medium">Shares</span>
            </div>
            <p className="text-3xl font-bold text-gray-100">{stats.totalShares}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.sharesToday > 0 ? `${stats.sharesToday} today` : 'Social posts tracked'}
            </p>
          </div>
        </div>

        {/* API Health Section */}
        <div className="mb-8">
          <ApiHealthSection />
        </div>

        {/* Platform Quotas Section */}
        <div className="mb-8">
          <PlatformQuotasSection />
        </div>

        {/* Quick Actions + Validation Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Quick Actions */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/admin/talks"
                className="flex items-center justify-between p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-gray-200 font-medium">Manage Talks</p>
                    <p className="text-xs text-gray-500">Add, edit, or remove TED talks</p>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 transition-colors">→</span>
              </Link>

              <Link
                href="/admin/mappings"
                className="flex items-center justify-between p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <LinkIcon className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-gray-200 font-medium">Manage Mappings</p>
                    <p className="text-xs text-gray-500">Connect cards to talks with rationale</p>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 transition-colors">→</span>
              </Link>

              <Link
                href="/admin/validation"
                className="flex items-center justify-between p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-gray-200 font-medium">Validation Dashboard</p>
                    <p className="text-xs text-gray-500">Review and fix data quality issues</p>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 transition-colors">→</span>
              </Link>

              <Link
                href="/admin/signal-deck"
                className="flex items-center justify-between p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Radio className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="text-gray-200 font-medium">Signal Deck</p>
                    <p className="text-xs text-gray-500">Track social media shares and engagement</p>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 transition-colors">→</span>
              </Link>
            </div>
          </div>

          {/* Validation Summary */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-100">Data Quality</h2>
              {totalIssues > 0 && (
                <Link
                  href="/admin/validation"
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all →
                </Link>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg">
                <span className="text-gray-400 text-sm">Cards without primary mapping</span>
                <span className={`font-semibold ${validation.cardsWithoutPrimary > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {validation.cardsWithoutPrimary}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg">
                <span className="text-gray-400 text-sm">Unmapped talks</span>
                <span className={`font-semibold ${validation.unmappedTalks > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {validation.unmappedTalks}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg">
                <span className="text-gray-400 text-sm">Missing thumbnails</span>
                <span className={`font-semibold ${validation.missingThumbnails > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {validation.missingThumbnails}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg">
                <span className="text-gray-400 text-sm">Archived talks</span>
                <span className="font-semibold text-gray-400">
                  {validation.softDeleted}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg">
                <span className="text-gray-400 text-sm">Cards not yet shared</span>
                <span className={`font-semibold ${stats.unpostedCards > 0 ? 'text-blue-400' : 'text-green-400'}`}>
                  {stats.unpostedCards}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Stats */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Content Coverage</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Primary Mappings</span>
                <span className="text-gray-300 text-sm font-medium">
                  {stats.primaryMappings}/{stats.cards}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(stats.primaryMappings / stats.cards) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((stats.primaryMappings / stats.cards) * 100)}% of cards
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">YouTube IDs</span>
                <span className="text-gray-300 text-sm font-medium">
                  {stats.talksWithYoutube}/{stats.activeTalks}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(stats.talksWithYoutube / stats.activeTalks) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((stats.talksWithYoutube / stats.activeTalks) * 100)}% of talks
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Thumbnails</span>
                <span className="text-gray-300 text-sm font-medium">
                  {stats.activeTalks - stats.talksWithoutThumbnail}/{stats.activeTalks}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${((stats.activeTalks - stats.talksWithoutThumbnail) / stats.activeTalks) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(((stats.activeTalks - stats.talksWithoutThumbnail) / stats.activeTalks) * 100)}% of talks
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Theme Links</span>
                <span className="text-gray-300 text-sm font-medium">
                  {stats.cardThemeLinks + stats.talkThemeLinks}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-500 rounded-full transition-all"
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.cardThemeLinks} cards, {stats.talkThemeLinks} talks
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Cards Shared</span>
                <span className="text-gray-300 text-sm font-medium">
                  {stats.sharedCards}/{stats.cards}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(stats.sharedCards / stats.cards) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((stats.sharedCards / stats.cards) * 100)}% of cards
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Dashboard Error</h1>
            <p className="text-gray-300 mb-4">Failed to load dashboard statistics.</p>
            <pre className="bg-gray-900 p-4 rounded text-sm text-gray-400 overflow-auto max-h-32">
              {error instanceof Error
                ? error.message.split('\n')[0].slice(0, 200)
                : 'Unknown error'}
            </pre>
            <div className="mt-4">
              <p className="text-gray-400 text-sm">Possible causes:</p>
              <ul className="list-disc list-inside text-gray-400 text-sm mt-2 space-y-1">
                <li>Database connection issue</li>
                <li>Missing POSTGRES_URL or DATABASE_URL environment variable</li>
                <li>Database query timeout</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
