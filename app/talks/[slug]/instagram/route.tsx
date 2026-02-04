/**
 * Instagram Image Route Handler for Talks
 * Generates 1080x1080 square images optimized for Instagram
 *
 * Usage: /talks/[slug]/instagram
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
import { getThumbnailUrl } from '@/lib/utils/thumbnails';
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

  // Get the primary card (first one, sorted by strength)
  const primaryCard = talkData.mappedCards[0]?.card;

  // Get thumbnail URL using the utility (handles YouTube fallback)
  const thumbnailUrl = getThumbnailUrl(talkData.thumbnailUrl, talkData.youtubeVideoId);
  const talkThumbnailUrl = thumbnailUrl?.startsWith('http')
    ? thumbnailUrl
    : thumbnailUrl
    ? `https://tarottalks.app${thumbnailUrl}`
    : null;

  const cardImageUrl = primaryCard?.imageUrl?.startsWith('http')
    ? primaryCard.imageUrl
    : primaryCard?.imageUrl
    ? `https://tarottalks.app${primaryCard.imageUrl}`
    : null;

  // Truncate title if too long
  const displayTitle =
    talkData.title.length > 80 ? talkData.title.slice(0, 77) + '...' : talkData.title;

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
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            marginBottom: 24,
          }}
        >
          <span style={{ color: '#9ca3af' }}>Tarot</span>
          <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Talk Thumbnail */}
        {talkThumbnailUrl ? (
          <img
            src={talkThumbnailUrl}
            alt=""
            width={560}
            height={315}
            style={{
              borderRadius: 16,
              objectFit: 'cover',
              marginBottom: 28,
            }}
          />
        ) : (
          <div
            style={{
              width: 560,
              height: 315,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 24,
              marginBottom: 28,
            }}
          >
            TED Talk
          </div>
        )}

        {/* Talk Title */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 12,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          {displayTitle}
        </div>

        {/* Speaker Name */}
        <div
          style={{
            color: '#a5b4fc',
            fontSize: 24,
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          by {talkData.speakerName}
        </div>

        {/* Associated Card Section */}
        {primaryCard && cardImageUrl && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 16,
              padding: '16px 24px',
            }}
          >
            {/* Small Card Image */}
            <img
              src={cardImageUrl}
              alt=""
              width={60}
              height={118}
              style={{
                borderRadius: 8,
                objectFit: 'contain',
              }}
            />
            {/* Card Label */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  color: '#d1d5db',
                  fontSize: 14,
                }}
              >
                Associated with
              </div>
              <div
                style={{
                  color: '#ffffff',
                  fontSize: 22,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {primaryCard.name}
              </div>
            </div>
          </div>
        )}
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
