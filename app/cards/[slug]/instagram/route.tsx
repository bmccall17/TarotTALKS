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
import {
  loadFonts,
  getFontConfig,
  generateSparkles,
  normalizeImageUrl,
  IMAGE_STYLES,
  IMAGE_SIZES,
  FontData,
} from '@/lib/image-utils';

export const runtime = 'nodejs';

const size = IMAGE_SIZES.instagram;

// Type for card data with mappings
type CardData = NonNullable<Awaited<ReturnType<typeof getCardWithMappings>>>;

/**
 * Render the card-only version (original design)
 */
function renderCardOnly(
  cardData: CardData,
  fontFamily: string,
  sparkles: ReturnType<typeof generateSparkles>
) {
  const keywords: string[] = cardData.keywords ? JSON.parse(cardData.keywords) : [];
  const displayKeywords = keywords.slice(0, 4);
  const cardImageUrl = normalizeImageUrl(cardData.imageUrl) || '';
  const fullSummary = cardData.summary || '';
  const truncatedSummary =
    fullSummary.length > 120 ? fullSummary.slice(0, 117) + '...' : fullSummary;

  return (
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
  );
}

/**
 * Render the card+talk version (new default design)
 * Layout: Card prominent on left, name centered under brand, talk full-width below
 */
function renderCardWithTalk(
  cardData: CardData,
  fontFamily: string,
  sparkles: ReturnType<typeof generateSparkles>
) {
  const keywords: string[] = cardData.keywords ? JSON.parse(cardData.keywords) : [];
  const displayKeywords = keywords.slice(0, 3);
  const cardImageUrl = normalizeImageUrl(cardData.imageUrl) || '';

  // Get the primary talk from mappings
  const primaryMapping = cardData.mappings[0];
  const primaryTalk = primaryMapping?.talk;
  const talkThumbnailUrl = primaryTalk?.thumbnailUrl
    ? normalizeImageUrl(primaryTalk.thumbnailUrl)
    : null;

  return (
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
          marginBottom: 12,
        }}
      >
        <span style={{ color: IMAGE_STYLES.brandGray }}>Tarot</span>
        <span style={{ color: IMAGE_STYLES.brandRed, fontWeight: 700 }}>TALKS</span>
      </div>

      {/* Card Name - Prominent, centered under brand */}
      <div
        style={{
          color: IMAGE_STYLES.textWhite,
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
          alt={cardData.name}
          width={280}
          height={550}
          style={{
            borderRadius: 14,
            objectFit: 'contain',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
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
          {talkThumbnailUrl && (
            <img
              src={talkThumbnailUrl}
              alt={primaryTalk.title}
              width={1000}
              height={180}
              style={{
                width: '100%',
                height: 180,
                objectFit: 'cover',
              }}
            />
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
                color: IMAGE_STYLES.textWhite,
                fontSize: 20,
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              {primaryTalk.title.length > 70
                ? primaryTalk.title.slice(0, 67) + '...'
                : primaryTalk.title}
            </div>
            <div
              style={{
                color: IMAGE_STYLES.textAccent,
                fontSize: 16,
              }}
            >
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
          color: IMAGE_STYLES.brandGray,
          fontSize: 18,
        }}
      >
        tarottalks.app
      </div>
    </div>
  );
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

  // Generate sparkles for 1080x1080 canvas
  const sparkles = generateSparkles({ width: 1080, height: 1080, padding: 25 });

  // Render based on variant
  if (variant === 'card') {
    // Card-only version (legacy)
    return new ImageResponse(renderCardOnly(cardData, fontFamily, sparkles), {
      ...size,
      ...fontOptions,
    });
  }

  // Default: Card+Talk version
  return new ImageResponse(renderCardWithTalk(cardData, fontFamily, sparkles), {
    ...size,
    ...fontOptions,
  });
}
