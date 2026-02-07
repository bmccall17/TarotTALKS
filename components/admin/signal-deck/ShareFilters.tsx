'use client';

import { Search, X } from 'lucide-react';

type Props = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  platform: string;
  onPlatformChange: (platform: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  leftActions?: React.ReactNode;
};

const platforms = [
  { value: '', label: 'All Platforms' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'threads', label: 'Threads' },
  { value: 'other', label: 'Other' },
];

const statuses = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft (planned)' },
  { value: 'posted', label: 'Posted (logged)' },
  { value: 'verified', label: 'Verified (confirmed live)' },
  { value: 'discovered', label: 'Discovered (auto-found)' },
  { value: 'acknowledged', label: 'Acknowledged (dismissed)' },
];

export function ShareFilters({
  searchQuery,
  onSearchChange,
  platform,
  onPlatformChange,
  status,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearFilters,
  hasActiveFilters,
  leftActions,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Search and Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search notes, speaker..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Platform Filter */}
        <select
          value={platform}
          onChange={(e) => onPlatformChange(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {platforms.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date Range + Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        {leftActions}
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
