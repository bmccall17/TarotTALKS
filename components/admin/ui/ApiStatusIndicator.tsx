'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ApiLogsDropdown } from './ApiLogsDropdown';

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
  // Circuit breaker status (Gemini only)
  circuitBreakerOpen?: boolean;
  cooldownUntil?: string | null;
};

// Help tooltip content for Gemini metrics
const geminiHelpContent = {
  title: 'Gemini Circuit Breaker',
  description: 'A protective mechanism to prevent wasting API calls when the daily quota is exhausted.',
  metrics: [
    { name: 'Total Calls', desc: 'All API requests made in the time period' },
    { name: 'Successful', desc: 'Calls that returned a valid response' },
    { name: 'Rate Limit Hits', desc: 'Blocked by internal limiter (10 req/min)' },
  ],
  states: [
    { name: 'CLOSED (Healthy)', desc: 'Normal operation - API calls proceed' },
    { name: 'OPEN (Tripped)', desc: 'Quota exhausted - calls blocked until reset' },
  ],
  resetNote: 'Quota resets at midnight Pacific Time (8:00 AM UTC)',
};

interface ApiStatusIndicatorProps {
  data: ApiHealthData;
  compact?: boolean;
}

export function ApiStatusIndicator({ data, compact = false }: ApiStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);

  const apiDisplayName = data.apiName === 'gemini' ? 'Gemini' : 'YouTube';

  // Calculate countdown to circuit breaker reset
  const getCountdown = (cooldownUntil: string | null) => {
    if (!cooldownUntil) return null;
    const resetTime = new Date(cooldownUntil);
    const now = new Date();
    const diffMs = resetTime.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

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
      data.isHealthy && !data.circuitBreakerOpen
        ? 'bg-green-500/5 border-green-500/20'
        : 'bg-red-500/5 border-red-500/20'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              data.isHealthy && !data.circuitBreakerOpen
                ? 'bg-green-500 animate-pulse'
                : 'bg-red-500 animate-pulse'
            }`}
          />
          <span className="font-medium text-gray-200">{apiDisplayName}</span>
          {/* Help icon for Gemini */}
          {data.apiName === 'gemini' && (
            <div
              className="relative"
              onMouseEnter={() => setShowHelpTooltip(true)}
              onMouseLeave={() => setShowHelpTooltip(false)}
            >
              <HelpCircle className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
              {showHelpTooltip && (
                <div className="absolute z-50 left-0 top-full mt-2 w-72 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-xs">
                  <div className="font-medium text-gray-200 mb-2">{geminiHelpContent.title}</div>
                  <p className="text-gray-400 mb-3">{geminiHelpContent.description}</p>

                  <div className="mb-2">
                    <div className="text-gray-300 font-medium mb-1">Metrics:</div>
                    {geminiHelpContent.metrics.map((m, i) => (
                      <div key={i} className="flex gap-2 text-gray-400 mb-0.5">
                        <span className="text-gray-300">{m.name}:</span>
                        <span>{m.desc}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2">
                    <div className="text-gray-300 font-medium mb-1">States:</div>
                    {geminiHelpContent.states.map((s, i) => (
                      <div key={i} className="text-gray-400 mb-0.5">
                        <span className="text-gray-300">{s.name}:</span> {s.desc}
                      </div>
                    ))}
                  </div>

                  <div className="text-yellow-400/80 text-[10px] mt-2 pt-2 border-t border-gray-700">
                    {geminiHelpContent.resetNote}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Circuit breaker badge */}
          {data.apiName === 'gemini' && data.circuitBreakerOpen && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-medium">
              CIRCUIT OPEN {data.cooldownUntil && getCountdown(data.cooldownUntil) && (
                <span className="text-red-300">({getCountdown(data.cooldownUntil)})</span>
              )}
            </span>
          )}
          <span className={`text-sm ${data.isHealthy && !data.circuitBreakerOpen ? 'text-green-400' : 'text-red-400'}`}>
            {data.circuitBreakerOpen ? 'Blocked' : data.isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>
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

        {/* Collapsible Logs Dropdown */}
        <ApiLogsDropdown apiName={data.apiName} />
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
