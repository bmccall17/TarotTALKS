'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

type ApiCallLog = {
  id: string;
  success: boolean;
  errorType: string | null;
  source: string | null;
  createdAt: string;
  properties: {
    queries?: string[];
    queriesCount?: number;
    resultsCount?: number;
    results?: Array<{ id: string; title: string; channel: string }>;
    selectedTalkId?: string;
    selectedTalkTitle?: string;
    spreadId?: string;
    spreadUrl?: string;
    fallbackMode?: boolean;
    youtubeUsed?: boolean;
    cardNames?: string[];
    defaultToTed?: boolean;
    // Gemini properties
    prompt?: string;
    model?: string;
    tokensUsed?: number;
    error?: string;
  };
};

interface ApiLogsDropdownProps {
  apiName: 'gemini' | 'youtube';
  days?: number;
  limit?: number;
}

export function ApiLogsDropdown({ apiName, days = 7, limit = 10 }: ApiLogsDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch logs when expanded
  useEffect(() => {
    if (isExpanded && !hasFetched && !isLoading) {
      setIsLoading(true);
      fetch(`/api/admin/api-usage/logs?api=${apiName}&days=${days}&limit=${limit}`)
        .then(res => res.json())
        .then(data => {
          setLogs(data.logs || []);
          setHasFetched(true);
        })
        .catch(err => {
          console.error('Failed to fetch logs:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isExpanded, hasFetched, isLoading, apiName, days, limit]);

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const displayName = apiName === 'gemini' ? 'Gemini' : 'YouTube';

  return (
    <div className="mt-3 pt-3 border-t border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors w-full"
      >
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        <span>Recent {displayName} Calls</span>
        {isLoading && <span className="text-gray-500">(loading...)</span>}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
          {logs.length === 0 && !isLoading && (
            <p className="text-xs text-gray-500">No recent calls</p>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded border text-xs ${
                log.success
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-red-900/20 border-red-800/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">{formatRelativeTime(log.createdAt)}</span>
                <div className="flex items-center gap-1.5">
                  {log.properties.fallbackMode && (
                    <span className="px-1 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[9px]">
                      fallback
                    </span>
                  )}
                  <span className={log.success ? 'text-green-400' : 'text-red-400'}>
                    {log.success ? 'OK' : log.errorType?.toUpperCase() || 'ERR'}
                  </span>
                </div>
              </div>

              {/* Source */}
              {log.source && (
                <div className="text-gray-500 text-[10px]">
                  {log.source}
                </div>
              )}

              {/* Queries (YouTube) */}
              {log.properties.queries && log.properties.queries.length > 0 && (
                <div className="mt-1">
                  <div className="space-y-0.5">
                    {log.properties.queries.slice(0, 2).map((q, i) => (
                      <div key={i} className="text-gray-300 bg-gray-900/50 px-1.5 py-0.5 rounded font-mono text-[9px] truncate">
                        {q}
                      </div>
                    ))}
                    {log.properties.queries.length > 2 && (
                      <div className="text-gray-500 text-[9px]">
                        +{log.properties.queries.length - 2} more queries
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Results (YouTube) */}
              {log.properties.results && log.properties.results.length > 0 && (
                <div className="mt-1 text-[9px] text-gray-500">
                  {log.properties.results.length} result{log.properties.results.length !== 1 ? 's' : ''}
                  {log.properties.results[0] && (
                    <span className="text-indigo-400 ml-1">
                      ({log.properties.results[0].channel})
                    </span>
                  )}
                </div>
              )}

              {/* Selection (from spread_selection) */}
              {log.properties.selectedTalkTitle && (
                <div className="mt-1 text-[9px]">
                  <span className="text-gray-500">Selected:</span>
                  <span className="text-green-400 ml-1 truncate block">
                    {log.properties.selectedTalkTitle}
                  </span>
                </div>
              )}

              {/* Spread Link */}
              {log.properties.spreadUrl && (
                <div className="mt-1">
                  <a
                    href={log.properties.spreadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[9px]"
                  >
                    View Spread <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}

              {/* Card Names */}
              {log.properties.cardNames && log.properties.cardNames.length > 0 && (
                <div className="text-gray-500 text-[9px] mt-1 truncate">
                  {log.properties.cardNames.join(', ')}
                </div>
              )}

              {/* Gemini error */}
              {apiName === 'gemini' && log.properties.error && (
                <div className="mt-1 text-[9px] text-red-400 truncate">
                  {log.properties.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
