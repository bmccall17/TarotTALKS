'use client';

import { ExternalLink } from 'lucide-react';

type TalkFormData = {
  title: string;
  speakerName: string;
  tedUrl: string;
  youtubeUrl: string;
  description: string;
  durationSeconds: number | null;
  year: number | null;
  eventName: string;
  thumbnailUrl: string;
  language: string;
};

type Props = {
  data: TalkFormData;
  slug?: string;
};

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function TalkPreview({ data, slug }: Props) {
  const primaryUrl = data.tedUrl.trim() !== '' ? data.tedUrl : data.youtubeUrl;
  const hasContent = data.title || data.speakerName || primaryUrl;

  if (!hasContent) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
        <p className="text-gray-400">Preview will appear as you fill in the form</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      {/* Thumbnail */}
      {data.thumbnailUrl && (
        slug ? (
          <a
            href={`https://tarottalks.app/talks/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full aspect-video bg-gray-900 hover:opacity-90 transition-opacity"
          >
            <img
              src={data.thumbnailUrl}
              alt={data.title || 'Talk thumbnail'}
              className="w-full h-full object-cover"
            />
          </a>
        ) : (
          <div className="w-full aspect-video bg-gray-900">
            <img
              src={data.thumbnailUrl}
              alt={data.title || 'Talk thumbnail'}
              className="w-full h-full object-cover"
            />
          </div>
        )
      )}

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Title */}
        {data.title && (
          slug ? (
            <a
              href={`https://tarottalks.app/talks/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xl font-bold text-gray-100 hover:text-indigo-300 transition-colors"
            >
              {data.title}
            </a>
          ) : (
            <h3 className="text-xl font-bold text-gray-100">
              {data.title}
            </h3>
          )
        )}

        {/* Speaker */}
        {data.speakerName && (
          <p className="text-lg text-indigo-400">
            {data.speakerName}
          </p>
        )}

        {/* Metadata Row */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          {data.year && (
            <div>
              <span className="font-medium">Year:</span> {data.year}
            </div>
          )}
          {data.durationSeconds && (
            <div>
              <span className="font-medium">Duration:</span> {formatDuration(data.durationSeconds)}
            </div>
          )}
          {data.eventName && (
            <div>
              <span className="font-medium">Event:</span> {data.eventName}
            </div>
          )}
          {data.language && data.language !== 'en' && (
            <div>
              <span className="font-medium">Language:</span> {data.language.toUpperCase()}
            </div>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-gray-300 text-sm line-clamp-3">
            {data.description}
          </p>
        )}

        {/* URLs */}
        <div className="pt-4 border-t border-gray-700 space-y-2">
          {data.tedUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400">TED.com:</span>
              <a
                href={data.tedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 truncate"
              >
                {data.tedUrl}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {primaryUrl === data.tedUrl && (
                <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">
                  Primary
                </span>
              )}
            </div>
          )}
          {data.youtubeUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400">YouTube:</span>
              <a
                href={data.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 truncate"
              >
                {data.youtubeUrl}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {primaryUrl === data.youtubeUrl && (
                <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">
                  Primary
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
