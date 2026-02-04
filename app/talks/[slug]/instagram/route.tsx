/**
 * Instagram Image Route Handler for Talks
 * Generates 1080x1080 square images optimized for Instagram
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
import { getThumbnailUrl } from '@/lib/utils/thumbnails';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

const size = { width: 1080, height: 1080 };

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
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const [fonts, talkData] = await Promise.all([
      loadFonts(),
      getTalkWithMappedCards(slug),
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

    // Get primary card
    const primaryCard = talkData.mappedCards[0]?.card;

    // Get thumbnail URL
    const thumbnailUrl = getThumbnailUrl(talkData.thumbnailUrl, talkData.youtubeVideoId);
    const fullThumbnailUrl = thumbnailUrl?.startsWith('http')
      ? thumbnailUrl
      : thumbnailUrl
        ? `https://tarottalks.app${thumbnailUrl}`
        : null;

    // Card image URL
    const cardImageUrl = primaryCard?.imageUrl?.startsWith('http')
      ? primaryCard.imageUrl
      : primaryCard?.imageUrl
        ? `https://tarottalks.app${primaryCard.imageUrl}`
        : null;

    // Truncate title
    const displayTitle = talkData.title.length > 80
      ? talkData.title.slice(0, 77) + '...'
      : talkData.title;

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
            fontFamily,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', fontSize: 32, marginBottom: 24 }}>
            <span style={{ color: '#9ca3af' }}>Tarot</span>
            <span style={{ color: '#EB0028', fontWeight: 700 }}>TALKS</span>
          </div>

          {/* Thumbnail */}
          {fullThumbnailUrl ? (
            <img
              src={fullThumbnailUrl}
              width={560}
              height={315}
              style={{ borderRadius: 16, objectFit: 'cover', marginBottom: 28 }}
            />
          ) : (
            <div
              style={{
                width: 560,
                height: 315,
                borderRadius: 16,
                background: '#374151',
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

          {/* Title */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 12,
              textAlign: 'center',
              maxWidth: 900,
            }}
          >
            {displayTitle}
          </div>

          {/* Speaker */}
          <div style={{ color: '#a5b4fc', fontSize: 24, marginBottom: 28 }}>
            by {talkData.speakerName}
          </div>

          {/* Card */}
          {primaryCard && cardImageUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 16,
                padding: 16,
              }}
            >
              <img
                src={cardImageUrl}
                width={60}
                height={118}
                style={{ borderRadius: 8, objectFit: 'contain' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#d1d5db', fontSize: 14 }}>Associated with</span>
                <span style={{ color: '#ffffff', fontSize: 22, fontWeight: 600 }}>
                  {primaryCard.name}
                </span>
              </div>
            </div>
          )}
        </div>
      ),
      { ...size, ...fontOptions }
    );
  } catch (error) {
    console.error('Talk Instagram error:', error);
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#7f1d1d',
            color: '#ffffff',
            fontSize: 24,
            padding: 40,
          }}
        >
          <div>Error: {error instanceof Error ? error.message : 'Unknown'}</div>
        </div>
      ),
      { ...size }
    );
  }
}
