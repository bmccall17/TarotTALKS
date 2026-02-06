/**
 * Instagram Feed Portrait Image Route Handler for Talks
 * Generates 1080x1350 (4:5) images optimized for Instagram feed
 *
 * Usage: /talks/[slug]/instagram-feed
 *
 * Talk-forward layout with extra height for talk thumbnail, title,
 * speaker info, and card overlay.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
import { getThumbnailPngUrl } from '@/lib/utils/og-image-helpers';
import { loadOpenDyslexicFonts, buildFontOptions, generateSparkles } from '@/lib/utils/satori-helpers';

export const runtime = 'nodejs';

const size = { width: 1080, height: 1350 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const [fonts, talkData] = await Promise.all([
    loadOpenDyslexicFonts(),
    getTalkWithMappedCards(slug).catch((error) => {
      console.error('Error fetching talk data:', error);
      return null;
    }),
  ]);

  const { fontFamily, fontOptions } = buildFontOptions(fonts);

  if (!talkData) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
            color: '#ffffff',
            fontSize: 48,
            fontFamily,
          }}
        >
          Talk Not Found: {slug}
        </div>
      ),
      { ...size, ...fontOptions }
    );
  }

  const absoluteThumbnailUrl = talkData.thumbnailUrl?.startsWith('http')
    ? talkData.thumbnailUrl
    : talkData.thumbnailUrl
      ? `https://tarottalks.app${talkData.thumbnailUrl}`
      : null;
  const talkThumbnailUrl = getThumbnailPngUrl(absoluteThumbnailUrl);

  const primaryCard = talkData.mappedCards[0]?.card;
  const cardImageUrl = primaryCard?.imageUrl?.startsWith('http')
    ? primaryCard.imageUrl
    : primaryCard?.imageUrl
    ? `https://tarottalks.app${primaryCard.imageUrl}`
    : null;

  const truncatedTitle =
    talkData.title && talkData.title.length > 70
      ? talkData.title.slice(0, 67) + '...'
      : talkData.title;

  const sparkles = generateSparkles(size.width, size.height);

  // Talk thumbnail - larger with extra height
  const thumbWidth = 960;
  const thumbHeight = 540;

  // Card dimensions
  const cardWidth = 220;
  const cardHeight = 434;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          padding: 40,
          position: 'relative',
          fontFamily,
        }}
      >
        {/* Sparkles */}
        {sparkles.map((sp, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sp.x,
              top: sp.y,
              width: sp.s,
              height: sp.s,
              background: `rgba(255, 255, 255, ${sp.o})`,
              borderRadius: '50%',
            }}
          />
        ))}

        {/* Brand Header */}
        <div style={{ display: 'flex', fontSize: 32, marginBottom: 24, justifyContent: 'center' }}>
          <span style={{ color: '#9ca3af' }}>Tarot</span>
          <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Talk Thumbnail - Prominent */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 28,
          }}
        >
          {talkThumbnailUrl ? (
            <img
              src={talkThumbnailUrl}
              alt=""
              width={thumbWidth}
              height={thumbHeight}
              style={{
                borderRadius: 16,
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: thumbWidth,
                height: thumbHeight,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontSize: 32,
              }}
            >
              TED Talk
            </div>
          )}
        </div>

        {/* Talk Title */}
        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: 40,
            fontWeight: 700,
            marginBottom: 16,
            lineHeight: 1.2,
            paddingLeft: 20,
            paddingRight: cardImageUrl ? 280 : 20,
          }}
        >
          {truncatedTitle}
        </div>

        {/* Speaker Name */}
        <div
          style={{
            display: 'flex',
            color: '#a5b4fc',
            fontSize: 32,
            paddingLeft: 20,
          }}
        >
          {talkData.speakerName}
        </div>

        {/* Card Section - Bottom right */}
        {primaryCard && cardImageUrl && (
          <div
            style={{
              position: 'absolute',
              right: 50,
              bottom: 40,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                color: '#ffffff',
                fontSize: 48,
                fontWeight: 700,
                textAlign: 'right',
                lineHeight: 1.0,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              {primaryCard.name}
            </div>
            <img
              src={cardImageUrl}
              alt=""
              width={cardWidth}
              height={cardHeight}
              style={{
                borderRadius: 12,
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
              }}
            />
          </div>
        )}
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
