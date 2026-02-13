'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2, RotateCcw, AlertTriangle, ExternalLink, ImagePlus, Check, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { HardDeleteDialog } from '../ui/HardDeleteDialog';

type Mapping = {
  talkId: string;
  isPrimary: boolean;
  cardImageUrl: string;
  cardName: string;
  cardSlug: string;
  cardId: string;
};

type Talk = {
  id: string;
  slug: string;
  title: string;
  speakerName: string;
  tedUrl: string | null;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  year: number | null;
  language: string | null;
  isDeleted: boolean;
  mappings: Mapping[];
  speakerTwitterHandle?: string | null;
  speakerBlueskyHandle?: string | null;
  shareImageUrl?: string | null;
};

type Props = {
  talk: Talk;
  onDeleted: () => void;
  onRestored: () => void;
  onHardDeleted: () => void;
};

export function TalkRow({ talk, onDeleted, onRestored, onHardDeleted }: Props) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenSuccess, setImageGenSuccess] = useState(false);

  const handleSoftDelete = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/talks/${talk.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete talk');

      onDeleted();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting talk:', error);
      alert('Failed to delete talk');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/talks/${talk.id}/restore`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to restore talk');

      onRestored();
      setShowRestoreDialog(false);
    } catch (error) {
      console.error('Error restoring talk:', error);
      alert('Failed to restore talk');
    } finally {
      setLoading(false);
    }
  };

  const handleHardDelete = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/talks/${talk.id}/hard-delete`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to hard delete talk');

      onHardDeleted();
      setShowHardDeleteDialog(false);
    } catch (error) {
      console.error('Error hard deleting talk:', error);
      alert('Failed to hard delete talk');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    try {
      setGeneratingImages(true);
      setImageGenSuccess(false);

      // Step 1: Upscale thumbnail if needed
      await fetch(`/api/admin/talks/${talk.id}/upscale-thumbnail`, { method: 'POST' });

      // Step 2: Generate share images
      const response = await fetch('/api/admin/share-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'talks',
          slug: talk.slug,
          types: ['opengraph', 'twitter', 'instagram'],
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

  const url = talk.tedUrl || talk.youtubeUrl;

  return (
    <>
      <tr
        className={talk.isDeleted ? 'bg-red-900/10' : 'hover:bg-gray-800/50'}
        title={talk.title}
      >
        <td className="px-6 py-0">
          <div className="flex items-stretch gap-3 h-full">
            <button
              onClick={() => router.push(`/admin/talks/${talk.id}/edit`)}
              className="flex-shrink-0 hover:ring-2 hover:ring-indigo-400 rounded transition-all"
            >
              {talk.thumbnailUrl ? (
                <img
                  src={talk.thumbnailUrl}
                  alt={talk.title}
                  className="w-24 h-full object-cover rounded"
                />
              ) : (
                <div className="w-24 h-full bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">No img</span>
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                  title={talk.title}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <p className={talk.isDeleted ? 'text-gray-500' : 'text-gray-300'}>
              {talk.speakerName}
            </p>
            {/* Social Handle Indicators */}
            {(talk.speakerTwitterHandle || talk.speakerBlueskyHandle) && (
              <div className="flex items-center gap-1">
                {talk.speakerTwitterHandle && (
                  <span
                    className="w-2 h-2 rounded-full bg-blue-400"
                    title={`X: @${talk.speakerTwitterHandle}`}
                  />
                )}
                {talk.speakerBlueskyHandle && (
                  <span
                    className="w-2 h-2 rounded-full bg-sky-400"
                    title={`Bluesky: @${talk.speakerBlueskyHandle}`}
                  />
                )}
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <p className="text-gray-400 text-sm">
            {talk.year || '—'}
          </p>
        </td>
        <td className="px-6 py-4">
          {talk.language ? (
            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
              {talk.language}
            </span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </td>
        <td className="px-6 py-0">
          <div className="flex items-stretch gap-1">
            {talk.mappings.length === 0 ? (
              <span className="text-gray-500 text-sm">None</span>
            ) : (
              <>
                {talk.mappings.slice(0, 3).map((mapping) => (
                  <a
                    key={mapping.cardId}
                    href={`/admin/cards/${mapping.cardId}/edit`}
                    className="relative group hover:ring-2 hover:ring-indigo-400 rounded transition-all"
                    title={mapping.cardName}
                  >
                    <img
                      src={mapping.cardImageUrl}
                      alt={mapping.cardName}
                      className="w-12 h-full object-cover rounded border border-gray-600"
                    />
                  </a>
                ))}
                {talk.mappings.length > 3 && (
                  <span className="text-xs text-gray-400 ml-1">
                    +{talk.mappings.length - 3}
                  </span>
                )}
              </>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          {talk.isDeleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-900/20 text-red-400 border border-red-500/30">
              Deleted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/20 text-green-400 border border-green-500/30">
              Active
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            {talk.isDeleted ? (
              <>
                <button
                  onClick={() => setShowRestoreDialog(true)}
                  className="p-2 text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Restore talk"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowHardDeleteDialog(true)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Permanently delete"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleGenerateImages}
                  disabled={generatingImages}
                  className={`p-2 rounded-lg transition-colors ${
                    imageGenSuccess
                      ? 'text-green-400 bg-green-900/20'
                      : talk.shareImageUrl
                        ? 'text-emerald-400 hover:bg-emerald-900/20'
                        : 'text-orange-400 hover:bg-orange-900/20'
                  }`}
                  title={talk.shareImageUrl ? 'Regenerate share images' : 'Upscale & create share images'}
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
                  onClick={() => router.push(`/admin/talks/${talk.id}/edit`)}
                  className="p-2 text-indigo-400 hover:bg-indigo-900/20 rounded-lg transition-colors"
                  title="Edit talk"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete talk"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Soft Delete Confirmation */}
      {showDeleteDialog && (
        <ConfirmDialog
          title="Delete Talk?"
          message={`Are you sure you want to delete "${talk.title}"? This is a soft delete and can be restored later.`}
          confirmLabel="Delete"
          onConfirm={handleSoftDelete}
          onCancel={() => setShowDeleteDialog(false)}
          loading={loading}
        />
      )}

      {/* Restore Confirmation */}
      {showRestoreDialog && (
        <ConfirmDialog
          title="Restore Talk?"
          message={`Are you sure you want to restore "${talk.title}"?`}
          confirmLabel="Restore"
          onConfirm={handleRestore}
          onCancel={() => setShowRestoreDialog(false)}
          loading={loading}
          variant="success"
        />
      )}

      {/* Hard Delete Confirmation */}
      {showHardDeleteDialog && (
        <HardDeleteDialog
          title={talk.title}
          mappingsCount={talk.mappings.length}
          onConfirm={handleHardDelete}
          onCancel={() => setShowHardDeleteDialog(false)}
          loading={loading}
        />
      )}
    </>
  );
}
