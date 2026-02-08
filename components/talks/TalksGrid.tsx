'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getThumbnailUrl } from '@/lib/utils/thumbnails';
import { Search, Play, Clock, Calendar } from 'lucide-react';

interface Card {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  suit: string | null;
  number: number | null;
}

interface Talk {
  id: string;
  slug: string;
  title: string;
  speakerName: string;
  tedUrl: string | null;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  durationSeconds: number | null;
  year: number | null;
  thumbnailUrl: string | null;
  primaryCard: Card | null;
}

interface TalksGridProps {
  talks: Talk[];
}

const durations = [
  { id: 'all', label: 'All Lengths' },
  { id: 'short', label: '< 10 min' },
  { id: 'medium', label: '10-20 min' },
  { id: 'long', label: '> 20 min' },
];

export function TalksGrid({ talks }: TalksGridProps) {
  const [selectedDuration, setSelectedDuration] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTalks = talks.filter((talk) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        talk.title.toLowerCase().includes(query) ||
        talk.speakerName.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Duration filter
    if (selectedDuration !== 'all' && talk.durationSeconds) {
      const minutes = Math.floor(talk.durationSeconds / 60);
      if (selectedDuration === 'short' && minutes >= 10) return false;
      if (selectedDuration === 'medium' && (minutes < 10 || minutes > 20)) return false;
      if (selectedDuration === 'long' && minutes <= 20) return false;
    }

    return true;
  });

  return (
    <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Search talks by title or speaker..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-gray-100 placeholder-gray-500"
        />
      </div>

      {/* Duration Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {durations.map((duration) => (
          <button
            key={duration.id}
            onClick={() => setSelectedDuration(duration.id)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${
              selectedDuration === duration.id
                ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            {duration.label}
          </button>
        ))}
      </div>

      {/* Talks List */}
      <div className="space-y-3">
        {filteredTalks.map((talk) => {
          const durationMinutes = talk.durationSeconds ? Math.floor(talk.durationSeconds / 60) : null;
          const thumbnailUrl = getThumbnailUrl(talk.thumbnailUrl, talk.youtubeVideoId || null);

          return (
            <div
              key={talk.id}
              className="bg-gray-800/50 rounded-xl p-4 shadow-sm border border-gray-700 hover:shadow-md hover:border-gray-600 transition-all"
            >
              <div className="flex gap-4 items-center">
                {/* Clickable Thumbnail - Opens video */}
                <a
                  href={talk.tedUrl || talk.youtubeUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-32 h-24 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0 border border-indigo-500/30 hover:border-indigo-400/50 overflow-hidden relative group transition-all"
                >
                  {thumbnailUrl ? (
                    <>
                      <Image
                        src={thumbnailUrl}
                        alt={talk.title}
                        fill
                        sizes="128px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                        <Play className="w-8 h-8 text-white/90 drop-shadow-lg" />
                      </div>
                    </>
                  ) : (
                    <Play className="w-8 h-8 text-indigo-400" />
                  )}
                </a>

                {/* Content - Links to talk detail page */}
                <Link href={`/talks/${talk.slug}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <h3 className="font-semibold text-gray-100 mb-1 line-clamp-2">{talk.title}</h3>
                  <p className="text-sm text-gray-400 mb-2">{talk.speakerName}</p>

                  {/* Duration and Year Badges */}
                  {(talk.year || durationMinutes) && (
                    <div className="flex flex-wrap gap-2">
                      {talk.year && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs border border-indigo-500/30">
                          <Calendar className="w-3 h-3" />
                          <span>{talk.year}</span>
                        </span>
                      )}
                      {durationMinutes && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/30">
                          <Clock className="w-3 h-3" />
                          <span>{durationMinutes} min</span>
                        </span>
                      )}
                    </div>
                  )}
                </Link>

                {/* Card Thumbnail */}
                {talk.primaryCard && (
                  <Link
                    href={`/cards/${talk.primaryCard.slug}`}
                    className="flex-shrink-0 hover:opacity-80 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative w-16 h-24 rounded-lg overflow-hidden shadow-lg border border-purple-500/30">
                      <Image
                        src={talk.primaryCard.imageUrl}
                        alt={talk.primaryCard.name}
                        fill
                        sizes="64px"
                        loading="lazy"
                        className="object-cover"
                      />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Count */}
      <p className="text-center text-sm text-gray-500">
        Showing {filteredTalks.length} of {talks.length} talks
      </p>
    </>
  );
}
