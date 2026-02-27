'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Radio, CheckSquare, Download } from 'lucide-react';
import { ShareRow } from './ShareRow';
import { ShareFilters } from './ShareFilters';
import { NewShareForm } from './NewShareForm';
import { TopSharesWidget } from './TopSharesWidget';
import { NextCardWidget } from './NextCardWidget';
import { MentionsInbox } from './MentionsInbox';
import { ExportToCampaign } from './ExportToCampaign';
import { AutoRefreshStatus } from './AutoRefreshStatus';
import { Toast } from '../ui/Toast';
import { type Platform } from '@/lib/utils/social-handles';

type Share = {
  id: string;
  platform: Platform;
  postUrl: string | null;
  status: 'draft' | 'posted' | 'verified' | 'discovered' | 'acknowledged';
  postedAt: string;
  sharedUrl: string | null;
  speakerHandle: string | null;
  speakerName: string | null;
  notes: string | null;
  card?: { id: string; name: string; slug: string; imageUrl: string } | null;
  talk?: { id: string; title: string; slug: string; speakerName: string; thumbnailUrl: string | null } | null;
  // Phase 2-4 fields
  likeCount?: number | null;
  repostCount?: number | null;
  replyCount?: number | null;
  metricsUpdatedAt?: string | null;
  metricsSource?: 'auto' | 'manual' | null;
  followingSpeaker?: boolean | null;
  authorHandle?: string | null;
  authorDisplayName?: string | null;
  showPublicly?: boolean;
};

type Stats = {
  today: number;
  thisWeek: number;
  total: number;
};

function groupSharesByDate(shares: Share[]): Record<string, Share[]> {
  const groups: Record<string, Share[]> = {};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  shares.forEach((share) => {
    const postedAt = new Date(share.postedAt);
    let groupKey: string;

    if (postedAt >= todayStart) {
      groupKey = 'Today';
    } else if (postedAt >= yesterdayStart) {
      groupKey = 'Yesterday';
    } else if (postedAt >= weekStart) {
      groupKey = 'This Week';
    } else {
      groupKey = 'Earlier';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(share);
  });

  return groups;
}

export function SharesList() {
  const [shares, setShares] = useState<Share[]>([]);
  const [stats, setStats] = useState<Stats>({ today: 0, thisWeek: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [editingShare, setEditingShare] = useState<Share | null>(null);
  const [preselectedCard, setPreselectedCard] = useState<{
    id: string;
    slug: string;
    name: string;
    tagPackText?: string;
    speakerName?: string;
    speakerHandle?: string;
  } | null>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const hasActiveFilters = !!(searchQuery || platform || status || dateFrom || dateTo);

  const fetchShares = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (platform) params.set('platform', platform);
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        params.set('dateTo', endDate.toISOString());
      }

      const response = await fetch(`/api/admin/social-shares?${params}`);
      if (!response.ok) throw new Error('Failed to fetch shares');

      const data = await response.json();
      setShares(data.shares);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching shares:', error);
      showToast('Failed to load shares', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, platform, status, dateFrom, dateTo]);

  useEffect(() => {
    const timeoutId = setTimeout(fetchShares, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchShares]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setPlatform('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    setShowExportModal(true);
  };

  const handleNewShare = () => {
    setEditingShare(null);
    setPreselectedCard(null);
    setShowForm(true);
  };

  const handleCreateShareForCard = (card: {
    id: string;
    slug: string;
    name: string;
    tagPackText?: string;
    speakerName?: string;
    speakerHandle?: string;
  }) => {
    setEditingShare(null);
    setPreselectedCard(card);
    setShowForm(true);
  };

  const handleEditShare = (share: Share) => {
    setEditingShare(share);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingShare(null);
    showToast(editingShare ? 'Share updated' : 'Share logged', 'success');
    fetchShares();
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingShare(null);
    setPreselectedCard(null);
  };

  const handleShareDeleted = () => {
    showToast('Share deleted', 'success');
    fetchShares();
  };

  const groupedShares = groupSharesByDate(shares);
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Radio className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Signal Deck</h1>
            <p className="text-sm text-gray-400">Track your social media shares</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AutoRefreshStatus onRefreshComplete={fetchShares} />
          <button
            onClick={handleNewShare}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Share</span>
          </button>
        </div>
      </div>

      {/* Stats Bar + Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-100">{stats.today}</div>
            <div className="text-xs text-gray-400">Today</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-100">{stats.thisWeek}</div>
            <div className="text-xs text-gray-400">This Week</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-100">{stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
        </div>
        {/* Top Shares Widget */}
        <TopSharesWidget />
        {/* Next Card to Post Widget */}
        <NextCardWidget onCreateShare={handleCreateShareForCard} />
      </div>

      {/* Mentions Inbox */}
      <MentionsInbox />

      {/* Filters */}
      <ShareFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        platform={platform}
        onPlatformChange={setPlatform}
        status={status}
        onStatusChange={setStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        leftActions={
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={handleExportSelected}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export {selectedIds.size}</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectMode(!selectMode);
                if (selectMode) setSelectedIds(new Set());
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                selectMode
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{selectMode ? 'Cancel' : 'Select'}</span>
            </button>
          </div>
        }
      />

      {/* Shares List */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading shares...</div>
        ) : shares.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {hasActiveFilters
                ? 'No shares match your filters'
                : 'No shares logged yet'}
            </div>
            {!hasActiveFilters && (
              <button
                onClick={handleNewShare}
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                Log your first share
              </button>
            )}
          </div>
        ) : (
          groupOrder.map((group) => {
            const groupShares = groupedShares[group];
            if (!groupShares || groupShares.length === 0) return null;

            return (
              <div key={group}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {group}
                </h3>
                <div className="space-y-3">
                  {groupShares.map((share) => (
                    <ShareRow
                      key={share.id}
                      share={share}
                      onEdit={handleEditShare}
                      onDeleted={handleShareDeleted}
                      onStatusChanged={fetchShares}
                      selectable={selectMode}
                      selected={selectedIds.has(share.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New/Edit Form Modal */}
      {showForm && (
        <NewShareForm
          share={editingShare}
          preselectedCard={preselectedCard}
          onSave={handleFormSave}
          onClose={handleFormClose}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportToCampaign
          shares={shares.filter((s) => selectedIds.has(s.id))}
          onClose={() => {
            setShowExportModal(false);
            setSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* Toast */}
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
