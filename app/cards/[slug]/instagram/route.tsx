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

          {/* Footer URL */}
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              color: '#9ca3af',
              fontSize: 20,
            }}
          >
            tarottalks.app
          </div>
        </div>
      ),
      { ...size, ...fontOptions }
    );
  }

  // Default: Card+Talk version
  // Card prominent on left, talk thumbnail offset to the right below card
  const truncatedTalkTitle = primaryTalk?.title && primaryTalk.title.length > 55
    ? primaryTalk.title.slice(0, 52) + '...'
    : primaryTalk?.title;

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
        <div style={{ display: 'flex', fontSize: 32, marginBottom: 12, justifyContent: 'center' }}>
          <span style={{ color: '#9ca3af' }}>Tarot</span>
          <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Card Name - Prominent, centered under brand */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 44,
            fontWeight: 700,
            marginBottom: 16,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {cardData.name}
        </div>

        {/* Main content area - Card on left, Talk offset right below */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Card Image - Large, on left */}
          <img
            src={cardImageUrl}
            alt=""
            width={320}
            height={630}
            style={{
              borderRadius: 14,
              objectFit: 'contain',
              position: 'absolute',
              left: 40,
              top: 0,
            }}
          />

          {/* Talk Section - Offset to the right, below card level */}
          {primaryTalk && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'absolute',
                right: 0,
                bottom: 60,
                width: 580,
              }}
            >
              {/* Talk Thumbnail - Full image, 16:9 aspect ratio */}
              {talkThumbnailUrl ? (
                <img
                  src={talkThumbnailUrl}
                  alt=""
                  width={580}
                  height={326}
                  style={{
                    borderRadius: 12,
                    objectFit: 'contain',
                    marginBottom: 12,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 580,
                    height: 326,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 20,
                    marginBottom: 12,
                  }}
                >
                  TED Talk
                </div>
              )}
              {/* Talk Info */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  {truncatedTalkTitle}
                </div>
                <div style={{ color: '#a5b4fc', fontSize: 16 }}>
                  {primaryTalk.speakerName}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 18,
          }}
        >
          tarottalks.app
        </div>
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
