import { ImageResponse } from 'next/og';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
import { getThumbnailUrl } from '@/lib/utils/thumbnails';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'TarotTALKS Talk';

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

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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

  // Fallback for missing talk
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
            color: 'white',
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

  // Get primary card (highest strength mapping)
  const primaryMapping = talkData.mappedCards[0];
  const primaryCard = primaryMapping?.card;

  // Get thumbnail URL
  const thumbnailUrl = getThumbnailUrl(talkData.thumbnailUrl, talkData.youtubeVideoId);
  const fullThumbnailUrl = thumbnailUrl?.startsWith('http')
    ? thumbnailUrl
    : thumbnailUrl
    ? `https://tarottalks.app${thumbnailUrl}`
    : null;

  // Get card image URL
  const cardImageUrl = primaryCard?.imageUrl?.startsWith('http')
    ? primaryCard.imageUrl
    : primaryCard?.imageUrl
    ? `https://tarottalks.app${primaryCard.imageUrl}`
    : null;

  // Truncate title if too long
  const truncatedTitle =
    talkData.title.length > 70 ? talkData.title.slice(0, 67) + '...' : talkData.title;

  // Get rationale (short version preferred) - no truncation
  const rationale = primaryMapping?.mapping?.rationaleShort || '';

  // Format duration (seconds to minutes)
  const durationMin = talkData.durationSeconds ? Math.round(talkData.durationSeconds / 60) : null;

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

        {/* Left Section: Brand + Large Thumbnail */}
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
          {fullThumbnailUrl ? (
            <img
              src={fullThumbnailUrl}
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
          <div
            style={{
              display: 'flex',
              marginTop: 12,
              gap: 16,
              color: '#a5b4fc',
              fontSize: 16,
            }}
          >
            {talkData.year && <span style={{ display: 'flex' }}>{talkData.year}</span>}
            {durationMin && <span style={{ display: 'flex' }}>{durationMin} min</span>}
          </div>
        </div>

        {/* Right Section: Title, Speaker at top */}
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
            {truncatedTitle}
          </div>

          {/* Speaker */}
          <div
            style={{
              color: '#a5b4fc',
              fontSize: 20,
            }}
          >
            {talkData.speakerName}
          </div>
        </div>

        {/* Card Image - overlays bottom-right corner of thumbnail */}
        {cardImageUrl && (
          <div
            style={{
              position: 'absolute',
              left: 580,
              top: 220,
              display: 'flex',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
            }}
          >
            <img
              src={cardImageUrl}
              alt={primaryCard?.name || ''}
              width={190}
              height={375}
              style={{
                borderRadius: 12,
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Rationale - positioned to the right of card */}
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
            {rationale}
          </div>
        )}
      </div>
    ),
    { ...size, ...fontOptions }
  );
}
