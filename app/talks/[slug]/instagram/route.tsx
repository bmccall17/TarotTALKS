/**
 * Instagram Image Route Handler for Talks
 * Generates 1080x1080 square images optimized for Instagram
 *
 * Usage: /talks/[slug]/instagram
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getTalkWithMappedCards } from '@/lib/db/queries/talks';
import {
  loadFonts,
  getFontConfig,
  generateSparkles,
  normalizeImageUrl,
  IMAGE_STYLES,
  IMAGE_SIZES,
} from '@/lib/image-utils';

export const runtime = 'nodejs';

const size = IMAGE_SIZES.instagram;

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

  const { fontFamily, fontOptions } = getFontConfig(fonts);

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
            background: IMAGE_STYLES.gradient,
            color: IMAGE_STYLES.textWhite,
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

  const talkThumbnailUrl = normalizeImageUrl(talkData.thumbnailUrl) || '';
  const cardImageUrl = primaryCard ? normalizeImageUrl(primaryCard.imageUrl) : null;

  // Truncate title if too long
  const displayTitle =
    talkData.title.length > 80 ? talkData.title.slice(0, 77) + '...' : talkData.title;

  // Generate sparkles for 1080x1080 canvas
  const sparkles = generateSparkles({ width: 1080, height: 1080, padding: 25 });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: IMAGE_STYLES.gradient,
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
          <span style={{ color: IMAGE_STYLES.brandGray }}>Tarot</span>
          <span style={{ color: IMAGE_STYLES.brandRed, fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Talk Thumbnail - prominent, 16:9 aspect ratio */}
        {talkThumbnailUrl && (
          <div
            style={{
              width: 560,
              height: 315,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
            }}
          >
            <img
              src={talkThumbnailUrl}
              alt={talkData.title}
              width={560}
              height={315}
              style={{
                objectFit: 'cover',
              }}
            />
          </div>
        )}

        {/* Talk Title */}
        <div
          style={{
            color: IMAGE_STYLES.textWhite,
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 12,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          "{displayTitle}"
        </div>

        {/* Speaker Name */}
        <div
          style={{
            color: IMAGE_STYLES.textAccent,
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
              alt={primaryCard.name}
              width={60}
              height={118}
              style={{
                borderRadius: 8,
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
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
                  color: IMAGE_STYLES.textMuted,
                  fontSize: 14,
                }}
              >
                Associated with
              </div>
              <div
                style={{
                  color: IMAGE_STYLES.textWhite,
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

        {/* Footer URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            color: IMAGE_STYLES.brandGray,
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
