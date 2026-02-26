'use client';

import { useState } from 'react';
import { WeeklyCalendar } from '@/components/admin/content-lab/WeeklyCalendar';
import { BrandVoiceConfig } from '@/components/admin/content-lab/BrandVoiceConfig';

type Tab = 'calendar' | 'brand';

export default function ContentLabPage() {
  const [tab, setTab] = useState<Tab>('calendar');

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Content Lab</h1>
          <p className="text-sm text-gray-400 mt-1">
            Generate a week of content in your voice.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-700">
          <button
            onClick={() => setTab('calendar')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'calendar'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Weekly Calendar
          </button>
          <button
            onClick={() => setTab('brand')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'brand'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Brand Voice
          </button>
        </div>

        {/* Tab content */}
        {tab === 'calendar' && <WeeklyCalendar />}
        {tab === 'brand' && <BrandVoiceConfig />}
      </div>
    </div>
  );
}
