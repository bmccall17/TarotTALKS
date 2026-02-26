'use client';

import { useState } from 'react';
import { RefreshCw, Send, Edit3, Check, X, Trash2 } from 'lucide-react';
import { ContentTypeTag } from './ContentTypeTag';

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
  item: CalendarItem;
  onEdit: (id: string, data: { hook?: string; body?: string; cta?: string; status?: string }) => Promise<void>;
  onRegenerate: (id: string) => Promise<void>;
  onPush: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
};

const STATUS_COLORS: Record<string, string> = {
  generated: 'text-gray-400',
  edited: 'text-blue-400',
  approved: 'text-green-400',
  pushed: 'text-indigo-400',
  discarded: 'text-red-400',
};

const FRAMEWORK_SHORT: Record<string, string> = {
  '3_things': '3 Things',
  hook_story_offer: 'HSO',
  pas: 'PAS',
  open_loop: 'Open Loop',
  before_after: 'B/A',
  aida: 'AIDA',
};

export function ContentCard({ item, onEdit, onRegenerate, onPush, onDiscard }: Props) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(item.body || '');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pushing, setPushing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onEdit(item.id, { body: editBody });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate(item.id);
    } finally {
      setRegenerating(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      await onPush(item.id);
    } finally {
      setPushing(false);
    }
  };

  const handleApprove = async () => {
    await onEdit(item.id, { status: 'approved' });
  };

  const hashtags = item.hashtags ? (() => { try { return JSON.parse(item.hashtags); } catch { return []; } })() : [];
  const isPushed = item.status === 'pushed';
  const isDiscarded = item.status === 'discarded';

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 overflow-hidden ${isDiscarded ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <ContentTypeTag type={item.contentType} />
        {item.frameworkUsed && (
          <span className="text-[10px] text-gray-500">
            {FRAMEWORK_SHORT[item.frameworkUsed] || item.frameworkUsed}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-indigo-500"
              rows={6}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{editBody.length} chars</span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(false); setEditBody(item.body || ''); }}
                  className="p-1 text-gray-400 hover:text-gray-200"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSave}
                  className="p-1 text-green-400 hover:text-green-300"
                  disabled={saving}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Hook preview */}
            {item.hook && (
              <p className="text-sm font-medium text-gray-200 mb-1 line-clamp-2">
                {item.hook}
              </p>
            )}
            {/* Body preview (truncated) */}
            <p className="text-xs text-gray-400 line-clamp-4">
              {item.body || 'No content generated'}
            </p>
          </>
        )}

        {/* Card/Talk references */}
        {(item.card || item.talk) && !editing && (
          <div className="mt-2 space-y-1">
            {item.card && (
              <span className="inline-block text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                {item.card.name}
              </span>
            )}
            {item.talk && (
              <span className="inline-block text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded ml-1">
                {item.talk.title}
              </span>
            )}
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && !editing && (
          <div className="mt-2 flex flex-wrap gap-1">
            {hashtags.map((tag: string, i: number) => (
              <span key={i} className="text-[10px] text-blue-400">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-700/50 flex items-center justify-between">
        <span className={`text-[10px] font-medium ${STATUS_COLORS[item.status] || 'text-gray-400'}`}>
          {item.status}
        </span>

        {!isPushed && !isDiscarded && (
          <div className="flex gap-1">
            <button
              onClick={() => { setEditing(true); setEditBody(item.body || ''); }}
              className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleApprove}
              className="p-1 text-gray-400 hover:text-green-400 transition-colors"
              title="Approve"
              disabled={item.status === 'approved'}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRegenerate}
              className="p-1 text-gray-400 hover:text-amber-400 transition-colors"
              title="Regenerate"
              disabled={regenerating}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handlePush}
              className="p-1 text-gray-400 hover:text-indigo-400 transition-colors"
              title="Push to Signal Deck"
              disabled={pushing}
            >
              <Send className={`w-3.5 h-3.5 ${pushing ? 'animate-pulse' : ''}`} />
            </button>
            <button
              onClick={() => onDiscard(item.id)}
              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
              title="Discard"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
