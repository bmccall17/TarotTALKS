/**
 * Instagram Image Route Handler for Cards
 * Generates 1080x1080 square images optimized for Instagram
 *
 * Usage: /cards/[slug]/instagram
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getCardWithMappings } from '@/lib/db/queries/cards';
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

  // Load fonts and card data in parallel
  const [fonts, cardData] = await Promise.all([
    loadFonts(),
    getCardWithMappings(slug).catch((error) => {
      console.error('Error fetching card data:', error);
      return null;
    }),
  ]);

  const { fontFamily, fontOptions } = getFontConfig(fonts);

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
            background: IMAGE_STYLES.gradient,
            color: IMAGE_STYLES.textWhite,
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

  const keywords: string[] = cardData.keywords ? JSON.parse(cardData.keywords) : [];
  const displayKeywords = keywords.slice(0, 4);

  const cardImageUrl = normalizeImageUrl(cardData.imageUrl) || '';
  const fullSummary = cardData.summary || '';

  // Truncate summary for square format (less space than landscape)
  const truncatedSummary =
    fullSummary.length > 120 ? fullSummary.slice(0, 117) + '...' : fullSummary;

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
            fontSize: 36,
            marginBottom: 30,
          }}
        >
          <span style={{ color: IMAGE_STYLES.brandGray }}>Tarot</span>
          <span style={{ color: IMAGE_STYLES.brandRed, fontWeight: 700 }}>TALKS</span>
        </div>

        {/* Card Image - centered, ~500px tall */}
        <div
          style={{
            width: 400,
            height: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 30,
          }}
        >
          <img
            src={cardImageUrl}
            alt={cardData.name}
            width={253}
            height={500}
            style={{
              borderRadius: 14,
              objectFit: 'contain',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
            }}
          />
        </div>

        {/* Card Name */}
        <div
          style={{
            color: IMAGE_STYLES.textWhite,
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
            color: IMAGE_STYLES.textMuted,
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
                background: IMAGE_STYLES.keywordBg,
                color: IMAGE_STYLES.textAccent,
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
            color: IMAGE_STYLES.brandGray,
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
