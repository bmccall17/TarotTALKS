'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
  theme?: Theme | null;
  onSave: () => void;
  onCancel: () => void;
};

const categoryOptions = [
  { value: '', label: 'Select category...' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'life_phase', label: 'Life Phase' },
  { value: 'role', label: 'Role' },
  { value: 'other', label: 'Other' },
];

export function ThemeForm({ theme, onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!theme;

  useEffect(() => {
    if (theme) {
      setName(theme.name);
      setSlug(theme.slug);
      setShortDescription(theme.shortDescription);
      setLongDescription(theme.longDescription || '');
      setCategory(theme.category || '');
    } else {
      setName('');
      setSlug('');
      setShortDescription('');
      setLongDescription('');
      setCategory('');
    }
  }, [theme]);

  // Auto-generate slug from name (only when creating)
  useEffect(() => {
    if (!isEditing && name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generatedSlug);
    }
  }, [name, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !shortDescription.trim()) {
      setError('Name and short description are required');
      return;
    }

    try {
      setLoading(true);

      const data = {
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        longDescription: longDescription.trim() || null,
        category: category || null,
      };

      const url = isEditing
        ? `/api/admin/themes/${theme.id}`
        : '/api/admin/themes';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save theme');
      }

      onSave();
    } catch (err) {
      console.error('Error saving theme:', err);
      setError(err instanceof Error ? err.message : 'Failed to save theme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">
            {isEditing ? 'Edit Theme' : 'Create Theme'}
          </h2>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Grief & Gratitude"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Slug (readonly when editing) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => !isEditing && setSlug(e.target.value)}
              placeholder="auto-generated-from-name"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-400 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              disabled={loading || isEditing}
            />
            {isEditing && (
              <p className="mt-1 text-xs text-gray-500">Slug cannot be changed after creation</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Short Description *
            </label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="A brief description for cards and lists..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>

          {/* Long Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Long Description
            </label>
            <textarea
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              placeholder="Optional detailed description..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Theme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
