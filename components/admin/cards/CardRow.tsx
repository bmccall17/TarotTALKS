'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, ImagePlus, Check, RefreshCw } from 'lucide-react';
import Image from 'next/image';

type Mapping = {
  cardId: string;
  isPrimary: boolean;
  talkThumbnailUrl: string | null;
  talkTitle: string;
  talkSlug: string;
  talkId: string;
};

type Card = {
  id: string;
  slug: string;
  name: string;
  arcanaType: 'major' | 'minor';
  suit: 'wands' | 'cups' | 'swords' | 'pentacles' | null;
  number: number | null;
  imageUrl: string;
  summary: string;
  mappings: Mapping[];
  shareImageUrl?: string | null;
};

type Props = {
  card: Card;
};

export function CardRow({ card }: Props) {
  const router = useRouter();
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenSuccess, setImageGenSuccess] = useState(false);

  const handleGenerateImages = async () => {
    try {
      setGeneratingImages(true);
      setImageGenSuccess(false);

      const response = await fetch('/api/admin/share-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'cards',
          slug: card.slug,
          types: ['opengraph', 'twitter', 'instagram', 'instagram-card-only'],
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      setImageGenSuccess(true);
      setTimeout(() => setImageGenSuccess(false), 3000);
    } catch (error) {
      console.error('Error generating images:', error);
      alert('Failed to generate share images');
    } finally {
      setGeneratingImages(false);
    }
  };

  const arcanaLabel = card.arcanaType === 'major'
    ? 'Major Arcana'
    : card.suit
      ? card.suit.charAt(0).toUpperCase() + card.suit.slice(1)
      : 'Minor Arcana';

  return (
    <tr className="hover:bg-gray-800/50">
      <td className="px-6 py-0">
        <div className="flex items-stretch gap-3 h-full">
          <button
            onClick={() => router.push(`/admin/cards/${card.id}/edit`)}
            className="w-14 h-full relative flex-shrink-0 bg-gray-900 rounded overflow-hidden hover:ring-2 hover:ring-indigo-400 transition-all"
          >
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              className="object-cover"
            />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-100">
              {card.name}
            </p>
            <p className="text-xs text-gray-500 mt-1">/{card.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-gray-300 text-sm">
          {arcanaLabel}
        </p>
      </td>
      <td className="px-6 py-0">
        <div className="flex items-stretch gap-1">
          {card.mappings.length === 0 ? (
            <span className="text-gray-500 text-sm">None</span>
          ) : (
            <>
              {card.mappings.slice(0, 3).map((mapping) => (
                <a
                  key={mapping.talkId}
                  href={`/admin/talks/${mapping.talkId}/edit`}
                  className="relative group hover:ring-2 hover:ring-indigo-400 rounded transition-all"
                  title={mapping.talkTitle}
                >
                  {mapping.talkThumbnailUrl ? (
                    <img
                      src={mapping.talkThumbnailUrl}
                      alt={mapping.talkTitle}
                      className="w-16 h-full object-cover rounded border border-gray-600"
                    />
                  ) : (
                    <div className="w-16 h-full bg-gray-700 rounded border border-gray-600 flex items-center justify-center">
                      <span className="text-[8px] text-gray-500">No img</span>
                    </div>
                  )}
                </a>
              ))}
              {card.mappings.length > 3 && (
                <span className="text-xs text-gray-400 ml-1">
                  +{card.mappings.length - 3}
                </span>
              )}
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleGenerateImages}
            disabled={generatingImages}
            className={`p-2 rounded-lg transition-colors ${
              imageGenSuccess
                ? 'text-green-400 bg-green-900/20'
                : card.shareImageUrl
                  ? 'text-emerald-400 hover:bg-emerald-900/20'
                  : 'text-orange-400 hover:bg-orange-900/20'
            }`}
            title={card.shareImageUrl ? 'Regenerate share images' : 'Generate share images'}
          >
            {generatingImages ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : imageGenSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => router.push(`/admin/cards/${card.id}/edit`)}
            className="p-2 text-indigo-400 hover:bg-indigo-900/20 rounded-lg transition-colors"
            title="Edit card"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
