'use client';

import { useState } from 'react';

export type ApiHealthData = {
  apiName: 'gemini' | 'youtube';
  isHealthy: boolean;
  totalCalls: number;
  successfulCalls: number;
  rateLimitHits: number;
  quotaExceededHits: number;
  lastErrorAt: string | null;
  lastErrorType: string | null;
  estimatedResetTime: string | null;
};

interface ApiStatusIndicatorProps {
  data: ApiHealthData;
  compact?: boolean;
}

export function ApiStatusIndicator({ data, compact = false }: ApiStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const apiDisplayName = data.apiName === 'gemini' ? 'Gemini' : 'YouTube';

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return formatTime(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + formatTime(isoString);
  };

  const errorTypeLabel = (type: string | null) => {
    if (!type) return '-';
    switch (type) {
      case 'rate_limit': return 'Rate Limit';
      case 'quota_exceeded': return 'Quota Exceeded';
      case 'network': return 'Network Error';
      case 'api_error': return 'API Error';
      default: return type;
    }
  };

  if (compact) {
    return (
      <div
        className="relative inline-flex items-center gap-2"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              data.isHealthy
                ? 'bg-green-500 animate-pulse'
                : 'bg-red-500 animate-pulse'
            }`}
          />
          <span className="text-xs text-gray-400">{apiDisplayName}</span>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={data.isHealthy ? 'text-green-400' : 'text-red-400'}>
                  {data.isHealthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Calls</span>
                <span className="text-gray-200">{data.totalCalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Successful</span>
                <span className="text-gray-200">{data.successfulCalls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rate Limit Hits</span>
                <span className={data.rateLimitHits > 0 ? 'text-yellow-400' : 'text-gray-200'}>
                  {data.rateLimitHits}
                </span>
              </div>
              {data.apiName === 'youtube' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Quota Exceeded</span>
                  <span className={data.quotaExceededHits > 0 ? 'text-red-400' : 'text-gray-200'}>
                    {data.quotaExceededHits}
                  </span>
                </div>
              )}
              {data.lastErrorAt && (
                <>
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Error</span>
                      <span className="text-red-400">{errorTypeLabel(data.lastErrorType)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">At</span>
                      <span className="text-gray-300">{formatDate(data.lastErrorAt)}</span>
                    </div>
                    {data.estimatedResetTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Est. Reset</span>
                        <span className="text-gray-300">{formatDate(data.estimatedResetTime)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 border-b border-r border-gray-700 transform rotate-45" />
          </div>
        )}
      </div>
    );
  }

  // Full card view
  return (
    <div className={`p-4 rounded-lg border ${
      data.isHealthy
        ? 'bg-green-500/5 border-green-500/20'
        : 'bg-red-500/5 border-red-500/20'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              data.isHealthy
                ? 'bg-green-500 animate-pulse'
                : 'bg-red-500 animate-pulse'
            }`}
          />
          <span className="font-medium text-gray-200">{apiDisplayName}</span>
        </div>
        <span className={`text-sm ${data.isHealthy ? 'text-green-400' : 'text-red-400'}`}>
          {data.isHealthy ? 'Healthy' : 'Unhealthy'}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Calls</span>
          <span className="text-gray-200">{data.totalCalls}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Successful</span>
          <span className="text-gray-200">{data.successfulCalls}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Rate Limit Hits</span>
          <span className={data.rateLimitHits > 0 ? 'text-yellow-400' : 'text-gray-200'}>
            {data.rateLimitHits}
          </span>
        </div>
        {data.apiName === 'youtube' && (
          <div className="flex justify-between">
            <span className="text-gray-400">Quota Exceeded</span>
            <span className={data.quotaExceededHits > 0 ? 'text-red-400' : 'text-gray-200'}>
              {data.quotaExceededHits}
            </span>
          </div>
        )}
        {data.lastErrorAt && (
          <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Last Error</span>
              <span className="text-red-400">{errorTypeLabel(data.lastErrorType)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">At</span>
              <span className="text-gray-300">{formatDate(data.lastErrorAt)}</span>
            </div>
            {data.estimatedResetTime && (
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Reset</span>
                <span className="text-gray-300">{formatDate(data.estimatedResetTime)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ApiStatusPairProps {
  gemini: ApiHealthData;
  youtube: ApiHealthData;
  compact?: boolean;
}

export function ApiStatusPair({ gemini, youtube, compact = false }: ApiStatusPairProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <ApiStatusIndicator data={gemini} compact />
        <ApiStatusIndicator data={youtube} compact />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ApiStatusIndicator data={gemini} />
      <ApiStatusIndicator data={youtube} />
    </div>
  );
}
