'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { WeekPicker, getCurrentWeekStart } from './WeekPicker';
import { CalendarDayColumn } from './CalendarDayColumn';
import { GenerateWeekModal } from './GenerateWeekModal';

type Platform = 'bluesky' | 'x' | 'linkedin' | 'instagram' | 'threads' | 'other';

type CalendarItem = {
  id: string;
  dayOfWeek: number;
  contentType: string;
  platform: string;
  hook: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string | null;
  status: string;
  frameworkUsed: string | null;
  cardId: string | null;
  talkId: string | null;
  pushedShareId: string | null;
  card?: { id: string; name: string; slug: string; imageUrl: string } | null;
  talk?: { id: string; title: string; slug: string; speakerName: string } | null;
};

const PLATFORMS: { id: Platform; label: string; short: string }[] = [
  { id: 'bluesky', label: 'Bluesky', short: 'BS' },
  { id: 'x', label: 'X', short: 'X' },
  { id: 'linkedin', label: 'LinkedIn', short: 'LI' },
  { id: 'instagram', label: 'Instagram', short: 'IG' },
  { id: 'threads', label: 'Threads', short: 'TH' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDateLabel(weekStart: string, dayOfWeek: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + dayOfWeek);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[d.getMonth()]} ${d.getDate()}`;
}

export function WeeklyCalendar() {
  const [weekStartDate, setWeekStartDate] = useState(getCurrentWeekStart);
  const [platform, setPlatform] = useState<Platform>('bluesky');
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<{
    hasStyleData: boolean;
    hasAiInsights: boolean;
    hasTopPerformers: boolean;
    summary: string;
  } | null>(null);

  // Fetch calendar items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/content-assistant/calendar?week=${weekStartDate}&platform=${platform}`
      );
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch calendar items:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStartDate, platform]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Generate week handler (called from modal after cost confirmation)
  const handleGenerate = async () => {
    // Step 1: Strategy
    const strategyRes = await fetch('/api/admin/content-assistant/generate-week/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, weekStartDate }),
    });
    const strategyData = await strategyRes.json();

    if (!strategyRes.ok) {
      throw new Error(strategyData.error || 'Strategy generation failed');
    }

    // Step 2: Content
    const contentRes = await fetch('/api/admin/content-assistant/generate-week/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        weekStartDate,
        strategy: strategyData.strategy,
      }),
    });
    const contentData = await contentRes.json();

    if (!contentRes.ok) {
      throw new Error(contentData.error || 'Content generation failed');
    }

    // Refresh calendar
    await fetchItems();
  };

  // Edit handler
  const handleEdit = async (id: string, data: Record<string, string | undefined>) => {
    const res = await fetch(`/api/admin/content-assistant/calendar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      await fetchItems();
    }
  };

  // Regenerate handler
  const handleRegenerate = async (id: string) => {
    const res = await fetch('/api/admin/content-assistant/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id }),
    });

    if (res.ok) {
      await fetchItems();
    }
  };

  // Push to Signal Deck handler
  const handlePush = async (id: string) => {
    const res = await fetch('/api/admin/content-assistant/push-to-deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id }),
    });

    if (res.ok) {
      await fetchItems();
    }
  };

  // Discard handler
  const handleDiscard = async (id: string) => {
    const res = await fetch(`/api/admin/content-assistant/calendar/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      await fetchItems();
    }
  };

  // Push all approved
  const approvedItems = items.filter(i => i.status === 'approved');

  const handlePushAllApproved = async () => {
    for (const item of approvedItems) {
      await handlePush(item.id);
    }
  };

  // Group items by day
  const itemsByDay: Record<number, CalendarItem[]> = {};
  for (let d = 0; d < 7; d++) {
    itemsByDay[d] = items.filter(i => i.dayOfWeek === d);
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <WeekPicker weekStartDate={weekStartDate} onChange={setWeekStartDate} />

        <div className="flex items-center gap-3">
          {/* Platform tabs */}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  platform === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
                title={p.label}
              >
                {p.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
        >
          <Sparkles className="w-4 h-4" />
          Generate This Week
        </button>

        {approvedItems.length > 0 && (
          <button
            onClick={handlePushAllApproved}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            Push All Approved ({approvedItems.length})
          </button>
        )}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-6 bg-gray-700 rounded animate-pulse" />
              <div className="h-48 bg-gray-800 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {Array.from({ length: 7 }).map((_, dayOfWeek) => (
            <CalendarDayColumn
              key={dayOfWeek}
              dayOfWeek={dayOfWeek}
              dayLabel={DAY_NAMES[dayOfWeek]}
              dateLabel={getDateLabel(weekStartDate, dayOfWeek)}
              items={itemsByDay[dayOfWeek] || []}
              onEdit={handleEdit}
              onRegenerate={handleRegenerate}
              onPush={handlePush}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
          <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-300 font-medium mb-1">No content for this week</h3>
          <p className="text-gray-500 text-sm mb-4">Generate a week of content to get started.</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate This Week
          </button>
        </div>
      )}

      {/* Generate modal */}
      <GenerateWeekModal
        isOpen={showGenerateModal}
        onClose={() => { setShowGenerateModal(false); fetchItems(); }}
        onGenerate={handleGenerate}
        platform={platform}
        weekStartDate={weekStartDate}
        voiceStatus={voiceStatus}
      />
    </div>
  );
}
