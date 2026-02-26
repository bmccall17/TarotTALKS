'use client';

import { ContentCard } from './ContentCard';

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

type Props = {
  dayOfWeek: number;
  dayLabel: string;
  dateLabel: string;
  items: CalendarItem[];
  onEdit: (id: string, data: { hook?: string; body?: string; cta?: string; status?: string }) => Promise<void>;
  onRegenerate: (id: string) => Promise<void>;
  onPush: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
};

export function CalendarDayColumn({ dayLabel, dateLabel, items, onEdit, onRegenerate, onPush, onDiscard }: Props) {
  return (
    <div className="min-w-[180px] flex-1">
      {/* Day header */}
      <div className="text-center mb-2">
        <div className="text-sm font-medium text-gray-200">{dayLabel}</div>
        <div className="text-[10px] text-gray-500">{dateLabel}</div>
      </div>

      {/* Content cards */}
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
              onPush={onPush}
              onDiscard={onDiscard}
            />
          ))
        ) : (
          <div className="bg-gray-800/30 border border-dashed border-gray-700 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500">No content</p>
          </div>
        )}
      </div>
    </div>
  );
}
