'use client';

import { useState, useEffect } from 'react';
import { X, Copy, ExternalLink, Check } from 'lucide-react';
import type { SpreadCard, FocusType } from '@/lib/spread-reading/types';
import { FOCUS_TYPE_LABELS } from '@/lib/spread-reading/types';

const POSITION_LABELS = ['Aware Self', 'Supporting Shadow', 'Emerging Path'];
const GPT_URL = 'https://chatgpt.com/g/g-6965a1a328ec8191bc976bd89d963972-tarottalks-spread-reader';

interface GPTFallbackModalProps {
  cards: SpreadCard[];
  focusType?: FocusType | null;
  focusText?: string;
  onClose: () => void;
}

export function GPTFallbackModal({ cards, focusType, focusText, onClose }: GPTFallbackModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyEnabled, setCopyEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(true);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get focus label for display
  const getFocusLabel = (): string | null => {
    if (!focusType) return null;
    if (focusType === 'custom') return null; // Custom focus uses focusText instead
    if (focusType === 'surprise_me') return null; // No specific focus
    return FOCUS_TYPE_LABELS[focusType] || null;
  };

  const focusLabel = getFocusLabel();

  // Build the spread text from cards in position order
  const cardsText = cards
    .map((card, index) => `${POSITION_LABELS[index]}: ${card.name}`)
    .join(', ');

  // Build complete spread text including focus and personal context
  const buildSpreadText = (): string => {
    const parts: string[] = [];

    // Add cards
    parts.push(cardsText);

    // Add focus area if selected
    if (focusLabel) {
      parts.push(`Focus: ${focusLabel}`);
    }

    // Add personal question/context if provided
    if (focusText) {
      parts.push(`Context: ${focusText}`);
    }

    return parts.join('\n');
  };

  const spreadText = buildSpreadText();

  const handleContinue = async () => {
    const shouldCopy = isMobile || copyEnabled;

    if (shouldCopy) {
      try {
        await navigator.clipboard.writeText(spreadText);
        setCopied(true);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }

    // Open GPT in new tab
    window.open(GPT_URL, '_blank', 'noopener,noreferrer');

    // Close modal after a brief delay
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[10000]">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Get a Deeper Reading</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            {isMobile
              ? 'Copy your spread below, then paste it into the TarotTALKS GPT for a personalized AI reading.'
              : 'Share your spread with the TarotTALKS GPT for a personalized AI reading.'}
          </p>

          {/* Spread Text Box */}
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-2">
            <p className="text-gray-100 text-sm leading-relaxed font-medium">
              {cardsText}
            </p>
            {focusLabel && (
              <p className="text-gray-300 text-sm">
                <span className="text-gray-500">Focus:</span> {focusLabel}
              </p>
            )}
            {focusText && (
              <p className="text-gray-300 text-sm">
                <span className="text-gray-500">Context:</span> {focusText}
              </p>
            )}
          </div>

          {/* Desktop: Copy checkbox */}
          {!isMobile && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  copyEnabled
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-500 group-hover:border-gray-400'
                }`}
                onClick={() => setCopyEnabled(!copyEnabled)}
              >
                {copyEnabled && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-gray-300">Copy spread text to clipboard</span>
            </label>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Copy className="w-4 h-4" />
                  Copied!
                </>
              ) : isMobile ? (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Copy & Continue
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Continue to GPT
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
