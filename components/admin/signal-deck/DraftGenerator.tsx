'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { StyleComplianceIndicator } from './StyleComplianceIndicator';
import { CostWarningModal, type CostEstimate, type BudgetImpact } from '@/components/admin/ui/CostWarningModal';
import type { StyleComplianceIndicator as ComplianceIndicator } from '@/lib/services/platform-style-ai';
import type { Platform } from '@/lib/utils/social-handles';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraft: (draft: string) => void;
  platform: Platform;
  cardName?: string;
  cardSlug?: string;
  talkTitle?: string;
  speakerName?: string;
  speakerHandle?: string;
};

type GeneratedDraftData = {
  draft: string;
  characterCount: number;
  complianceIndicators: ComplianceIndicator[];
  hasAiInsights: boolean;
  cost: { inputTokens: number; outputTokens: number; costUsd: number };
};

const PLATFORM_LIMITS: Record<Platform, number> = {
  x: 280,
  bluesky: 300,
  threads: 500,
  linkedin: 3000,
  instagram: 2200,
  other: 280,
};

export function DraftGenerator({
  isOpen,
  onClose,
  onSelectDraft,
  platform,
  cardName,
  cardSlug,
  talkTitle,
  speakerName,
  speakerHandle,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<GeneratedDraftData | null>(null);
  const [copied, setCopied] = useState(false);

  // Cost modal state
  const [showCostModal, setShowCostModal] = useState(false);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [budgetImpact, setBudgetImpact] = useState<BudgetImpact | null>(null);
  const [costWarning, setCostWarning] = useState<string | undefined>();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftData(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen]);

  const platformLimit = PLATFORM_LIMITS[platform];

  // Prepare to generate (fetch cost estimate first)
  const prepareGenerate = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/platform-style/cost-estimate?operation=generate-draft&platform=${platform}`);
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

  // Actually generate the draft
  const handleGenerate = async () => {
    setShowCostModal(false);
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch('/api/admin/platform-style/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          cardName,
          cardSlug,
          talkTitle,
          speakerName,
          speakerHandle,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || 'Failed to generate draft');
      }

      const json = await res.json();
      setDraftData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!draftData) return;
    try {
      await navigator.clipboard.writeText(draftData.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const handleUseDraft = () => {
    if (!draftData) return;
    onSelectDraft(draftData.draft);
    onClose();
  };

  if (!isOpen) return null;

  const hasContent = cardName || talkTitle;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-900/50">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-100">Generate Draft</h2>
                <p className="text-sm text-gray-400">AI-powered post for {platform}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Summary */}
          <div className="p-4 bg-gray-900/50 border-b border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Content to share:</p>
            <div className="space-y-1">
              {cardName && (
                <p className="text-sm text-gray-300">
                  <span className="text-gray-500">Card:</span> {cardName}
                </p>
              )}
              {talkTitle && (
                <p className="text-sm text-gray-300">
                  <span className="text-gray-500">Talk:</span> {talkTitle}
                </p>
              )}
              {speakerName && (
                <p className="text-sm text-gray-300">
                  <span className="text-gray-500">Speaker:</span> {speakerName}
                  {speakerHandle && <span className="text-gray-500"> (@{speakerHandle.replace('@', '')})</span>}
                </p>
              )}
              {!hasContent && (
                <p className="text-sm text-amber-400">No card or talk selected</p>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Error State */}
            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Generate Button (when no draft yet) */}
            {!draftData && !loading && (
              <button
                onClick={prepareGenerate}
                disabled={!hasContent}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Generate Draft
              </button>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-purple-400">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating draft...</span>
                </div>
              </div>
            )}

            {/* Draft Display */}
            {draftData && (
              <div className="space-y-4">
                {/* Draft Text */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs text-gray-500">Generated Draft</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">
                    {draftData.draft}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                    <span className={`text-xs ${draftData.characterCount > platformLimit ? 'text-red-400' : 'text-gray-500'}`}>
                      {draftData.characterCount} / {platformLimit} characters
                    </span>
                    {draftData.hasAiInsights && (
                      <span className="text-xs text-purple-400">Enhanced with AI insights</span>
                    )}
                  </div>
                </div>

                {/* Compliance Indicators */}
                {draftData.complianceIndicators.length > 0 && (
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <StyleComplianceIndicator indicators={draftData.complianceIndicators} />
                  </div>
                )}

                {/* Cost */}
                <p className="text-xs text-gray-500 text-center">
                  Cost: ${draftData.cost.costUsd.toFixed(4)} ({draftData.cost.inputTokens} + {draftData.cost.outputTokens} tokens)
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
            {draftData && (
              <button
                onClick={prepareGenerate}
                disabled={loading}
                className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            )}
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {draftData && (
              <button
                onClick={handleUseDraft}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Use This Draft
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cost Warning Modal */}
      {costEstimate && budgetImpact && (
        <CostWarningModal
          isOpen={showCostModal}
          onConfirm={handleGenerate}
          onCancel={() => setShowCostModal(false)}
          loading={loading}
          operationName="Generate Draft"
          operationDescription="Create a post matching your style"
          estimate={costEstimate}
          budget={budgetImpact}
          warning={costWarning}
        />
      )}
    </>
  );
}
