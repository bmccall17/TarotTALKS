import { ImageResponse } from 'next/og';
import { getSpreadByShortId } from '@/lib/db/queries/spreads';
import { readFile } from 'fs/promises';
import { join } from 'path';

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

  // Truncate title if too long (70 chars like talks OG image)
  const truncatedTalkTitle = spread.talk?.title && spread.talk.title.length > 70
    ? spread.talk.title.slice(0, 67) + '...'
    : spread.talk?.title;

  // Get rationale from spread
  const rationale = spread.rationale || '';

  // Format duration (seconds to minutes)
  const durationMin = spread.talk?.durationSeconds ? Math.round(spread.talk.durationSeconds / 60) : null;

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
      x: Math.floor(random() * 1150) + 25,
      y: Math.floor(random() * 580) + 25,
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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          padding: 36,
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

        {/* Left Section: Brand + Large Thumbnail with Card Overlay */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 720,
            position: 'relative',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', fontSize: 28, marginBottom: 16 }}>
            <span style={{ color: '#9ca3af' }}>Tarot</span>
            <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
          </div>

          {/* Large Thumbnail */}
          {spread.talk && talkThumbnailUrl ? (
            <img
              src={talkThumbnailUrl}
              alt=""
              width={700}
              height={394}
              style={{
                borderRadius: 16,
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: 700,
                height: 394,
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

          {/* Metadata row */}
          {spread.talk && (
            <div
              style={{
                display: 'flex',
                marginTop: 12,
                gap: 16,
                color: '#a5b4fc',
                fontSize: 16,
              }}
            >
              {spread.talk.year && <span style={{ display: 'flex' }}>{spread.talk.year}</span>}
              {durationMin && <span style={{ display: 'flex' }}>{durationMin} min</span>}
            </div>
          )}
        </div>

        {/* Right Section: Title, Speaker at top (matching talk OG layout) */}
        {spread.talk && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              paddingLeft: 28,
              paddingRight: 20,
              paddingTop: 44,
            }}
          >
            {/* Title */}
            <div
              style={{
                color: '#ffffff',
                fontSize: 28,
                fontWeight: 700,
                marginBottom: 8,
                lineHeight: 1.2,
              }}
            >
              {truncatedTalkTitle}
            </div>

            {/* Speaker */}
            <div
              style={{
                color: '#a5b4fc',
                fontSize: 20,
              }}
            >
              {spread.talk.speakerName}
            </div>
          </div>
        )}

        {/* Cards - overlays bottom-right corner of thumbnail */}
        <div
          style={{
            position: 'absolute',
            left: 400,
            top: 320,
            display: 'flex',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
          }}
        >
          {cardImages.map((card, i) => (
            <img
              key={i}
              src={card.url}
              alt={card.name}
              width={120}
              height={200}
              style={{
                borderRadius: 10,
                objectFit: 'cover',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                transform: `rotate(${(i - 1) * 5}deg)`, // Fan effect: -5, 0, 5 degrees
                marginLeft: i === 0 ? 0 : -40,
              }}
            />
          ))}
        </div>

        {/* Rationale - positioned below title/speaker area */}
        {rationale && (
          <div
            style={{
              position: 'absolute',
              left: 790,
              top: 280,
              right: 36,
              display: 'flex',
              color: '#d1d5db',
              fontSize: 15,
              lineHeight: 1.4,
              borderLeft: '3px solid #6366f1',
              paddingLeft: 14,
            }}
          >
            {rationale.length > 200 ? rationale.slice(0, 197) + '...' : rationale}
          </div>
        )}

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
