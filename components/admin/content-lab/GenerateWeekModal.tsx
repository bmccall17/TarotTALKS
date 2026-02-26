'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Info } from 'lucide-react';
import { CostWarningModal, type CostEstimate, type BudgetImpact } from '@/components/admin/ui/CostWarningModal';

type Platform = 'bluesky' | 'x' | 'linkedin' | 'instagram' | 'threads' | 'other';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (platform: Platform) => Promise<void>;
  platform: Platform;
  weekStartDate: string;
  voiceStatus: {
    hasStyleData: boolean;
    hasAiInsights: boolean;
    hasTopPerformers: boolean;
    summary: string;
  } | null;
};

type GenerationStep = 'idle' | 'estimating' | 'confirming' | 'strategy' | 'content' | 'done' | 'error';

export function GenerateWeekModal({ isOpen, onClose, onGenerate, platform, weekStartDate, voiceStatus }: Props) {
  const [step, setStep] = useState<GenerationStep>('idle');
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [budgetImpact, setBudgetImpact] = useState<BudgetImpact | null>(null);
  const [costWarning, setCostWarning] = useState<string | undefined>();
  const [showCostModal, setShowCostModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setError(null);
      setGenerating(false);
    }
  }, [isOpen]);

  const handleStartGenerate = async () => {
    setStep('estimating');
    setError(null);

    try {
      const res = await fetch(`/api/admin/content-assistant/cost-estimate?operation=full-week`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to estimate cost');
      }

      setCostEstimate(data.estimate);
      setBudgetImpact(data.budget);
      setCostWarning(data.warning);
      setShowCostModal(true);
      setStep('confirming');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  };

  const handleConfirmGenerate = async () => {
    setShowCostModal(false);
    setGenerating(true);

    try {
      await onGenerate(platform);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStep('error');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-100">Generate This Week</h2>
                <p className="text-sm text-gray-400">
                  {platform.charAt(0).toUpperCase() + platform.slice(1)} &middot; Week of {weekStartDate}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Voice status */}
            {voiceStatus && (
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                voiceStatus.hasAiInsights
                  ? 'bg-green-900/20 border-green-700/30'
                  : voiceStatus.hasStyleData
                    ? 'bg-amber-900/20 border-amber-700/30'
                    : 'bg-gray-700/30 border-gray-600/30'
              }`}>
                <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  voiceStatus.hasAiInsights ? 'text-green-400' : voiceStatus.hasStyleData ? 'text-amber-400' : 'text-gray-400'
                }`} />
                <p className="text-sm text-gray-300">{voiceStatus.summary}</p>
              </div>
            )}

            {/* What will be generated */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-200 mb-2">This will generate:</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>7 posts for Mon–Sun</li>
                <li>Mix: Authority, Story, Engagement, Offer</li>
                <li>Each post: hook + body + CTA + hashtags</li>
                <li>Card/talk references where relevant</li>
              </ul>
            </div>

            {/* Progress / Status */}
            {generating && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                  <div>
                    <p className="text-sm text-gray-200">Generating content...</p>
                    <p className="text-xs text-gray-500">Step 1: Planning strategy... then writing posts</p>
                  </div>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                <p className="text-sm text-green-300">Content generated successfully! Check the calendar below.</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
            {step === 'done' ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View Calendar
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={generating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartGenerate}
                  disabled={generating || step === 'estimating'}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {step === 'estimating' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Estimating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cost warning modal */}
      {showCostModal && costEstimate && budgetImpact && (
        <CostWarningModal
          isOpen={showCostModal}
          onConfirm={handleConfirmGenerate}
          onCancel={() => { setShowCostModal(false); setStep('idle'); }}
          operationName="Generate Week"
          operationDescription="Plan strategy + write 7 posts"
          estimate={costEstimate}
          budget={budgetImpact}
          warning={costWarning}
          loading={generating}
        />
      )}
    </>
  );
}
