'use client';

import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import type { Platform } from '@/lib/utils/social-handles';

type Share = {
  id: string;
  platform: Platform;
  postUrl: string | null;
  status: string;
  postedAt: string;
  sharedUrl: string | null;
  speakerHandle: string | null;
  speakerName: string | null;
  notes: string | null;
  card?: { id: string; name: string; slug: string; imageUrl: string } | null;
  talk?: { id: string; title: string; slug: string; speakerName: string; thumbnailUrl: string | null } | null;
};

type Props = {
  shares: Share[];
  onClose: () => void;
};

export function ExportToCampaign({ shares, onClose }: Props) {
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    const items = shares.map((share) => ({
      platform: share.platform,
      slug: share.card?.slug || share.talk?.slug || '',
      category: share.card ? 'cards' : 'talks',
      image_url: '',
      post_id: share.id,
      caption: share.notes || '',
      alt_text: share.card
        ? `${share.card.name} tarot card`
        : share.talk
        ? `${share.talk.title} by ${share.talk.speakerName}`
        : '',
      tags: [],
      speaker_handle: share.speakerHandle || undefined,
      talk_url: share.sharedUrl || undefined,
      card_name: share.card?.name,
      talk_title: share.talk?.title,
      speaker_name: share.talk?.speakerName || share.speakerName || undefined,
      scheduled_date: new Date(share.postedAt).toISOString().slice(0, 10),
    }));

    const json = JSON.stringify({ items }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    // Auto-close modal after brief confirmation
    setTimeout(() => onClose(), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-100 mb-2">Export to Campaign</h3>
        <p className="text-sm text-gray-400 mb-4">
          Export {shares.length} selected share{shares.length !== 1 ? 's' : ''} as a JSON file
          for use with <code className="text-indigo-400">campaign:ingest --source json</code>
        </p>

        {/* Preview */}
        <div className="bg-gray-900 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
          {shares.map((share) => (
            <div key={share.id} className="flex items-center gap-2 text-xs text-gray-300 py-1">
              <span className="text-gray-500">{share.platform}</span>
              <span className="truncate">
                {share.card?.name || share.talk?.title || 'Unknown'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
          >
            {exported ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {exported ? 'Downloaded!' : 'Download JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}
