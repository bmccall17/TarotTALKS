/**
 * Instagram Image Route Handler for Talks
 * Generates 1080x1080 square images optimized for Instagram
 *
 * Layout: Talk thumbnail prominent, title, speaker, small card image
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
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

  // Load fonts and talk data in parallel
  const [fonts, talkData] = await Promise.all([
    loadFonts(),
    getTalkWithMappedCards(slug).catch((error) => {
      console.error('Error fetching talk data:', error);
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

  // Build URLs
  const talkThumbnailUrl = talkData.thumbnailUrl?.startsWith('http')
    ? talkData.thumbnailUrl
    : talkData.thumbnailUrl
    ? `https://tarottalks.app${talkData.thumbnailUrl}`
    : null;

  // Get primary card (first one, sorted by strength)
  const primaryCard = talkData.mappedCards[0]?.card;
  const cardImageUrl = primaryCard?.imageUrl?.startsWith('http')
    ? primaryCard.imageUrl
    : primaryCard?.imageUrl
    ? `https://tarottalks.app${primaryCard.imageUrl}`
    : null;

  // Truncate title if too long
  const truncatedTitle =
    talkData.title && talkData.title.length > 60
      ? talkData.title.slice(0, 57) + '...'
      : talkData.title;

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

  // Talk thumbnail dimensions (16:9 aspect, prominent)
  const thumbWidth = 900;
  const thumbHeight = 506;
  const thumbLeft = 40;
  const thumbTop = 90; // After brand header

  // Card dimensions
  const cardWidth = 200;
  const cardHeight = 394;

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
        <div style={{ display: 'flex', fontSize: 32, marginBottom: 20, justifyContent: 'center' }}>
          <span style={{ color: '#9ca3af' }}>Tarot</span>
          <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Talk Thumbnail - Prominent */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 24,
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

        {/* Talk Title - Left justified, limited width to avoid card overlap */}
        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: 36,
            fontWeight: 700,
            marginBottom: 12,
            lineHeight: 1.2,
            paddingLeft: 50,
            paddingRight: 280, // Leave room for card
          }}
        >
          {truncatedTitle}
        </div>

        {/* Speaker Name - Left justified */}
        <div
          style={{
            display: 'flex',
            color: '#a5b4fc',
            fontSize: 28,
            paddingLeft: 50,
          }}
        >
          {talkData.speakerName}
        </div>

        {/* Card Section - Bottom right, overlapping talk image */}
        {primaryCard && cardImageUrl && (
          <div
            style={{
              position: 'absolute',
              right: 60,
              bottom: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <img
              src={cardImageUrl}
              alt=""
              width={cardWidth}
              height={cardHeight}
              style={{
                borderRadius: 12,
                objectFit: 'contain',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
              }}
            />
            {/* Card Name - Right justified, 3x bigger */}
            <div
              style={{
                display: 'flex',
                color: '#ffffff',
                fontSize: 54,
                fontWeight: 700,
                marginTop: 12,
                textAlign: 'right',
                lineHeight: 1.0,
                textTransform: 'uppercase',
              }}
            >
              {primaryCard.name}
            </div>
          </div>
        )}
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
