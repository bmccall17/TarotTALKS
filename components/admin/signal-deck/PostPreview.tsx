'use client';

import { useState } from 'react';

type Props = {
  platform: 'x' | 'bluesky' | 'instagram' | 'linkedin' | 'threads' | 'other';
  caption: string;
  imageUrl?: string | null;
  cardName?: string;
  speakerHandle?: string;
};

const platformLabels: Record<string, string> = {
  x: 'X (Twitter)',
  bluesky: 'Bluesky',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  other: 'Other',
};

function InstagramPreview({ caption, imageUrl, cardName }: { caption: string; imageUrl?: string | null; cardName?: string }) {
  return (
    <div className="bg-black rounded-xl overflow-hidden max-w-[280px] mx-auto border border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-[8px] font-bold text-white">
          TT
        </div>
        <span className="text-xs font-semibold text-white">tarottalks.app</span>
      </div>
      {/* Image */}
      <div className="aspect-square bg-gray-800 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-600 text-sm">{cardName || 'Image'}</span>
        )}
      </div>
      {/* Caption */}
      <div className="px-3 py-2">
        <p className="text-[10px] text-gray-300 line-clamp-3">
          <span className="font-semibold text-white">tarottalks.app</span>{' '}
          {caption || 'Caption goes here...'}
        </p>
      </div>
    </div>
  );
}

function TwitterPreview({ caption, imageUrl, cardName }: { caption: string; imageUrl?: string | null; cardName?: string }) {
  return (
    <div className="bg-black rounded-xl overflow-hidden max-w-[300px] mx-auto border border-gray-700 p-3">
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          TT
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white">TarotTALKS</span>
            <span className="text-xs text-gray-500">@tarottalks</span>
          </div>
          <p className="text-xs text-gray-200 mt-1">
            {caption || 'Tweet text goes here...'}
          </p>
          {imageUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-700">
              <img src={imageUrl} alt="" className="w-full aspect-[1200/630] object-cover" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BlueskyPreview({ caption, imageUrl }: { caption: string; imageUrl?: string | null }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl overflow-hidden max-w-[300px] mx-auto border border-gray-700 p-3">
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          TT
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white">TarotTALKS</span>
            <span className="text-xs text-gray-500">@tarottalks.app</span>
          </div>
          <p className="text-xs text-gray-200 mt-1">
            {caption || 'Post text goes here...'}
          </p>
          {imageUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-700">
              <img src={imageUrl} alt="" className="w-full aspect-[1200/630] object-cover" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ caption, imageUrl, cardName }: { caption: string; imageUrl?: string | null; cardName?: string }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden max-w-[300px] mx-auto border border-gray-300">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white">
          TT
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-900 block">TarotTALKS</span>
          <span className="text-[10px] text-gray-500">tarottalks.app</span>
        </div>
      </div>
      {/* Text */}
      <div className="px-3 pb-2">
        <p className="text-[11px] text-gray-700 line-clamp-3">
          {caption || 'Post text goes here...'}
        </p>
      </div>
      {/* Article card */}
      {imageUrl && (
        <div className="border-t border-gray-200">
          <img src={imageUrl} alt="" className="w-full aspect-[1200/627] object-cover" />
          <div className="px-3 py-2 bg-gray-50">
            <p className="text-[10px] font-semibold text-gray-800 truncate">{cardName || 'tarottalks.app'}</p>
            <p className="text-[9px] text-gray-500">tarottalks.app</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function PostPreview({ platform, caption, imageUrl, cardName, speakerHandle }: Props) {
  switch (platform) {
    case 'instagram':
      return <InstagramPreview caption={caption} imageUrl={imageUrl} cardName={cardName} />;
    case 'x':
      return <TwitterPreview caption={caption} imageUrl={imageUrl} cardName={cardName} />;
    case 'bluesky':
      return <BlueskyPreview caption={caption} imageUrl={imageUrl} />;
    case 'linkedin':
      return <LinkedInPreview caption={caption} imageUrl={imageUrl} cardName={cardName} />;
    case 'threads':
      return <InstagramPreview caption={caption} imageUrl={imageUrl} cardName={cardName} />;
    default:
      return (
        <div className="text-xs text-gray-500 text-center py-4">
          No preview available for this platform
        </div>
      );
  }
}
