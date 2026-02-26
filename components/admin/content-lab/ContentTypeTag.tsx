'use client';

type ContentType = 'authority' | 'story' | 'offer' | 'engagement';

const COLORS: Record<ContentType, string> = {
  authority: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  story: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  offer: 'bg-green-500/20 text-green-300 border-green-500/30',
  engagement: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const LABELS: Record<ContentType, string> = {
  authority: 'AUTH',
  story: 'STORY',
  offer: 'OFFER',
  engagement: 'ENGAGE',
};

export function ContentTypeTag({ type }: { type: string }) {
  const ct = type as ContentType;
  const color = COLORS[ct] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  const label = LABELS[ct] || type.toUpperCase();

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${color}`}>
      {label}
    </span>
  );
}
