import { ImageResponse } from 'next/og';
import { getSpreadByShortId } from '@/lib/db/queries/spreads';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { POSITION_LABELS } from '@/lib/spread-reading/types';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'TarotTALKS Spread Reading';

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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Load fonts and spread data in parallel
  const [fonts, spread] = await Promise.all([
    loadFonts(),
    getSpreadByShortId(id).catch((error) => {
      console.error('Error fetching spread data:', error);
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

  if (!spread) {
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
            color: 'white',
            fontSize: 48,
            fontFamily,
          }}
        >
          Spread Not Found
        </div>
      ),
      { ...size, ...fontOptions }
    );
  }

  // Prepare card images
  const cardImages = spread.cards.map(card => {
    const url = card.imageUrl.startsWith('http')
      ? card.imageUrl
      : `https://tarottalks.app${card.imageUrl}`;
    return { url, name: card.name };
  });

  // Prepare talk thumbnail
  const talkThumbnailUrl = spread.talk?.thumbnailUrl?.startsWith('http')
    ? spread.talk.thumbnailUrl
    : spread.talk?.thumbnailUrl
    ? `https://tarottalks.app${spread.talk.thumbnailUrl}`
    : null;

  const truncatedTalkTitle = spread.talk?.title && spread.talk.title.length > 50
    ? spread.talk.title.slice(0, 47) + '...'
    : spread.talk?.title;

  // Generate sparkles
  const sparkles: Array<{ x: number; y: number; s: number; o: number }> = [];
  let seed = Date.now();
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const sparkleCount = 10 + Math.floor(random() * 4);
  for (let i = 0; i < sparkleCount; i++) {
    sparkles.push({
      x: Math.floor(random() * 1150) + 25,
      y: Math.floor(random() * 580) + 25,
      s: Math.floor(random() * 3) + 2,
      o: 0.3 + random() * 0.4,
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
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

        {/* Left Side: Cards */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 480,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', fontSize: 28, marginBottom: 24 }}>
            <span style={{ color: '#9ca3af' }}>Tarot</span>
            <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
          </div>

          {/* Title */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 24,
            }}
          >
            Your Spread Reading
          </div>

          {/* Cards Row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {cardImages.map((card, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <img
                  src={card.url}
                  alt={card.name}
                  width={120}
                  height={200}
                  style={{
                    borderRadius: 8,
                    objectFit: 'cover',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                  }}
                />
                <span
                  style={{
                    color: '#9ca3af',
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  {POSITION_LABELS[i].split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Card Names */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {cardImages.map((card, i) => (
              <span
                key={i}
                style={{
                  color: '#a5b4fc',
                  fontSize: 14,
                  background: 'rgba(99, 102, 241, 0.2)',
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                {card.name}
              </span>
            ))}
          </div>
        </div>

        {/* Right Side: Talk */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: 40,
          }}
        >
          {spread.talk && (
            <>
              {/* Talk Thumbnail */}
              {talkThumbnailUrl ? (
                <img
                  src={talkThumbnailUrl}
                  alt=""
                  width={360}
                  height={200}
                  style={{
                    borderRadius: 12,
                    objectFit: 'cover',
                    marginBottom: 16,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 360,
                    height: 200,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 16,
                    marginBottom: 16,
                  }}
                >
                  TED Talk
                </div>
              )}

              {/* Talk Title */}
              <div
                style={{
                  color: '#ffffff',
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 8,
                  maxWidth: 360,
                }}
              >
                {truncatedTalkTitle}
              </div>

              {/* Speaker */}
              <div style={{ color: '#a5b4fc', fontSize: 16 }}>
                {spread.talk.speakerName}
              </div>
            </>
          )}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            tarottalks.app/spreads/{spread.shortId}
          </span>
        </div>
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
