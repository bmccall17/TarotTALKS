'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ApiLogsDropdown } from './ApiLogsDropdown';

export type TodayUsage = {
  total: number;
  successful: number;
  failed: number;
  circuitBreakerBlocked: number;
  actualApiCalls: number;
  dailyQuota: number;
  estimatedRemaining: number;
  quotaPercentUsed: number;
};

export type HourlyUsage = {
  hour: string;
  total: number;
  successful: number;
  failed: number;
};

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
  // Today's quota tracking (Gemini only)
  todayUsage?: TodayUsage;
  // Hourly usage for graph (Gemini only)
  hourlyUsage?: HourlyUsage[];
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const apiDisplayName = data.apiName === 'gemini' ? 'Gemini' : 'YouTube';

  // Handle force reset
  const handleForceReset = async () => {
    setIsResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch('/api/admin/api-usage/reset-circuit-breaker', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        setResetMessage('Circuit breaker reset. Refresh page to see updated status.');
        setShowResetConfirm(false);
      } else {
        setResetMessage(result.error || 'Failed to reset');
      }
    } catch {
      setResetMessage('Network error');
    } finally {
      setIsResetting(false);
    }
  };

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

        {/* Daily Quota Counter (Gemini only) */}
        {data.apiName === 'gemini' && data.todayUsage && (
          <div className="border-t border-gray-700 pt-2 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Today&apos;s Quota</span>
              <span className={`font-mono text-sm ${
                data.todayUsage.quotaPercentUsed >= 90 ? 'text-red-400' :
                data.todayUsage.quotaPercentUsed >= 70 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {data.todayUsage.actualApiCalls} / {data.todayUsage.dailyQuota}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full transition-all ${
                  data.todayUsage.quotaPercentUsed >= 90 ? 'bg-red-500' :
                  data.todayUsage.quotaPercentUsed >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, data.todayUsage.quotaPercentUsed)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{data.todayUsage.quotaPercentUsed}% used</span>
              <span>{data.todayUsage.estimatedRemaining} remaining</span>
            </div>
            {data.todayUsage.circuitBreakerBlocked > 0 && (
              <div className="text-[10px] text-orange-400 mt-1">
                {data.todayUsage.circuitBreakerBlocked} calls blocked by circuit breaker (not counted)
              </div>
            )}
          </div>
        )}

        {/* 24-Hour Usage Graph (Gemini only) */}
        {data.apiName === 'gemini' && data.hourlyUsage && data.hourlyUsage.length > 0 && (
          <div className="border-t border-gray-700 pt-2 mt-2">
            <div className="text-gray-400 text-xs mb-2">24-Hour Usage</div>
            <div className="flex items-end gap-[2px] h-12">
              {data.hourlyUsage.map((hour, i) => {
                const maxTotal = Math.max(...data.hourlyUsage!.map(h => h.total), 1);
                const height = hour.total > 0 ? Math.max(4, (hour.total / maxTotal) * 100) : 0;
                const successHeight = hour.successful > 0 ? (hour.successful / hour.total) * height : 0;
                const failedHeight = height - successHeight;
                const hourDate = new Date(hour.hour);
                const isNow = i === data.hourlyUsage!.length - 1;

                return (
                  <div
                    key={hour.hour}
                    className="flex-1 flex flex-col justify-end group relative"
                    title={`${hourDate.toLocaleTimeString('en-US', { hour: 'numeric' })}: ${hour.total} calls (${hour.successful} ok, ${hour.failed} failed)`}
                  >
                    {hour.total > 0 ? (
                      <>
                        <div
                          className="bg-red-500/70 rounded-t-sm"
                          style={{ height: `${failedHeight}%` }}
                        />
                        <div
                          className={`rounded-b-sm ${isNow ? 'bg-green-400' : 'bg-green-500/70'}`}
                          style={{ height: `${successHeight}%` }}
                        />
                      </>
                    ) : (
                      <div className="bg-gray-700/50 rounded-sm" style={{ height: '4px' }} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 mt-1">
              <span>24h ago</span>
              <span>Now</span>
            </div>
          </div>
        )}

        {/* Force Reset Button (Gemini only, when circuit breaker is open) */}
        {data.apiName === 'gemini' && data.circuitBreakerOpen && (
          <div className="border-t border-gray-700 pt-2 mt-2">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded text-xs hover:bg-yellow-500/20 transition-colors"
              >
                Force Reset Circuit Breaker
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] text-yellow-400 bg-yellow-500/10 p-2 rounded">
                  <strong>Warning:</strong> Resetting allows API calls to proceed, but Google&apos;s quota may still be exhausted. This could result in immediate 429 errors.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                    disabled={isResetting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleForceReset}
                    className="flex-1 px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded text-xs hover:bg-red-500/30"
                    disabled={isResetting}
                  >
                    {isResetting ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}
            {resetMessage && (
              <div className={`text-[10px] mt-2 ${resetMessage.includes('error') || resetMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                {resetMessage}
              </div>
            )}
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
