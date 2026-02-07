'use client';

import { useState } from 'react';
import { Copy, Check, Twitter, Link2 } from 'lucide-react';
import { formatTagPack } from '@/lib/utils/social-handles';

// Bluesky butterfly icon (simplified SVG as component)
function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
    </svg>
  );
}

type MappingInfo = {
  cardName: string;
  cardSlug: string;
  isPrimary: boolean;
  rationaleShort: string | null;
};

type Props = {
  twitterHandle: string;
  blueskyHandle: string;
  linkedInHandle: string;
  instagramHandle: string;
  speakerName: string;
  talkTitle: string;
  year: number | null;
  eventName: string;
  mappings?: MappingInfo[];
};

export function TagPackCopyButton({
  twitterHandle,
  blueskyHandle,
  linkedInHandle,
  instagramHandle,
  speakerName,
  talkTitle,
  year,
  eventName,
  mappings = [],
}: Props) {
  const [copiedTwitter, setCopiedTwitter] = useState(false);
  const [copiedBluesky, setCopiedBluesky] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const twitterTagPack = formatTagPack('twitter', twitterHandle, true);
  const blueskyTagPack = formatTagPack('bluesky', blueskyHandle, true);

  const hasTwitter = !!twitterHandle?.trim();
  const hasBluesky = !!blueskyHandle?.trim();
  const hasLinkedIn = !!linkedInHandle?.trim();
  const hasInstagram = !!instagramHandle?.trim();

  // Get primary mapping (or first one if none is primary)
  const primaryMapping = mappings.find((m) => m.isPrimary) || mappings[0];

  // Build the full tag pack text
  const buildFullTagPack = (platform: 'twitter' | 'bluesky') => {
    const lines: string[] = [];
    const tags = platform === 'twitter' ? twitterTagPack : blueskyTagPack;

    // Talk info
    if (talkTitle) {
      const eventInfo = [eventName, year].filter(Boolean).join(' ');
      lines.push(`"${talkTitle}"${eventInfo ? ` (${eventInfo})` : ''}`);
    }

    // Card link and rationale
    if (primaryMapping) {
      const cardUrl = `https://tarottalks.app/cards/${primaryMapping.cardSlug}`;
      lines.push(`🃏 ${primaryMapping.cardName}: ${cardUrl}`);
      if (primaryMapping.rationaleShort) {
        lines.push(`💡 ${primaryMapping.rationaleShort}`);
      }
    }

    // Tags
    if (tags) {
      lines.push(`${tags}`);
    }

    return lines.join('\n');
  };

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyTwitter = () => copyToClipboard(twitterTagPack, setCopiedTwitter);
  const handleCopyBluesky = () => copyToClipboard(blueskyTagPack, setCopiedBluesky);
  const handleCopyFullTwitter = () => copyToClipboard(buildFullTagPack('twitter'), setCopiedFull);
  const handleCopyFullBluesky = () => copyToClipboard(buildFullTagPack('bluesky'), setCopiedFull);

  // Show preview even without handles (for the other info)
  const hasContent = talkTitle || primaryMapping;

  if (!hasContent && !hasTwitter && !hasBluesky) {
    return (
      <div className="text-sm text-gray-500 italic">
        Add speaker handles above to enable tag pack copying
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Full Preview */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Preview</p>

        {/* Talk Title & Event */}
        {talkTitle && (
          <div className="text-sm text-gray-200">
            "{talkTitle}"
            {(eventName || year) && (
              <span className="text-gray-400">
                {' '}({[eventName, year].filter(Boolean).join(' ')})
              </span>
            )}
          </div>
        )}

        {/* Card Link */}
        {primaryMapping && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-amber-400">🃏</span>
              <span className="text-amber-300">{primaryMapping.cardName}:</span>
              <code className="text-purple-300 bg-purple-900/20 px-2 py-0.5 rounded text-xs">
                tarottalks.app/cards/{primaryMapping.cardSlug}
              </code>
            </div>
            {primaryMapping.rationaleShort && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-yellow-400">💡</span>
                <span className="text-gray-300 italic">{primaryMapping.rationaleShort}</span>
              </div>
            )}
          </div>
        )}

        {/* Social Tags */}
        {hasTwitter && (
          <div className="flex items-center gap-2 text-sm">
            <Twitter className="w-4 h-4 text-gray-400" />
            <code className="text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded">{twitterTagPack}</code>
          </div>
        )}
        {hasBluesky && (
          <div className="flex items-center gap-2 text-sm">
            <BlueskyIcon className="w-4 h-4 text-gray-400" />
            <code className="text-sky-300 bg-sky-900/20 px-2 py-0.5 rounded">{blueskyTagPack}</code>
          </div>
        )}
        {hasLinkedIn && (
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-gray-400" />
            <code className="text-blue-200 bg-blue-900/20 px-2 py-0.5 rounded">
              linkedin.com/in/{linkedInHandle.trim().replace(/^@/, '')}
            </code>
          </div>
        )}
        {hasInstagram && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-4 h-4 text-gray-400 text-center text-xs leading-4">IG</span>
            <code className="text-pink-300 bg-pink-900/20 px-2 py-0.5 rounded">
              @{instagramHandle.trim().replace(/^@/, '')}
            </code>
          </div>
        )}
      </div>

      {/* Copy Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Tags Only */}
        {hasTwitter && (
          <button
            type="button"
            onClick={handleCopyTwitter}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-sm transition-colors"
          >
            {copiedTwitter ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Twitter className="w-4 h-4" />
                X Tags
              </>
            )}
          </button>
        )}

        {hasBluesky && (
          <button
            type="button"
            onClick={handleCopyBluesky}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-sm transition-colors"
          >
            {copiedBluesky ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <BlueskyIcon className="w-4 h-4" />
                Bluesky Tags
              </>
            )}
          </button>
        )}

        {/* Full Pack */}
        {hasTwitter && hasContent && (
          <button
            type="button"
            onClick={handleCopyFullTwitter}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm transition-colors"
          >
            {copiedFull ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Full X Post
              </>
            )}
          </button>
        )}

        {hasBluesky && hasContent && !hasTwitter && (
          <button
            type="button"
            onClick={handleCopyFullBluesky}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm transition-colors"
          >
            {copiedFull ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Full Bluesky Post
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
