'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  weekStartDate: string; // YYYY-MM-DD (Monday)
  onChange: (newWeekStart: string) => void;
};

function formatDateRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monthNames[start.getMonth()];
  const endMonth = monthNames[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function shiftWeek(weekStart: string, direction: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + direction * 7);
  return d.toISOString().split('T')[0];
}

export function WeekPicker({ weekStartDate, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(shiftWeek(weekStartDate, -1))}
        className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
        title="Previous week"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <span className="text-sm font-medium text-gray-200 min-w-[200px] text-center">
        {formatDateRange(weekStartDate)}
      </span>

      <button
        onClick={() => onChange(shiftWeek(weekStartDate, 1))}
        className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
        title="Next week"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Get the Monday of the current week
 */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // Adjust so Monday is start
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}
