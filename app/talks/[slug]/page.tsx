import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
import { getThumbnailUrl } from '@/lib/utils/thumbnails';
import { ExternalLink, Clock, Calendar, Play, Mic2 } from 'lucide-react';
import { SmartBackButton } from '@/components/ui/SmartBackButton';
import { ShareButton } from '@/components/ui/ShareButton';
import { SocialLinks } from '@/components/ui/SocialLinks';
import { SocialTrail } from '@/components/ui/SocialTrail';
import { getPublicSharesForTalk } from '@/lib/db/queries/public-social-shares';

// ISR: revalidate every hour (talks updated more frequently)
export const revalidate = 3600;

// Return empty array: don't pre-render at build time, generate on-demand + ISR cache
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const talk = await getTalkWithMappedCards(slug);

  if (!talk) {
    return {
      title: 'Talk Not Found',
    };
  }

  const description = talk.description || `A TED talk by ${talk.speakerName}`;

  // Static Supabase URL > raw thumbnail > dynamic Satori generator
  const ogImageUrl = talk.shareImageUrl
    || talk.thumbnailUrl
    || `https://tarottalks.app/talks/${slug}/opengraph-image`;

  return {
    title: `${talk.title} - TarotTALKS`,
    description,
    openGraph: {
      title: `${talk.title} - TarotTALKS`,
      description,
      url: `https://tarottalks.app/talks/${talk.slug}`,
      siteName: 'TarotTALKS',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${talk.title} by ${talk.speakerName}`,
        },
      ],
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${talk.title} - TarotTALKS`,
      description,
      images: [ogImageUrl],
    },
    keywords: ['TED talk', talk.speakerName, 'tarot', 'TarotTALKS'],
  };
}

export default async function TalkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const talk = await getTalkWithMappedCards(slug);

  if (!talk) {
    notFound();
  }

  const publicShares = await getPublicSharesForTalk(talk.id);

  const durationMinutes = talk.durationSeconds ? Math.floor(talk.durationSeconds / 60) : null;
  const thumbnailUrl = getThumbnailUrl(talk.thumbnailUrl, talk.youtubeVideoId);

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3 max-w-7xl mx-auto">
          <SmartBackButton defaultHref="/talks" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-100 truncate">{talk.title}</h2>
            <p className="text-sm text-gray-500">{talk.speakerName}</p>
          </div>
          <ShareButton title={`${talk.title} - TarotTALKS`} description={talk.description || undefined} />
          <Link href="/" className="text-lg font-light text-gray-200/60 tracking-wide flex-shrink-0">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </Link>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">
        {/* Talk Hero */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl overflow-hidden border border-indigo-500/30">
          {/* Thumbnail Banner */}
          {thumbnailUrl && (talk.tedUrl || talk.youtubeUrl) && (
            <a
              href={(talk.tedUrl || talk.youtubeUrl) as string}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative w-full bg-gray-900 group cursor-pointer"
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <img
                  src={thumbnailUrl}
                  alt={talk.title}
                  className="absolute inset-0 w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  crossOrigin="anonymous"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/30 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-indigo-600 rounded-full p-4 shadow-lg">
                    <Play className="w-10 h-10 text-white" fill="white" />
                  </div>
                </div>
              </div>
            </a>
          )}

          <div className="p-6">
            <div className="flex items-start gap-4 mb-4">
              {!thumbnailUrl && (
                <div className="w-16 h-16 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Play className="w-8 h-8 text-white" />
                </div>
              )}
              <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-100 mb-2">{talk.title}</h1>
              <p className="text-lg text-gray-300 mb-3">
                by <span className="font-semibold">{talk.speakerName}</span>
              </p>
              {(talk.eventName || talk.year || durationMinutes) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {talk.eventName && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/20 text-pink-300 rounded-lg border border-pink-500/30">
                      <Mic2 className="w-4 h-4" />
                      <span className="font-medium">{talk.eventName}</span>
                    </span>
                  )}
                  {talk.year && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">{talk.year}</span>
                    </span>
                  )}
                  {durationMinutes && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">{durationMinutes} min</span>
                    </span>
                  )}
                </div>
              )}
              </div>
            </div>

            {talk.description && (
              <p className="text-gray-300 mb-6 leading-relaxed">{talk.description}</p>
            )}

            {(talk.tedUrl || talk.youtubeUrl) ? (
              <div className="flex flex-wrap gap-3">
                {talk.tedUrl && (
                  <a
                    href={talk.tedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-[#EB0028] text-white px-6 py-3 rounded-lg hover:bg-[#c90022] transition-colors font-medium"
                  >
                    Watch on TED
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {talk.youtubeUrl && (
                  <a
                    href={talk.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-[#FF0000] text-white px-6 py-3 rounded-lg hover:bg-[#cc0000] transition-colors font-medium"
                  >
                    Watch on YouTube
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-gray-700 text-gray-400 px-6 py-3 rounded-lg font-medium cursor-not-allowed">
                No Video Available
              </div>
            )}
          </div>
        </div>

        {/* Tarot Mapping */}
        {talk.mappedCards.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-100">Tarot Mapping</h2>
            {talk.mappedCards.map((item) => {
              const keywords = item.card.keywords ? JSON.parse(item.card.keywords) : [];

              return (
                <div
                  key={item.card.id}
                  className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/30 rounded-xl p-6 space-y-4"
                >
                  <Link
                    href={`/cards/${item.card.slug}`}
                    className="flex gap-6 items-start group"
                  >
                    <div className="relative w-24 h-40 md:w-32 md:h-52 flex-shrink-0 rounded-lg overflow-hidden shadow-lg bg-gray-900 group-hover:shadow-xl transition-shadow">
                      <Image
                        src={item.card.imageUrl}
                        alt={item.card.name}
                        fill
                        sizes="(max-width: 768px) 96px, 128px"
                        loading="lazy"
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-bold text-gray-100 mb-2 group-hover:text-indigo-300 transition-colors">
                        {item.card.name}
                      </h3>
                      <p className="text-gray-400 mb-3">
                        {item.card.summary}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {keywords.map((keyword: string) => (
                          <span
                            key={keyword}
                            className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>

                  {/* Rationale - More prominent */}
                  <div className="border-t border-purple-500/20 pt-4">
                    <h4 className="text-sm font-semibold text-purple-300 mb-2 uppercase tracking-wide">
                      Why This Mapping?
                    </h4>
                    <p className="text-gray-300 leading-relaxed">
                      {item.mapping.rationaleShort}
                    </p>

                    {/* Extended Rationale - Collapsible */}
                    {item.mapping.rationaleLong && (
                      <details className="mt-4 group">
                        <summary className="cursor-pointer text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors list-none flex items-center gap-2">
                          <span className="text-indigo-400 group-open:rotate-90 transition-transform">▶</span>
                          READ MORE ABOUT WHY THIS MAPPING...
                        </summary>
                        <div className="mt-3 pl-5 text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {item.mapping.rationaleLong}
                        </div>
                      </details>
                    )}
                  </div>

                  {/* Reflection Questions */}
                  {item.card.journalingPrompts && (() => {
                    try {
                      const prompts = JSON.parse(item.card.journalingPrompts);
                      if (prompts && prompts.length > 0) {
                        return (
                          <div className="border-t border-purple-500/20 pt-4">
                            <h4 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wide">
                              Reflection Questions
                            </h4>
                            <ul className="space-y-2">
                              {prompts.map((prompt: string, idx: number) => (
                                <li key={idx} className="text-gray-300 flex gap-2">
                                  <span className="text-purple-400 flex-shrink-0">•</span>
                                  <span>{prompt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                    } catch (e) {
                      return null;
                    }
                    return null;
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* Back Link */}
        <div className="text-center pt-4">
          <SmartBackButton defaultHref="/talks" showText text="Back to all talks" />
        </div>

        {/* Social Trail */}
        <div className="opacity-50 hover:opacity-100 transition-opacity duration-500">
          <SocialTrail shares={publicShares} />
        </div>

        {/* Social Links */}
        <div className="text-center mt-8 opacity-60 hover:opacity-100 transition-opacity duration-500">
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}
