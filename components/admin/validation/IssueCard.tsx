'use client';

import { ExternalLink, Edit2, RefreshCw, Check } from 'lucide-react';
import Link from 'next/link';

type IssueType =
  | 'duplicateYoutube'
  | 'missingUrls'
  | 'missingThumbnail'
  | 'externalThumbnail'
  | 'shortDescription'
  | 'cardNoPrimary'
  | 'unmappedTalk'
  | 'missingLongRationale'
  | 'softDeleted'
  | 'missingSocialHandles'
  | 'unpostedCard';

type DuplicateYoutubeData = {
  youtubeVideoId: string;
  talks: Array<{ id: string; title: string; speakerName: string; slug: string }>;
};

type TalkData = {
  id: string;
  title: string;
  speakerName: string;
  slug: string;
  youtubeUrl?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  tedUrl?: string | null;
  youtubeVideoId?: string | null;
  deletedAt?: Date | null;
  speakerTwitterHandle?: string | null;
  speakerBlueskyHandle?: string | null;
};

type CardData = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  mappingsCount: number;
};

type MappingData = {
  mappingId: string;
  cardId: string;
  cardName: string;
  cardSlug: string;
  cardImageUrl: string;
  talkId: string;
  talkTitle: string;
  talkSpeakerName: string;
  talkSlug: string;
  rationaleShort: string | null;
};

type UnpostedCardData = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  sequenceIndex: number;
};

type Props = {
  type: IssueType;
  data: DuplicateYoutubeData | TalkData | CardData | MappingData | UnpostedCardData;
  onFix?: (type: IssueType, data: any) => void;
  isFixed?: boolean;
  isFixing?: boolean;
};

export function IssueCard({ type, data, onFix, isFixed, isFixing }: Props) {
  // Duplicate YouTube IDs
  if (type === 'duplicateYoutube') {
    const item = data as DuplicateYoutubeData;
    return (
      <div className={`bg-gray-900/50 border rounded-lg p-4 transition-all ${isFixed ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-300">
              YouTube ID: <code className="text-red-400">{item.youtubeVideoId}</code>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Used by {item.talks.length} talks
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFixed && <Check className="w-4 h-4 text-green-400" />}
            <a
              href={`https://www.youtube.com/watch?v=${item.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            >
              <ExternalLink className="w-3 h-3" />
              View on YouTube
            </a>
          </div>
        </div>
        <div className="space-y-2 mb-3">
          {item.talks.map((talk) => (
            <div
              key={talk.id}
              className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2"
            >
              <div>
                <p className="text-sm text-gray-100">{talk.title}</p>
                <p className="text-xs text-gray-400">{talk.speakerName}</p>
              </div>
              <Link
                href={`/admin/talks/${talk.id}/edit`}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </Link>
            </div>
          ))}
        </div>
        <button
          onClick={() => onFix?.(type, data)}
          disabled={isFixing || isFixed}
          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFixing ? (
            <>
              <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
              Fixing...
            </>
          ) : isFixed ? (
            <>
              <Check className="w-3 h-3" />
              Fixed
            </>
          ) : (
            <>
              <Edit2 className="w-3 h-3" />
              Resolve Inline
            </>
          )}
        </button>
      </div>
    );
  }

  // Talk-based issues
  if (
    type === 'missingUrls' ||
    type === 'missingThumbnail' ||
    type === 'externalThumbnail' ||
    type === 'shortDescription' ||
    type === 'unmappedTalk' ||
    type === 'softDeleted' ||
    type === 'missingSocialHandles'
  ) {
    const item = data as TalkData;

    const getActionLabel = () => {
      if (isFixed) return 'Fixed';
      if (isFixing) return 'Fixing...';

      switch (type) {
        case 'missingUrls':
          return 'Add URLs';
        case 'missingThumbnail':
          return 'Fetch Thumbnail';
        case 'externalThumbnail':
          return 'Download to Local';
        case 'shortDescription':
          return 'Edit Description';
        case 'unmappedTalk':
          return 'Add Mapping';
        case 'softDeleted':
          return 'Restore';
        case 'missingSocialHandles':
          return 'Add Handles';
        default:
          return 'Fix';
      }
    };

    const getActionLink = () => {
      if (type === 'unmappedTalk') {
        return '/admin/mappings';
      }
      return `/admin/talks/${item.id}/edit`;
    };

    return (
      <div className={`flex items-center justify-between bg-gray-900/50 border rounded-lg p-4 transition-all ${isFixed ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'}`}>
        <div className="flex items-center gap-4">
          {item.thumbnailUrl && (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="w-16 h-9 object-cover rounded"
            />
          )}
          <div>
            <p className="text-sm font-medium text-gray-100">{item.title}</p>
            <p className="text-xs text-gray-400">{item.speakerName}</p>
            {type === 'shortDescription' && item.description && (
              <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                Current: "{item.description}"
              </p>
            )}
            {type === 'externalThumbnail' && item.thumbnailUrl && (
              <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                External: {item.thumbnailUrl.substring(0, 60)}...
              </p>
            )}
            {type === 'softDeleted' && item.deletedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Deleted: {new Date(item.deletedAt).toLocaleDateString()}
              </p>
            )}
            {type === 'missingSocialHandles' && (
              <p className="text-xs text-gray-500 mt-1">
                Missing: {!item.speakerTwitterHandle && !item.speakerBlueskyHandle ? 'Both' : !item.speakerTwitterHandle ? 'X/Twitter' : 'Bluesky'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFixed && <Check className="w-4 h-4 text-green-400" />}
          <button
            onClick={() => onFix?.(type, data)}
            disabled={isFixing || isFixed}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFixing ? (
              <>
                <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                Fixing...
              </>
            ) : isFixed ? (
              <>
                <Check className="w-3 h-3" />
                Fixed
              </>
            ) : (
              <>
                <Edit2 className="w-3 h-3" />
                {getActionLabel()}
              </>
            )}
          </button>
          <Link
            href={getActionLink()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </Link>
        </div>
      </div>
    );
  }

  // Card-based issues
  if (type === 'cardNoPrimary') {
    const item = data as CardData;
    return (
      <div className={`flex items-center justify-between bg-gray-900/50 border rounded-lg p-4 transition-all ${isFixed ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'}`}>
        <div className="flex items-center gap-4">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-10 h-14 object-cover rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-100">{item.name}</p>
            <p className="text-xs text-gray-400">
              {item.mappingsCount} mapping{item.mappingsCount !== 1 ? 's' : ''}, no primary
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFixed && <Check className="w-4 h-4 text-green-400" />}
          <button
            onClick={() => onFix?.(type, data)}
            disabled={isFixing || isFixed}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFixing ? (
              <>
                <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                Setting...
              </>
            ) : isFixed ? (
              <>
                <Check className="w-3 h-3" />
                Fixed
              </>
            ) : (
              <>
                <Edit2 className="w-3 h-3" />
                Set Primary
              </>
            )}
          </button>
          <Link
            href={`/admin/mappings?card=${item.slug}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </Link>
        </div>
      </div>
    );
  }

  // Mapping-based issues (missing long rationale)
  if (type === 'missingLongRationale') {
    const item = data as MappingData;
    return (
      <div className={`flex items-center justify-between bg-gray-900/50 border rounded-lg p-4 transition-all ${isFixed ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'}`}>
        <div className="flex items-center gap-4">
          <img
            src={item.cardImageUrl}
            alt={item.cardName}
            className="w-10 h-14 object-cover rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-100">{item.cardName}</p>
            <p className="text-xs text-gray-400">
              → {item.talkTitle} <span className="text-gray-500">by {item.talkSpeakerName}</span>
            </p>
            {item.rationaleShort && (
              <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                Short: "{item.rationaleShort}"
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFixed && <Check className="w-4 h-4 text-green-400" />}
          <Link
            href={`/admin/mappings?cardId=${item.cardId}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Add Long Rationale
          </Link>
        </div>
      </div>
    );
  }

  // Unposted cards
  if (type === 'unpostedCard') {
    const item = data as UnpostedCardData;
    return (
      <div className={`flex items-center justify-between bg-gray-900/50 border rounded-lg p-4 transition-all ${isFixed ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700'}`}>
        <div className="flex items-center gap-4">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-10 h-14 object-cover rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-100">{item.name}</p>
            <p className="text-xs text-gray-500">Not yet shared on any platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFixed && <Check className="w-4 h-4 text-green-400" />}
          <Link
            href={`/admin/signal-deck`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Create Share
          </Link>
          <Link
            href={`/cards/${item.slug}`}
            target="_blank"
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
