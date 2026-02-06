/**
 * Instagram Feed Portrait Image Route Handler for Cards
 * Generates 1080x1350 (4:5) images optimized for Instagram feed
 *
 * Usage: /cards/[slug]/instagram-feed
 *
 * The extra 270px of height (vs 1080x1080 square) allows for a
 * bigger card image and more room for talk info and text.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getCardWithMappings } from '@/lib/db/queries/cards';
import { getThumbnailPngUrl } from '@/lib/utils/og-image-helpers';
import { loadOpenDyslexicFonts, buildFontOptions, generateSparkles } from '@/lib/utils/satori-helpers';

export const runtime = 'nodejs';

const size = { width: 1080, height: 1350 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const [fonts, cardData] = await Promise.all([
    loadOpenDyslexicFonts(),
    getCardWithMappings(slug).catch((error) => {
      console.error('Error fetching card data:', error);
      return null;
    }),
  ]);

  const { fontFamily, fontOptions } = buildFontOptions(fonts);

  if (!cardData) {
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
          Card Not Found: {slug}
        </div>
      ),
      { ...size, ...fontOptions }
    );
  }

  const cardImageUrl = cardData.imageUrl.startsWith('http')
    ? cardData.imageUrl
    : `https://tarottalks.app${cardData.imageUrl}`;

  const primaryMapping = cardData.mappings[0];
  const primaryTalk = primaryMapping?.talk;

  const talkThumbnailUrl = getThumbnailPngUrl(
    primaryTalk?.thumbnailUrl?.startsWith('http')
      ? primaryTalk.thumbnailUrl
      : primaryTalk?.thumbnailUrl
        ? `https://tarottalks.app${primaryTalk.thumbnailUrl}`
        : null
  );

  const sparkles = generateSparkles(size.width, size.height);

  const truncatedTalkTitle = primaryTalk?.title && primaryTalk.title.length > 50
    ? primaryTalk.title.slice(0, 47) + '...'
    : primaryTalk?.title;

  // Portrait layout: bigger card + more room for talk info
  const cardWidth = 380;
  const cardHeight = 750;
  const cardLeft = 30;

  // Talk image dimensions
  const talkWidth = 600;
  const talkHeight = 338; // 16:9

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
        <div style={{ display: 'flex', fontSize: 32, marginBottom: 10, justifyContent: 'center' }}>
          <span style={{ color: '#9ca3af' }}>Tarot</span>
          <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Main content area */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Card Name - Top right, large */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              left: cardLeft + cardWidth + 20,
              display: 'flex',
              color: '#ffffff',
              fontSize: 80,
              fontWeight: 700,
              textTransform: 'uppercase',
              lineHeight: 1.0,
            }}
          >
            {cardData.name}
          </div>

          {/* Card Image */}
          <img
            src={cardImageUrl}
            alt=""
            width={cardWidth}
            height={cardHeight}
            style={{
              borderRadius: 14,
              objectFit: 'contain',
              position: 'absolute',
              left: cardLeft,
              top: 20,
            }}
          />

          {/* Speaker Name - Under card image */}
          {primaryTalk && (
            <div
              style={{
                position: 'absolute',
                top: cardHeight + 40,
                left: cardLeft,
                width: cardWidth,
                display: 'flex',
                justifyContent: 'flex-end',
                textAlign: 'right',
                color: '#a5b4fc',
                fontSize: 42,
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              {primaryTalk.speakerName}
            </div>
          )}

          {/* Talk Image with Title Overlay - Bottom right */}
          {primaryTalk && (
            <div
              style={{
                position: 'absolute',
                right: 20,
                bottom: 0,
                width: talkWidth,
                height: talkHeight,
                display: 'flex',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {talkThumbnailUrl ? (
                <img
                  src={talkThumbnailUrl}
                  alt=""
                  width={talkWidth}
                  height={talkHeight}
                  style={{
                    objectFit: 'cover',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 24,
                  }}
                >
                  TED Talk
                </div>
              )}

              {/* Talk Title Overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                  padding: '50px 20px 16px 20px',
                  display: 'flex',
                  color: '#ffffff',
                  fontSize: 22,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {truncatedTalkTitle}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
