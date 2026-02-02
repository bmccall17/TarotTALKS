'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { ThemeRow } from './ThemeRow';
import { ThemeForm } from './ThemeForm';
import { Toast } from '../ui/Toast';

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

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'life_phase', label: 'Life Phase' },
  { value: 'role', label: 'Role' },
  { value: 'other', label: 'Other' },
];

export function ThemesList() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/admin/themes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch themes');

      const data = await response.json();
      setThemes(data.themes);
    } catch (error) {
      console.error('Error fetching themes:', error);
      showToast('Failed to load themes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(fetchThemes, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, categoryFilter]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleCreateClick = () => {
    setEditingTheme(null);
    setShowForm(true);
  };

  const handleEditClick = (theme: Theme) => {
    setEditingTheme(theme);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingTheme(null);
    showToast(editingTheme ? 'Theme updated successfully' : 'Theme created successfully', 'success');
    fetchThemes();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTheme(null);
  };

  const handleThemeDeleted = () => {
    showToast('Theme deleted successfully', 'success');
    fetchThemes();
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Theme</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="text-gray-400">
          <span className="font-medium text-gray-300">{themes.length}</span> themes
        </div>
      </div>

      {/* Themes Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading themes...</div>
        ) : themes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchQuery || categoryFilter
              ? 'No themes found matching your filters.'
              : 'No themes yet. Create your first one!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Theme
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cards
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Talks
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {themes.map((theme) => (
                  <ThemeRow
                    key={theme.id}
                    theme={theme}
                    onEdit={handleEditClick}
                    onDeleted={handleThemeDeleted}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <ThemeForm
          theme={editingTheme}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
