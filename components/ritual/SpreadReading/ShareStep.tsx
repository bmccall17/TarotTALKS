'use client';

import { useState } from 'react';
import { Copy, Check, Link, MessageCircle, X } from 'lucide-react';

interface ShareStepProps {
  spreadShortId: string;
  rationale: string;
  onClose: () => void;
  onBack: () => void;
}

type ShareFormat = 'link' | 'text';

export function ShareStep({ spreadShortId, rationale, onClose, onBack }: ShareStepProps) {
  const [copied, setCopied] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ShareFormat>('link');

  // Use production URL for shares (not /update staging URL)
  const spreadUrl = `https://tarottalks.app/spreads/${spreadShortId}`;

  // Text format with rationale for Discord/WhatsApp
  const textSnippet = `"${rationale}"\n\n${spreadUrl}`;

  const handleCopy = async () => {
    const content = selectedFormat === 'link' ? spreadUrl : textSnippet;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My TarotTALKS Reading',
          text: 'Check out my tarot spread reading!',
          url: spreadUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-100 mb-2">
          Share Your Reading
        </h3>
        <p className="text-sm text-gray-400">
          Share this reading with friends or save it for later.
        </p>
      </div>

      {/* Format Selection */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedFormat('link')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
            selectedFormat === 'link'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Link className="w-4 h-4" />
          Link Only
        </button>
        <button
          onClick={() => setSelectedFormat('text')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
            selectedFormat === 'text'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          With Text
        </button>
      </div>

      {/* Preview Box */}
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
        <p className="text-gray-300 text-sm font-mono break-all whitespace-pre-wrap">
          {selectedFormat === 'link' ? spreadUrl : textSnippet}
        </p>
      </div>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-5 h-5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-5 h-5" />
            Copy to Clipboard
          </>
        )}
      </button>

      {/* Native Share (mobile) */}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleNativeShare}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors"
        >
          Share...
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-xl transition-colors"
        >
          Back to Reading
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
