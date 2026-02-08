import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getThemeWithCardsAndTalks } from '@/lib/db/queries/themes';
import { getThumbnailUrl } from '@/lib/utils/thumbnails';
import { ArrowLeft, Sparkles, Play, ExternalLink } from 'lucide-react';
import { ShareButton } from '@/components/ui/ShareButton';
import { SocialLinks } from '@/components/ui/SocialLinks';

// ISR: revalidate every 24 hours (themes change ~every 6 months)
export const revalidate = 86400;

// Return empty array: don't pre-render at build time, generate on-demand + ISR cache
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = await getThemeWithCardsAndTalks(slug);

  if (!theme) {
    return {
      title: 'Theme Not Found',
    };
  }

  const description = theme.description || `Explore the ${theme.name} theme on TarotTALKS - curated tarot cards and TED talks.`;

  return {
    title: `${theme.name} - TarotTALKS`,
    description,
    openGraph: {
      title: `${theme.name} - TarotTALKS`,
      description,
      url: `https://tarottalks.app/themes/${theme.slug}`,
      siteName: 'TarotTALKS',
      images: [
        {
          url: 'https://tarottalks.app/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: `${theme.name} Theme - TarotTALKS`,
        },
      ],
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${theme.name} - TarotTALKS`,
      description,
      images: ['https://tarottalks.app/opengraph-image.png'],
    },
  };
}

const themeColors: Record<string, string> = {
  'new-beginnings': 'bg-green-500',
  'grief-and-gratitude': 'bg-indigo-500',
  'transformation': 'bg-purple-500',
  'endings-and-transitions': 'bg-gray-500',
  'leadership': 'bg-rose-500',
  'creativity-and-calling': 'bg-orange-500',
  'relationships': 'bg-pink-500',
  'resilience': 'bg-blue-500',
  'joy-and-celebration': 'bg-yellow-500',
  'fear-and-courage': 'bg-red-500',
  'wisdom-and-introspection': 'bg-teal-500',
};

export default async function ThemeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = await getThemeWithCardsAndTalks(slug);

  if (!theme) {
    notFound();
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3 max-w-7xl mx-auto">
          <Link
            href="/themes"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <div className={`w-3 h-3 rounded-full ${themeColors[theme.slug] || 'bg-indigo-500'}`} />
            <h2 className="font-semibold text-gray-100">{theme.name}</h2>
          </div>
          <ShareButton title={`${theme.name} - TarotTALKS`} description={theme.description || undefined} />
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">
        {/* Theme Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-100">{theme.name}</h1>
          <p className="text-gray-400 max-w-lg mx-auto">{theme.description}</p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <span>{theme.cards.length} cards</span>
            <span>•</span>
            <span>{theme.talks.length} talks</span>
          </div>
        </div>

        {/* Cards Section */}
        {theme.cards.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-100">Cards</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {theme.cards.map((card) => {
                const keywords = card.keywords ? JSON.parse(card.keywords) : [];
                return (
                  <Link
                    key={card.id}
                    href={`/cards/${card.slug}`}
                    className="bg-gray-800/50 rounded-xl p-3 shadow-sm border border-gray-700 hover:shadow-md hover:border-gray-600 transition-all group"
                  >
                    <div className="aspect-[5/7] rounded-lg mb-2 overflow-hidden relative group-hover:scale-105 transition-transform bg-gray-900">
                      <Image
                        src={card.imageUrl}
                        alt={card.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        loading="lazy"
                        className="object-contain"
                      />
                    </div>
                    <h3 className="font-semibold text-gray-100 text-sm mb-1">{card.name}</h3>
                    <div className="flex flex-wrap gap-1">
                      {keywords.slice(0, 2).map((keyword: string) => (
                        <span
                          key={keyword}
                          className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs border border-indigo-500/30"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Talks Section */}
        {theme.talks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-100">Talks</h2>
            <div className="space-y-3">
              {theme.talks.map((talk) => {
                const thumbnailUrl = getThumbnailUrl(talk.thumbnailUrl, talk.youtubeVideoId);
                return (
                <div
                  key={talk.id}
                  className="bg-gray-800/50 rounded-xl p-4 shadow-sm border border-gray-700 hover:shadow-md hover:border-gray-600 transition-all"
                >
                  <div className="flex gap-4">
                    {/* Clickable Thumbnail - Opens video */}
                    <a
                      href={talk.tedUrl || talk.youtubeUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-28 h-20 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0 border border-indigo-500/30 hover:border-indigo-400/50 overflow-hidden relative group transition-all"
                    >
                      {thumbnailUrl ? (
                        <>
                          <Image
                            src={thumbnailUrl}
                            alt={talk.title}
                            fill
                            sizes="112px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <Play className="w-6 h-6 text-white/90 drop-shadow-lg" />
                          </div>
                        </>
                      ) : (
                        <Play className="w-6 h-6 text-indigo-400" />
                      )}
                    </a>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-100 mb-1">{talk.title}</h3>
                      <p className="text-sm text-gray-400 mb-3">
                        {talk.speakerName}
                        {talk.durationSeconds && (
                          <> • {Math.floor(talk.durationSeconds / 60)} min</>
                        )}
                      </p>
                      <div className="flex gap-3">
                        <a
                          href={talk.tedUrl || talk.youtubeUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                        >
                          Watch
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Link
                          href={`/talks/${talk.slug}`}
                          className="text-gray-400 hover:text-gray-300 text-sm font-medium"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="text-center pt-4">
          <Link
            href="/themes"
            className="text-indigo-400 hover:text-indigo-300 font-medium"
          >
            ← Back to all themes
          </Link>
        </div>

        {/* Social Links */}
        <div className="text-center mt-8 opacity-60 hover:opacity-100 transition-opacity duration-500">
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}
