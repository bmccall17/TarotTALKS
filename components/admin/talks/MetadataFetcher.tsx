'use client';

import { useState } from 'react';
import { Download, AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type FetchedMetadata = {
  title: string | null;
  description: string | null;
  durationSeconds: number | null;
  year: number | null;
  thumbnailUrl: string | null;
  speakerName: string | null;
  eventName: string | null;
  source: {
    title?: 'ted' | 'youtube';
    description?: 'youtube';
    thumbnailUrl?: 'ted' | 'youtube';
    year?: 'youtube';
    durationSeconds?: 'youtube';
    speakerName?: 'ted' | 'youtube';
    eventName?: 'youtube';
  };
};

type Props = {
  tedUrl: string;
  youtubeUrl: string;
  onApplyMetadata: (metadata: Partial<{
    title: string;
    description: string;
    durationSeconds: number;
    year: number;
    thumbnailUrl: string;
    speakerName: string;
    eventName: string;
  }>) => void;
};

export function MetadataFetcher({ tedUrl, youtubeUrl, onApplyMetadata }: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchedData, setFetchedData] = useState<FetchedMetadata | null>(null);
  const [errors, setErrors] = useState<{ ted?: string; youtube?: string; tedThumbnail?: string }>({});
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    title: true,
    speakerName: true,
    eventName: true,
    description: true,
    durationSeconds: true,
    year: true,
    thumbnailUrl: true,
  });

  const canFetch = tedUrl.trim() !== '' || youtubeUrl.trim() !== '';

  const handleFetch = async () => {
    if (!canFetch) return;

    setLoading(true);
    setFetchedData(null);
    setErrors({});

    try {
      const response = await fetch('/api/admin/fetch-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for admin auth
        body: JSON.stringify({
          tedUrl: tedUrl.trim() || undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch metadata');
      }

      const data = await response.json();
      setFetchedData(data.merged);

      // Only set errors for APIs we actually tried to fetch from
      const newErrors: { ted?: string; youtube?: string; tedThumbnail?: string } = {};
      if (tedUrl.trim() && data.errors?.ted) {
        newErrors.ted = data.errors.ted;
      }
      if (youtubeUrl.trim() && data.errors?.youtube) {
        newErrors.youtube = data.errors.youtube;
      }
      // Thumbnail-specific warning (not a blocking error)
      if (data.errors?.tedThumbnail) {
        newErrors.tedThumbnail = data.errors.tedThumbnail;
      }
      setErrors(newErrors);
    } catch (error) {
      console.error('Error fetching metadata:', error);
      // General error - only show for the URL types we tried
      const newErrors: { ted?: string; youtube?: string; tedThumbnail?: string } = {};
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (tedUrl.trim()) newErrors.ted = errorMessage;
      if (youtubeUrl.trim()) newErrors.youtube = errorMessage;
      setErrors(newErrors);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!fetchedData) return;

    const metadata: Record<string, unknown> = {};

    if (selectedFields.title && fetchedData.title) {
      metadata.title = fetchedData.title;
    }
    if (selectedFields.speakerName && fetchedData.speakerName) {
      metadata.speakerName = fetchedData.speakerName;
    }
    if (selectedFields.eventName && fetchedData.eventName) {
      metadata.eventName = fetchedData.eventName;
    }
    if (selectedFields.description && fetchedData.description) {
      metadata.description = fetchedData.description;
    }
    if (selectedFields.durationSeconds && fetchedData.durationSeconds) {
      metadata.durationSeconds = fetchedData.durationSeconds;
    }
    if (selectedFields.year && fetchedData.year) {
      metadata.year = fetchedData.year;
    }
    if (selectedFields.thumbnailUrl && fetchedData.thumbnailUrl) {
      metadata.thumbnailUrl = fetchedData.thumbnailUrl;
    }

    onApplyMetadata(metadata);
    setFetchedData(null); // Close the preview
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Fetch Button */}
      <div>
        <button
          onClick={handleFetch}
          disabled={!canFetch || loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {loading ? 'Fetching Metadata...' : 'Fetch Metadata from TED/YouTube'}
        </button>
        {!canFetch && (
          <p className="text-xs text-gray-400 mt-2">
            Enter at least one URL above to fetch metadata
          </p>
        )}
      </div>

      {/* Errors and Warnings */}
      {(errors.ted || errors.youtube || errors.tedThumbnail) && (
        <div className="space-y-2">
          {errors.ted && (
            <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">TED.com Error</p>
                <p className="text-xs text-red-400">{errors.ted}</p>
              </div>
            </div>
          )}
          {errors.youtube && (
            <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">YouTube Error</p>
                <p className="text-xs text-red-400">{errors.youtube}</p>
              </div>
            </div>
          )}
          {errors.tedThumbnail && (
            <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300">TED Thumbnail Warning</p>
                <p className="text-xs text-yellow-400">{errors.tedThumbnail} - Using YouTube thumbnail instead</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fetched Data Preview */}
      {fetchedData && (
        <div className="bg-gray-900/50 border border-indigo-500/30 rounded-xl overflow-hidden">
          <div className="p-4 bg-indigo-900/20 border-b border-indigo-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h4 className="font-medium text-gray-100">Fetched Metadata</h4>
              </div>
              <p className="text-xs text-gray-400">
                Select fields to apply
              </p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Title */}
            {fetchedData.title && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.title}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, title: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Title</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from {fetchedData.source.title}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{fetchedData.title}</p>
                </div>
              </label>
            )}

            {/* Speaker Name */}
            {fetchedData.speakerName && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.speakerName}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, speakerName: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Speaker Name</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from {fetchedData.source.speakerName}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{fetchedData.speakerName}</p>
                </div>
              </label>
            )}

            {/* Event Name */}
            {fetchedData.eventName && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.eventName}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, eventName: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Event Name</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from {fetchedData.source.eventName}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{fetchedData.eventName}</p>
                </div>
              </label>
            )}

            {/* Description */}
            {fetchedData.description && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.description}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, description: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Description</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from youtube
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {fetchedData.description}
                  </p>
                </div>
              </label>
            )}

            {/* Duration */}
            {fetchedData.durationSeconds && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.durationSeconds}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, durationSeconds: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Duration</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from youtube
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {formatDuration(fetchedData.durationSeconds)}
                  </p>
                </div>
              </label>
            )}

            {/* Year */}
            {fetchedData.year && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.year}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, year: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Year</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from youtube
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{fetchedData.year}</p>
                </div>
              </label>
            )}

            {/* Thumbnail */}
            {fetchedData.thumbnailUrl && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFields.thumbnailUrl}
                  onChange={(e) =>
                    setSelectedFields({ ...selectedFields, thumbnailUrl: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">Thumbnail</span>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                      from {fetchedData.source.thumbnailUrl}
                    </span>
                  </div>
                  <img
                    src={fetchedData.thumbnailUrl}
                    alt="Thumbnail preview"
                    className="mt-2 w-48 h-auto rounded border border-gray-700"
                  />
                </div>
              </label>
            )}
          </div>

          {/* Apply Button */}
          <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-3">
            <button
              onClick={() => setFetchedData(null)}
              className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Apply Selected Fields
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
