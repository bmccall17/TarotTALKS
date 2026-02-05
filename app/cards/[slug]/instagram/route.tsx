/**
 * Instagram Image Route Handler for Cards
 * Generates 1080x1080 square images optimized for Instagram
 *
 * Usage:
 *   /cards/[slug]/instagram        → Card+Talk version (default)
 *   /cards/[slug]/instagram?v=card → Card-only version (legacy)
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getCardWithMappings } from '@/lib/db/queries/cards';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

const size = { width: 1080, height: 1080 };

// Load OpenDyslexic font from local filesystem
async function loadFonts() {
  try {
    const fontsDir = join(process.cwd(), 'public', 'fonts');
    const [regular, bold] = await Promise.all([
      readFile(join(fontsDir, 'OpenDyslexic-Regular.woff')),
      readFile(join(fontsDir, 'OpenDyslexic-Bold.woff')),
    ]);

    return {
      regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
      bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
    };
  } catch (error) {
    console.error('Failed to load fonts from filesystem:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const variant = request.nextUrl.searchParams.get('v');

  // Load fonts and card data in parallel
  const [fonts, cardData] = await Promise.all([
    loadFonts(),
    getCardWithMappings(slug).catch((error) => {
      console.error('Error fetching card data:', error);
      return null;
    }),
  ]);

  const fontFamily = fonts ? 'OpenDyslexic' : 'system-ui, sans-serif';
  const fontOptions = fonts
    ? {
        fonts: [
          { name: 'OpenDyslexic', data: fonts.regular, weight: 400 as const },
          { name: 'OpenDyslexic', data: fonts.bold, weight: 700 as const },
        ],
      }
    : {};

  // Fallback for not found
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

  // Build URLs directly
  const cardImageUrl = cardData.imageUrl.startsWith('http')
    ? cardData.imageUrl
    : `https://tarottalks.app${cardData.imageUrl}`;

  // Get primary talk
  const primaryMapping = cardData.mappings[0];
  const primaryTalk = primaryMapping?.talk;

  const talkThumbnailUrl = primaryTalk?.thumbnailUrl?.startsWith('http')
    ? primaryTalk.thumbnailUrl
    : primaryTalk?.thumbnailUrl
    ? `https://tarottalks.app${primaryTalk.thumbnailUrl}`
    : null;

  // Generate sparkles
  const sparkles: Array<{ x: number; y: number; s: number; o: number }> = [];
  let seed = Date.now();
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const sparkleCount = 12 + Math.floor(random() * 4);
  for (let i = 0; i < sparkleCount; i++) {
    sparkles.push({
      x: Math.floor(random() * 1030) + 25,
      y: Math.floor(random() * 1030) + 25,
      s: Math.floor(random() * 3) + 3,
      o: 0.4 + random() * 0.5,
    });
  }

  // Card-only version (legacy)
  if (variant === 'card') {
    const keywords: string[] = cardData.keywords ? JSON.parse(cardData.keywords) : [];
    const displayKeywords = keywords.slice(0, 4);
    const fullSummary = cardData.summary || '';
    const truncatedSummary =
      fullSummary.length > 120 ? fullSummary.slice(0, 117) + '...' : fullSummary;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
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
          <div style={{ display: 'flex', fontSize: 36, marginBottom: 30 }}>
            <span style={{ color: '#9ca3af' }}>Tarot</span>
            <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
          </div>

          {/* Card Image */}
          <img
            src={cardImageUrl}
            alt=""
            width={253}
            height={500}
            style={{
              borderRadius: 14,
              objectFit: 'contain',
              marginBottom: 30,
            }}
          />

          {/* Card Name */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 48,
              fontWeight: 700,
              marginBottom: 16,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {cardData.name}
          </div>

          {/* Summary */}
          <div
            style={{
              color: '#d1d5db',
              fontSize: 22,
              marginBottom: 20,
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            {truncatedSummary}
          </div>

          {/* Keywords */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              maxWidth: 900,
            }}
          >
            {displayKeywords.map((keyword, index) => (
              <span
                key={index}
                style={{
                  background: 'rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  padding: '10px 20px',
                  borderRadius: 24,
                  fontSize: 18,
                }}
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      ),
      { ...size, ...fontOptions }
    );
  }

  // Default: Card+Talk version
  // Layout: Talk image in back, Card overlays it, Card name top-right (2x big), Speaker under card (2x big)
  const truncatedTalkTitle = primaryTalk?.title && primaryTalk.title.length > 40
    ? primaryTalk.title.slice(0, 37) + '...'
    : primaryTalk?.title;

  // Talk image dimensions - large
  const talkWidth = 750;
  const talkHeight = 422; // 16:9 aspect ratio

  // Card dimensions
  const cardWidth = 340;
  const cardHeight = 670;
  const cardLeft = 30;

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

        {/* Brand Header - centered */}
        <div style={{ display: 'flex', fontSize: 32, marginBottom: 0, justifyContent: 'center' }}>
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
          {/* Card Name - Top right, 2x BIG */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 30,
              left: 400,
              display: 'flex',
              color: '#ffffff',
              fontSize: 90,
              fontWeight: 700,
              textTransform: 'uppercase',
              lineHeight: 1.0,
            }}
          >
            {cardData.name}
          </div>

          {/* Talk Image with Title Overlay - Background layer (rendered first) */}
          {primaryTalk && (
            <div
              style={{
                position: 'absolute',
                right: 30,
                bottom: 30,
                width: talkWidth,
                height: talkHeight,
                display: 'flex',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {/* Talk Thumbnail */}
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

              {/* Talk Title Overlay - Bottom of image */}
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
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {truncatedTalkTitle}
              </div>
            </div>
          )}

          {/* Card Image - Overlays the Talk Image (rendered second = on top) */}
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

          {/* Speaker Name - Under card image, right-justified to card edge, 2x BIG */}
          {primaryTalk && (
            <div
              style={{
                position: 'absolute',
                top: cardHeight + 30,
                left: cardLeft,
                width: cardWidth,
                display: 'flex',
                justifyContent: 'flex-end',
                textAlign: 'right',
                color: '#a5b4fc',
                fontSize: 48,
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              {primaryTalk.speakerName}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
