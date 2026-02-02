'use client';

import { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';

type Theme = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string | null;
  category: 'emotion' | 'life_phase' | 'role' | 'other' | null;
  cardsCount: number;
  talksCount: number;
};

type Props = {
  theme: Theme;
  onEdit: (theme: Theme) => void;
  onDeleted: () => void;
};

const categoryColors: Record<string, string> = {
  emotion: 'bg-pink-900/30 text-pink-300 border-pink-500/30',
  life_phase: 'bg-blue-900/30 text-blue-300 border-blue-500/30',
  role: 'bg-purple-900/30 text-purple-300 border-purple-500/30',
  other: 'bg-gray-700/30 text-gray-300 border-gray-500/30',
};

const categoryLabels: Record<string, string> = {
  emotion: 'Emotion',
  life_phase: 'Life Phase',
  role: 'Role',
  other: 'Other',
};

export function ThemeRow({ theme, onEdit, onDeleted }: Props) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/themes/${theme.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete theme');

      onDeleted();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting theme:', error);
      alert('Failed to delete theme');
    } finally {
      setLoading(false);
    }
  };

  const categoryKey = theme.category || 'other';

  return (
    <>
      <tr className="hover:bg-gray-800/50">
        <td className="px-6 py-4">
          <div>
            <p className="text-gray-100 font-medium">{theme.name}</p>
            <p className="text-gray-500 text-sm">{theme.slug}</p>
          </div>
        </td>
        <td className="px-6 py-4">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${categoryColors[categoryKey]}`}
          >
            {categoryLabels[categoryKey]}
          </span>
        </td>
        <td className="px-6 py-4">
          <p className="text-gray-400 text-sm line-clamp-2">
            {theme.shortDescription}
          </p>
        </td>
        <td className="px-6 py-4">
          <span className="text-gray-300">{theme.cardsCount}</span>
        </td>
        <td className="px-6 py-4">
          <span className="text-gray-300">{theme.talksCount}</span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onEdit(theme)}
              className="p-2 text-indigo-400 hover:bg-indigo-900/20 rounded-lg transition-colors"
              title="Edit theme"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete theme"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Delete Confirmation */}
      {showDeleteDialog && (
        <ConfirmDialog
          title="Delete Theme?"
          message={`Are you sure you want to delete "${theme.name}"? This will remove it from ${theme.cardsCount} cards and ${theme.talksCount} talks.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          loading={loading}
        />
      )}
    </>
  );
}
