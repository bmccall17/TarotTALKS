import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSpreadByShortId } from '@/lib/db/queries/spreads';
import { SpreadPageContent } from './SpreadPageContent';
import { POSITION_LABELS } from '@/lib/spread-reading/types';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const spread = await getSpreadByShortId(id);

  if (!spread) {
    return {
      title: 'Spread Not Found | TarotTALKS',
    };
  }

  const cardNames = spread.cards.map((c, i) => `${POSITION_LABELS[i]}: ${c.name}`).join(' • ');
  const talkTitle = spread.talk?.title || 'Tarot Reading';

  // Static Supabase URL > dynamic Satori generator
  const ogImageUrl = spread.shareImageUrl
    || `https://tarottalks.app/spreads/${id}/opengraph-image`;

  return {
    title: `${talkTitle} | TarotTALKS Spread`,
    description: `A TarotTALKS spread reading featuring ${cardNames}. ${spread.rationale.slice(0, 100)}...`,
    openGraph: {
      title: `TarotTALKS: ${talkTitle}`,
      description: spread.rationale,
      type: 'website',
      url: `https://tarottalks.app/spreads/${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `TarotTALKS spread with ${spread.cards.map(c => c.name).join(', ')}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `TarotTALKS: ${talkTitle}`,
      description: spread.rationale,
      images: [ogImageUrl],
    },
  };
}

export default async function SpreadPage({ params }: Props) {
  const { id } = await params;
  const spread = await getSpreadByShortId(id);

  if (!spread) {
    notFound();
  }

  return <SpreadPageContent spread={spread} />;
}
