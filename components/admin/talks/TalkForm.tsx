'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, CheckCircle, ImageIcon, Link2, CloudOff, Cloud } from 'lucide-react';
import { isSupabaseStorageUrl } from '@/lib/supabase';
import { UrlInputs } from './UrlInputs';
import { MetadataFetcher } from './MetadataFetcher';
import { TalkPreview } from './TalkPreview';
import { TagPackCopyButton } from './TagPackCopyButton';
import { Toast } from '../ui/Toast';
import { normalizeHandle } from '@/lib/utils/social-handles';

type TalkFormData = {
  title: string;
  speakerName: string;
  tedUrl: string;
  youtubeUrl: string;
  youtubeVideoId: string | null;
  description: string;
  durationSeconds: number | null;
  year: number | null;
  eventName: string;
  thumbnailUrl: string;
  language: string;
  speakerTwitterHandle: string;
  speakerBlueskyHandle: string;
  speakerLinkedInHandle: string;
  speakerInstagramHandle: string;
};

type Mapping = {
  id: string;
  cardId: string;
  cardName: string;
  cardSlug: string;
  cardImageUrl: string;
  isPrimary: boolean;
  strength: number;
  rationaleShort: string;
};

type Props = {
  initialData?: Partial<TalkFormData>;
  talkId?: string;
  talkSlug?: string;
  mode: 'create' | 'edit';
  mappings?: Mapping[];
};

export function TalkForm({ initialData, talkId, talkSlug, mode, mappings = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<TalkFormData>({
    title: initialData?.title || '',
    speakerName: initialData?.speakerName || '',
    tedUrl: initialData?.tedUrl || '',
    youtubeUrl: initialData?.youtubeUrl || '',
    youtubeVideoId: initialData?.youtubeVideoId || null,
    description: initialData?.description || '',
    durationSeconds: initialData?.durationSeconds || null,
    year: initialData?.year || null,
    eventName: initialData?.eventName || '',
    thumbnailUrl: initialData?.thumbnailUrl || '',
    language: initialData?.language || 'en',
    speakerTwitterHandle: initialData?.speakerTwitterHandle || '',
    speakerBlueskyHandle: initialData?.speakerBlueskyHandle || '',
    speakerLinkedInHandle: initialData?.speakerLinkedInHandle || '',
    speakerInstagramHandle: initialData?.speakerInstagramHandle || '',
  });

  const updateField = <K extends keyof TalkFormData>(field: K, value: TalkFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleApplyMetadata = (metadata: Partial<TalkFormData>) => {
    setFormData((prev) => ({ ...prev, ...metadata }));
    setToast({ message: 'Metadata applied successfully', type: 'success' });
  };

  // Form ref for programmatic submission
  const formRef = useRef<HTMLFormElement>(null);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.speakerName.trim()) {
      newErrors.speakerName = 'Speaker name is required';
    }
    if (!formData.tedUrl.trim() && !formData.youtubeUrl.trim()) {
      newErrors.urls = 'At least one URL (TED.com or YouTube) is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setToast({ message: 'Please fix the errors before submitting', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'create'
        ? '/api/admin/talks'
        : `/api/admin/talks/${talkId}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      // Prepare data for submission
      const submitData = {
        title: formData.title.trim(),
        speakerName: formData.speakerName.trim(),
        tedUrl: formData.tedUrl.trim() || null,
        youtubeUrl: formData.youtubeUrl.trim() || null,
        youtubeVideoId: formData.youtubeVideoId,
        description: formData.description.trim() || null,
        durationSeconds: formData.durationSeconds,
        year: formData.year,
        eventName: formData.eventName.trim() || null,
        thumbnailUrl: formData.thumbnailUrl.trim() || null,
        language: formData.language,
        speakerTwitterHandle: normalizeHandle(formData.speakerTwitterHandle) || null,
        speakerBlueskyHandle: normalizeHandle(formData.speakerBlueskyHandle) || null,
        speakerLinkedInHandle: normalizeHandle(formData.speakerLinkedInHandle) || null,
        speakerInstagramHandle: normalizeHandle(formData.speakerInstagramHandle) || null,
      };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save talk');
      }

      const { talk } = await response.json();

      setToast({
        message: mode === 'create' ? 'Talk created successfully' : 'Talk updated successfully',
        type: 'success',
      });

      // Redirect after a short delay to show the toast
      setTimeout(() => {
        router.push('/admin/talks');
      }, 1500);
    } catch (error) {
      console.error('Error saving talk:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to save talk',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    window.location.href = '/admin/talks';
  };

  return (
    <div className="max-w-7xl mx-auto p-8 pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100">
          {mode === 'create' ? 'Create New Talk' : 'Edit Talk'}
        </h1>
        <p className="text-gray-400 mt-2">
          {mode === 'create'
            ? 'Add a new TED talk to the collection'
            : 'Update talk details and metadata'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Column */}
        <div className="space-y-6">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* URLs Section */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">URLs</h2>
              <UrlInputs
                tedUrl={formData.tedUrl}
                youtubeUrl={formData.youtubeUrl}
                onTedUrlChange={(url) => updateField('tedUrl', url)}
                onYoutubeUrlChange={(url) => updateField('youtubeUrl', url)}
                onYoutubeVideoIdChange={(id) => updateField('youtubeVideoId', id)}
                error={errors.urls}
              />
            </div>

            {/* Metadata Fetcher */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Fetch Metadata</h2>
              <MetadataFetcher
                tedUrl={formData.tedUrl}
                youtubeUrl={formData.youtubeUrl}
                onApplyMetadata={handleApplyMetadata}
              />
            </div>

            {/* Basic Information */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Basic Information</h2>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter talk title"
                />
                {errors.title && (
                  <p className="text-sm text-red-400 mt-1">{errors.title}</p>
                )}
              </div>

              {/* Speaker Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Speaker Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.speakerName}
                  onChange={(e) => updateField('speakerName', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter speaker name"
                />
                {errors.speakerName && (
                  <p className="text-sm text-red-400 mt-1">{errors.speakerName}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter talk description"
                />
              </div>
            </div>

            {/* Additional Details */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Additional Details</h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={formData.year || ''}
                    onChange={(e) => updateField('year', e.target.value ? parseInt(e.target.value, 10) : null)}
                    min="1900"
                    max="2100"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="2024"
                  />
                </div>

                {/* Duration (seconds) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={formData.durationSeconds || ''}
                    onChange={(e) => updateField('durationSeconds', e.target.value ? parseInt(e.target.value, 10) : null)}
                    min="0"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="900"
                  />
                </div>
              </div>

              {/* Event Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event Name
                </label>
                <input
                  type="text"
                  value={formData.eventName}
                  onChange={(e) => updateField('eventName', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="TED2024, TEDxBerkeley, etc."
                />
              </div>

              {/* Thumbnail URL - Smart Display */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Thumbnail
                </label>

                {/* Check if we have a Supabase Storage image */}
                {formData.thumbnailUrl && isSupabaseStorageUrl(formData.thumbnailUrl) ? (
                  // SECURED IN STORAGE - Show green badge and preview
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                      <Cloud className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-300">Secured in Storage</p>
                        <p className="text-xs text-green-400/70">Image saved to Supabase Storage</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    </div>

                    {/* Preview of stored image */}
                    <div className="relative w-full max-w-xs">
                      <img
                        src={formData.thumbnailUrl}
                        alt="Current thumbnail"
                        className="w-full h-auto rounded-lg border border-gray-700"
                      />
                    </div>

                    {/* Option to replace */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateField('thumbnailUrl', '')}
                        className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Clear & use new URL
                      </button>
                    </div>
                  </div>
                ) : formData.thumbnailUrl && (formData.thumbnailUrl.startsWith('http://') || formData.thumbnailUrl.startsWith('https://')) ? (
                  // EXTERNAL URL - Show warning that needs to be uploaded
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-4 py-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <CloudOff className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-300">External Source</p>
                        <p className="text-xs text-yellow-400/70">Will be uploaded to storage on save</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <input
                        type="url"
                        value={formData.thumbnailUrl}
                        onChange={(e) => updateField('thumbnailUrl', e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-900 border border-yellow-600/50 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        onClick={() => updateField('thumbnailUrl', '')}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Clear URL"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Preview of external image */}
                    <div className="relative w-full max-w-xs">
                      <img
                        src={formData.thumbnailUrl}
                        alt="Thumbnail preview"
                        className="w-full h-auto rounded-lg border border-yellow-700/50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // NO THUMBNAIL - Show empty input
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <input
                        type="url"
                        value={formData.thumbnailUrl}
                        onChange={(e) => updateField('thumbnailUrl', e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="https://... or use Fetch Metadata above"
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      Use "Fetch Metadata" above to automatically get thumbnail from TED/YouTube
                    </p>
                  </div>
                )}
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <input
                  type="text"
                  value={formData.language}
                  onChange={(e) => updateField('language', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="en"
                  maxLength={5}
                />
                <p className="text-xs text-gray-400 mt-1">
                  ISO 639-1 language code (e.g., en, es, fr)
                </p>
              </div>
            </div>

            {/* Social / Tag Pack */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Social / Tag Pack</h2>
              <p className="text-sm text-gray-400 -mt-2 mb-4">
                Add speaker social handles for quick copy-to-clipboard when sharing on social media.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Twitter/X Handle */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    X (Twitter) Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                    <input
                      type="text"
                      value={formData.speakerTwitterHandle}
                      onChange={(e) => updateField('speakerTwitterHandle', e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="speaker_handle"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Without @ prefix. Use comma for multiple.
                  </p>
                </div>

                {/* Bluesky Handle */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bluesky Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                    <input
                      type="text"
                      value={formData.speakerBlueskyHandle}
                      onChange={(e) => updateField('speakerBlueskyHandle', e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="speaker.bsky.social"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Full handle (e.g., user.bsky.social)
                  </p>
                </div>

                {/* LinkedIn Handle */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    LinkedIn Handle
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.speakerLinkedInHandle}
                      onChange={(e) => updateField('speakerLinkedInHandle', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                      placeholder="in/speaker-name"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Profile slug (e.g., in/speaker-name)
                  </p>
                </div>

                {/* Instagram Handle */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                    <input
                      type="text"
                      value={formData.speakerInstagramHandle}
                      onChange={(e) => updateField('speakerInstagramHandle', e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="speaker_handle"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Without @ prefix.
                  </p>
                </div>
              </div>

              {/* Copy Buttons */}
              <div className="pt-2">
                <TagPackCopyButton
                  twitterHandle={formData.speakerTwitterHandle}
                  blueskyHandle={formData.speakerBlueskyHandle}
                  linkedInHandle={formData.speakerLinkedInHandle}
                  instagramHandle={formData.speakerInstagramHandle}
                  speakerName={formData.speakerName}
                  talkTitle={formData.title}
                  year={formData.year}
                  eventName={formData.eventName}
                  mappings={mappings.map((m) => ({
                    cardName: m.cardName,
                    cardSlug: m.cardSlug,
                    isPrimary: m.isPrimary,
                    rationaleShort: m.rationaleShort,
                  }))}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Preview Column */}
        <div>
          <div className="lg:sticky lg:top-8 space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Preview</h2>
              {mode === 'edit' && talkSlug && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://tarottalks.app/talks/${talkSlug}`);
                    }}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                    title="Click to copy URL"
                  >
                    https://tarottalks.app/talks/{talkSlug}
                  </button>
                </div>
              )}
              <TalkPreview data={formData} slug={talkSlug} />
            </div>

            {/* Mapped Cards */}
            {mode === 'edit' && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">
                  Mapped Cards ({mappings.length})
                </h2>

                {mappings.length === 0 ? (
                  <p className="text-gray-400 text-sm">No cards mapped to this talk yet.</p>
                ) : (
                  <div className="space-y-3">
                    {mappings.map((mapping) => (
                      <a
                        key={mapping.cardId}
                        href={`/admin/cards/${mapping.cardId}/edit`}
                        className="flex items-start gap-3 p-3 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-indigo-500/50 transition-colors group"
                      >
                        <div className="w-12 h-16 relative flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                          <img
                            src={mapping.cardImageUrl}
                            alt={mapping.cardName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-100 group-hover:text-indigo-400 transition-colors">
                              {mapping.cardName}
                            </h3>
                            {mapping.isPrimary && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-500/30">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                            {mapping.rationaleShort}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-6 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {mode === 'edit' && mappings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const primaryCard = mappings.find(m => m.isPrimary);
                      const cardId = primaryCard?.cardId || mappings[0]?.cardId;
                      const url = cardId ? `/admin/mappings?cardId=${cardId}` : '/admin/mappings';
                      window.location.href = url;
                    }}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Manage Mappings
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }}
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : mode === 'create' ? 'Create Talk' : 'Update Talk'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
