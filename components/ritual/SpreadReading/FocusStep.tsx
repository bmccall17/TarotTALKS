'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { FocusType } from '@/lib/spread-reading/types';
import { FOCUS_TYPE_LABELS } from '@/lib/spread-reading/types';

interface FocusStepProps {
  onSelect: (focusType: FocusType, focusText?: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function FocusStep({ onSelect, onBack, isLoading }: FocusStepProps) {
  const [selectedFocus, setSelectedFocus] = useState<FocusType | null>(null);
  const [customText, setCustomText] = useState('');

  const focusOptions = Object.entries(FOCUS_TYPE_LABELS) as [FocusType, string][];

  const handleFocusClick = (focus: FocusType) => {
    // Toggle selection - clicking again deselects
    if (selectedFocus === focus) {
      setSelectedFocus(null);
    } else {
      setSelectedFocus(focus);
    }
  };

  const handleContinue = () => {
    // Pass whatever is selected (focus and/or text), or 'surprise_me' if nothing selected
    const focusToUse = selectedFocus || 'surprise_me';
    onSelect(focusToUse, customText.trim() || undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-100 mb-2">
          What's on your mind?
        </h3>
        <p className="text-sm text-gray-400">
          Choose a focus for your reading, or let the cards surprise you.
        </p>
      </div>

      {/* Focus Chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {focusOptions.map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleFocusClick(key)}
            disabled={isLoading}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${selectedFocus === key
                ? 'bg-indigo-600 text-white border-2 border-indigo-400'
                : 'bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500 hover:bg-gray-700'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {key === 'surprise_me' && <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* Custom Text Input - Always visible */}
      <div className="space-y-3">
        <label className="block text-sm text-gray-400 text-center">
          Add a personal question or context (optional)
        </label>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="e.g., I'm feeling stuck in my career..."
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl
                   text-gray-100 placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   resize-none h-20"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Reading...
            </>
          ) : (
            'Read My Spread'
          )}
        </button>
      </div>
    </div>
  );
}
