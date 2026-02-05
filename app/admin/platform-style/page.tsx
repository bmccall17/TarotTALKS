'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Hash, Smile, AtSign, ExternalLink, Clock, AlertCircle, Sparkles, Lightbulb, MessageSquare } from 'lucide-react';
import type { PlatformStylePattern } from '@/lib/services/platform-style-analyzer';
import type { AIStyleInsights } from '@/lib/services/platform-style-ai';
import { CostWarningModal, type CostEstimate, type BudgetImpact } from '@/components/admin/ui/CostWarningModal';

type Platform = 'bluesky' | 'x' | 'linkedin' | 'instagram' | 'threads' | 'other';

type ExamplePost = {
  id: string;
  notes: string | null;
  postUrl: string | null;
  likeCount: number | null;
  repostCount: number | null;
  replyCount: number | null;
};

type PlatformData = {
  pattern: PlatformStylePattern | null;
  lastAnalyzedAt: string | null;
  examplePosts: ExamplePost[];
};

const PLATFORMS: { id: Platform; label: string; icon: string }[] = [
  { id: 'bluesky', label: 'Bluesky', icon: '🦋' },
  { id: 'x', label: 'X', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
  { id: 'other', label: 'Other', icon: '📝' },
];

function StatBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-12">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-10 text-right">{value}</span>
    </div>
  );
}

function PatternCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-gray-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function PlatformStylePage() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('bluesky');
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Insights state
  const [aiInsights, setAiInsights] = useState<AIStyleInsights | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsFromCache, setAiInsightsFromCache] = useState(false);

  // Cost warning modal state
  const [showCostModal, setShowCostModal] = useState(false);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [budgetImpact, setBudgetImpact] = useState<BudgetImpact | null>(null);
  const [costWarning, setCostWarning] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/platform-style?platform=${selectedPlatform}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/platform-style/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selectedPlatform }),
      });
      if (!res.ok) throw new Error('Failed to analyze');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch cached AI insights when platform changes
  const fetchAiInsights = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/platform-style/ai-insights?platform=${selectedPlatform}`);
      if (res.ok) {
        const json = await res.json();
        if (json.insights) {
          setAiInsights(json.insights);
          setAiInsightsFromCache(json.hasCache);
        } else {
          setAiInsights(null);
          setAiInsightsFromCache(false);
        }
      }
    } catch {
      // Silently fail for cached insights
    }
  }, [selectedPlatform]);

  useEffect(() => {
    fetchAiInsights();
  }, [fetchAiInsights]);

  // Prepare to generate AI insights (show cost modal first)
  const prepareGenerateAiInsights = async () => {
    try {
      const res = await fetch(`/api/admin/platform-style/cost-estimate?operation=ai-insights&platform=${selectedPlatform}`);
      if (!res.ok) throw new Error('Failed to get cost estimate');
      const json = await res.json();

      setCostEstimate(json.estimate);
      setBudgetImpact(json.budget);
      setCostWarning(json.warning);
      setShowCostModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get cost estimate');
    }
  };

  // Actually generate AI insights (after cost confirmation)
  const handleGenerateAiInsights = async () => {
    setShowCostModal(false);
    setAiInsightsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/platform-style/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selectedPlatform, forceRefresh: true }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || 'Failed to generate AI insights');
      }
      const json = await res.json();
      setAiInsights(json.insights);
      setAiInsightsFromCache(json.fromCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI insights');
    } finally {
      setAiInsightsLoading(false);
    }
  };

  const pattern = data?.pattern;
  const lastAnalyzed = data?.lastAnalyzedAt
    ? new Date(data.lastAnalyzedAt).toLocaleString()
    : null;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Platform Style</h1>
          <p className="text-gray-400">
            Learn your posting patterns per platform to improve consistency.
          </p>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPlatform === p.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="mr-2">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-400">Posts analyzed: </span>
              <span className="text-gray-200 font-medium">
                {pattern?.postsAnalyzed ?? 0}
              </span>
            </div>
            {lastAnalyzed && (
              <div className="text-sm flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-400">Last: </span>
                <span className="text-gray-300">{lastAnalyzed}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Analyze Now'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-400">Loading patterns...</p>
          </div>
        )}

        {/* No Data State */}
        {!loading && !pattern && (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <p className="text-gray-400 mb-4">
              No patterns analyzed yet for{' '}
              {PLATFORMS.find((p) => p.id === selectedPlatform)?.label}.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              Run First Analysis
            </button>
          </div>
        )}

        {/* Pattern Display */}
        {pattern && (
          <div className="space-y-6">
            {/* Length Stats */}
            <PatternCard title="Post Length" icon={TrendingUp}>
              <div className="space-y-2 mb-4">
                <StatBar
                  value={pattern.lengthStats.min}
                  max={pattern.lengthStats.max}
                  label="Min"
                />
                <StatBar
                  value={pattern.lengthStats.avg}
                  max={pattern.lengthStats.max}
                  label="Avg"
                />
                <StatBar
                  value={pattern.lengthStats.median}
                  max={pattern.lengthStats.max}
                  label="Median"
                />
                <StatBar
                  value={pattern.lengthStats.max}
                  max={pattern.lengthStats.max}
                  label="Max"
                />
              </div>
              {pattern.lengthStats.weightedAvg && (
                <p className="text-xs text-gray-400">
                  Engagement-weighted avg:{' '}
                  <span className="text-indigo-400 font-medium">
                    {pattern.lengthStats.weightedAvg} chars
                  </span>
                </p>
              )}
            </PatternCard>

            {/* Hashtags */}
            <PatternCard title="Hashtags" icon={Hash}>
              <div className="flex items-center gap-6 mb-3">
                <div>
                  <span className="text-2xl font-bold text-gray-100">
                    {pattern.hashtagPatterns.usagePct}%
                  </span>
                  <span className="text-xs text-gray-400 ml-1">usage</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-100">
                    {pattern.hashtagPatterns.avgCount}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">avg/post</span>
                </div>
              </div>
              {pattern.hashtagPatterns.commonTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pattern.hashtagPatterns.commonTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {pattern.hashtagPatterns.commonTags.length === 0 && (
                <p className="text-xs text-gray-500">No hashtags detected</p>
              )}
            </PatternCard>

            {/* Emojis */}
            <PatternCard title="Emojis" icon={Smile}>
              <div className="flex items-center gap-6 mb-3">
                <div>
                  <span className="text-2xl font-bold text-gray-100">
                    {pattern.emojiPatterns.usagePct}%
                  </span>
                  <span className="text-xs text-gray-400 ml-1">usage</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-100">
                    {pattern.emojiPatterns.avgCount}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">avg/post</span>
                </div>
              </div>
              {pattern.emojiPatterns.commonEmojis.length > 0 && (
                <div className="flex gap-2 mb-3">
                  {pattern.emojiPatterns.commonEmojis.map((emoji, i) => (
                    <span key={i} className="text-xl">
                      {emoji}
                    </span>
                  ))}
                </div>
              )}
              {(pattern.emojiPatterns.positions.start > 0 ||
                pattern.emojiPatterns.positions.end > 0) && (
                <div className="text-xs text-gray-400">
                  Position:{' '}
                  {pattern.emojiPatterns.positions.start > 0.4 && (
                    <span className="text-indigo-400">Start ({Math.round(pattern.emojiPatterns.positions.start * 100)}%)</span>
                  )}
                  {pattern.emojiPatterns.positions.middle > 0.4 && (
                    <span className="text-indigo-400">Middle ({Math.round(pattern.emojiPatterns.positions.middle * 100)}%)</span>
                  )}
                  {pattern.emojiPatterns.positions.end > 0.4 && (
                    <span className="text-indigo-400">End ({Math.round(pattern.emojiPatterns.positions.end * 100)}%)</span>
                  )}
                  {pattern.emojiPatterns.positions.start <= 0.4 &&
                    pattern.emojiPatterns.positions.middle <= 0.4 &&
                    pattern.emojiPatterns.positions.end <= 0.4 && (
                      <span>Mixed positions</span>
                    )}
                </div>
              )}
            </PatternCard>

            {/* Mentions */}
            <PatternCard title="Mentions" icon={AtSign}>
              <div className="flex items-center gap-6 mb-3">
                <div>
                  <span className="text-2xl font-bold text-gray-100">
                    {pattern.mentionPatterns.usagePct}%
                  </span>
                  <span className="text-xs text-gray-400 ml-1">usage</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-100">
                    {pattern.mentionPatterns.avgCount}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">avg/post</span>
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-400">Speaker</span>
                  <span className="text-gray-200 font-medium">
                    {Math.round(pattern.mentionPatterns.types.speaker * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-400">Org</span>
                  <span className="text-gray-200 font-medium">
                    {Math.round(pattern.mentionPatterns.types.org * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-400">Other</span>
                  <span className="text-gray-200 font-medium">
                    {Math.round(pattern.mentionPatterns.types.other * 100)}%
                  </span>
                </div>
              </div>
            </PatternCard>

            {/* Top Performer Insights */}
            {pattern.topPerformerTraits && (
              <PatternCard title="Top Performer Insights" icon={TrendingUp}>
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">
                    Based on your top {pattern.topPerformerCount} posts
                    {pattern.engagementThreshold && (
                      <span className="text-gray-500">
                        {' '}(engagement score {'>='} {pattern.engagementThreshold})
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Avg length: </span>
                      <span className="text-gray-200">
                        {pattern.topPerformerTraits.avgLength} chars
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Hashtags: </span>
                      <span className="text-gray-200">
                        {pattern.topPerformerTraits.hashtagUsagePct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Emojis: </span>
                      <span className="text-gray-200">
                        {pattern.topPerformerTraits.emojiUsagePct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Mentions: </span>
                      <span className="text-gray-200">
                        {pattern.topPerformerTraits.mentionUsagePct}%
                      </span>
                    </div>
                  </div>
                  {pattern.topPerformerTraits.commonPatterns.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {pattern.topPerformerTraits.commonPatterns.map((p, i) => (
                        <p key={i} className="text-xs text-indigo-400">
                          • {p}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </PatternCard>
            )}

            {/* AI-Enhanced Insights */}
            <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-medium text-gray-200">AI-Enhanced Insights</h3>
                  {aiInsightsFromCache && (
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">cached</span>
                  )}
                </div>
                <button
                  onClick={prepareGenerateAiInsights}
                  disabled={aiInsightsLoading || !pattern}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {aiInsightsLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : aiInsights ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate
                    </>
                  )}
                </button>
              </div>

              {!aiInsights && !aiInsightsLoading && (
                <p className="text-sm text-gray-400">
                  Use AI to analyze your posting voice, tone, and structure patterns.
                  Requires at least 3 posts with notes.
                </p>
              )}

              {aiInsights && (
                <div className="space-y-4">
                  {/* Voice Fingerprint */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-gray-300">Your Voice</span>
                    </div>
                    <p className="text-sm text-gray-400">{aiInsights.voiceFingerprint}</p>
                  </div>

                  {/* Tone Analysis */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500">Primary Tone</span>
                      <p className="text-sm text-gray-200 capitalize">{aiInsights.tone.primaryTone}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Formality</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className={`w-3 h-3 rounded-full ${
                              n <= aiInsights.tone.formalityScore
                                ? 'bg-purple-500'
                                : 'bg-gray-700'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-gray-500 ml-1">
                          {aiInsights.tone.formalityScore <= 2 ? 'Casual' : aiInsights.tone.formalityScore >= 4 ? 'Formal' : 'Balanced'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Sentiment</span>
                      <p className="text-sm text-gray-200 capitalize">{aiInsights.sentiment.overallSentiment}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Confidence</span>
                      <p className="text-sm text-gray-200">{aiInsights.tone.confidence}%</p>
                    </div>
                  </div>

                  {/* Writing Tips */}
                  {aiInsights.writingTips.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-gray-300">Writing Tips</span>
                      </div>
                      <ul className="space-y-1">
                        {aiInsights.writingTips.map((tip, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                            <span className="text-purple-400">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Structure Patterns */}
                  {aiInsights.structure.typicalStructure && (
                    <div className="text-xs text-gray-500 border-t border-gray-700 pt-3 mt-3">
                      <strong>Typical structure:</strong> {aiInsights.structure.typicalStructure}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Example Posts */}
            {data?.examplePosts && data.examplePosts.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-200 mb-3">
                  Example Posts
                </h3>
                <div className="space-y-3">
                  {data.examplePosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-gray-900 rounded-lg p-3 text-sm"
                    >
                      <p className="text-gray-300 mb-2 whitespace-pre-wrap">
                        {post.notes?.slice(0, 280)}
                        {post.notes && post.notes.length > 280 && '...'}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>{post.likeCount ?? 0} likes</span>
                          <span>{post.repostCount ?? 0} reposts</span>
                          <span>{post.replyCount ?? 0} replies</span>
                        </div>
                        {post.postUrl && (
                          <a
                            href={post.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cost Warning Modal */}
      {costEstimate && budgetImpact && (
        <CostWarningModal
          isOpen={showCostModal}
          onConfirm={handleGenerateAiInsights}
          onCancel={() => setShowCostModal(false)}
          loading={aiInsightsLoading}
          operationName="Generate AI Insights"
          operationDescription="Analyze your posts with Gemini AI"
          estimate={costEstimate}
          budget={budgetImpact}
          warning={costWarning}
        />
      )}
    </div>
  );
}
