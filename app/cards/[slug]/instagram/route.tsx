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
  // Card prominent on left, name centered under brand, talk full-width below
  const truncatedTalkTitle = primaryTalk?.title && primaryTalk.title.length > 70
    ? primaryTalk.title.slice(0, 67) + '...'
    : primaryTalk?.title;

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
        <div style={{ display: 'flex', fontSize: 32, marginBottom: 12 }}>
          <span style={{ color: '#9ca3af' }}>Tarot</span>
          <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Card Name - Prominent, centered under brand */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 44,
            fontWeight: 700,
            marginBottom: 20,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {cardData.name}
        </div>

        {/* Card Image - Large, aligned left */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-start',
            paddingLeft: 60,
            marginBottom: 24,
          }}
        >
          <img
            src={cardImageUrl}
            alt=""
            width={280}
            height={550}
            style={{
              borderRadius: 14,
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Talk Section - Full width at bottom */}
        {primaryTalk && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              background: 'rgba(0, 0, 0, 0.35)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {/* Talk Thumbnail - Full width */}
            {talkThumbnailUrl ? (
              <img
                src={talkThumbnailUrl}
                alt=""
                width={1000}
                height={180}
                style={{
                  width: '100%',
                  height: 180,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 180,
                  background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  fontSize: 20,
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
                padding: '14px 20px',
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

        {/* Footer URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
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
