'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Download, RefreshCw, Check, AlertCircle, ImagePlus, FolderOpen } from 'lucide-react';

type Card = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  shareImageUrl: string | null;
};

type Talk = {
  id: string;
  slug: string;
  title: string;
  speakerName: string;
  thumbnailUrl: string | null;
  shareImageUrl: string | null;
};

type StoredImages = {
  opengraph: string[];
  twitter: string[];
  instagram: string[];
  instagramCardOnly: string[];
};

type TabType = 'cards' | 'talks';

type GenerateResult = {
  type: string;
  success: boolean;
  url?: string;
  error?: string;
};

export default function ShareImagesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [cards, setCards] = useState<Card[]>([]);
  const [talks, setTalks] = useState<Talk[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentItem: '' });
  const [storedImages, setStoredImages] = useState<StoredImages>({ opengraph: [], twitter: [], instagram: [], instagramCardOnly: [] });
  const [errors, setErrors] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'cards') {
      await Promise.all([fetchCards(), fetchStoredImages('cards')]);
    } else {
      await Promise.all([fetchTalks(), fetchStoredImages('talks')]);
    }
    setLoading(false);
  };

  const fetchCards = async () => {
    try {
      await Sentry.startSpan({ name: 'admin.shareImages.fetchCards', op: 'http.client' }, async () => {
        const response = await fetch('/api/admin/cards');
        const data = await response.json();
        setCards(data.cards || []);
      });
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchTalks = async () => {
    try {
      await Sentry.startSpan({ name: 'admin.shareImages.fetchTalks', op: 'http.client' }, async () => {
        const response = await fetch('/api/admin/talks');
        const data = await response.json();
        setTalks(data.talks || []);
      });
    } catch (error) {
      console.error('Error fetching talks:', error);
    }
  };

  const fetchStoredImages = async (category: TabType) => {
    try {
      await Sentry.startSpan(
        { name: 'admin.shareImages.fetchStoredImages', op: 'http.client', attributes: { category } },
        async () => {
          const response = await fetch(`/api/admin/share-images/list?category=${category}`);
          const data = await response.json();
          setStoredImages(data);
        },
      );
    } catch (error) {
      console.error('Error fetching stored images:', error);
    }
  };

  const generateForItem = async (slug: string, category: TabType): Promise<boolean> => {
    const types = category === 'cards'
      ? ['opengraph', 'twitter', 'instagram', 'instagram-card-only']
      : ['opengraph', 'twitter', 'instagram'];

    try {
      const response = await fetch('/api/admin/share-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, slug, types }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      const results = data.results as GenerateResult[];
      return results.every((r) => r.success);
    } catch (error) {
      console.error('Generate failed:', error);
      return false;
    }
  };

  const generateSingle = async (slug: string, name: string) => {
    setGeneratingSingle(slug);
    const success = await generateForItem(slug, activeTab);
    if (!success) {
      setErrors((prev) => [...prev, `${name}: Generation failed`]);
    }
    setGeneratingSingle(null);
    await fetchStoredImages(activeTab);
    // Refresh entity list to pick up new shareImageUrl
    if (activeTab === 'cards') await fetchCards();
    else await fetchTalks();
  };

  const generateAllMissing = async () => {
    setGenerating(true);
    setErrors([]);

    const items = activeTab === 'cards' ? cards : talks;
    // Filter to items that don't have all images yet
    const missing = items.filter((item) => {
      const hasOg = storedImages.opengraph.includes(item.slug);
      const hasTw = storedImages.twitter.includes(item.slug);
      const hasIg = storedImages.instagram.includes(item.slug);
      if (activeTab === 'cards') {
        const hasIgCard = storedImages.instagramCardOnly.includes(item.slug);
        return !(hasOg && hasTw && hasIg && hasIgCard);
      }
      return !(hasOg && hasTw && hasIg);
    });

    setProgress({ current: 0, total: missing.length, currentItem: '' });
    const newErrors: string[] = [];

    for (let i = 0; i < missing.length; i++) {
      const item = missing[i];
      const name = activeTab === 'cards' ? (item as Card).name : (item as Talk).title;
      setProgress({ current: i, total: missing.length, currentItem: `Generating ${name}...` });

      const success = await generateForItem(item.slug, activeTab);
      if (!success) {
        newErrors.push(`${name}: Generation failed`);
      }

      // Small delay between items
      await new Promise((r) => setTimeout(r, 300));
    }

    setProgress({ current: missing.length, total: missing.length, currentItem: 'Complete!' });
    setErrors(newErrors);
    setGenerating(false);
    await fetchStoredImages(activeTab);
    if (activeTab === 'cards') await fetchCards();
    else await fetchTalks();
  };

  const downloadFromSupabase = async (slug: string, type: string) => {
    try {
      const supabaseUrl = storedImages.opengraph.includes(slug)
        ? `/api/admin/share-images/list` // won't work — need direct URL
        : null;

      // Build the Supabase public URL
      // We'll use the Satori URL as a fallback for download (it's still available)
      const basePath = activeTab === 'cards' ? '/cards' : '/talks';
      let imageUrl: string;
      if (type === 'instagram') {
        imageUrl = `${basePath}/${slug}/instagram`;
      } else if (type === 'instagram-card-only') {
        imageUrl = `${basePath}/${slug}/instagram?v=card`;
      } else {
        imageUrl = `${basePath}/${slug}/${type}-image`;
      }

      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-${type}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const isImageStored = (slug: string, type: 'opengraph' | 'twitter' | 'instagram' | 'instagramCardOnly') => {
    return storedImages[type].includes(slug);
  };

  const storedCount = {
    opengraph: storedImages.opengraph.length,
    twitter: storedImages.twitter.length,
    instagram: storedImages.instagram.length,
    instagramCardOnly: storedImages.instagramCardOnly.length,
  };

  const currentItems = activeTab === 'cards' ? cards : talks;
  const totalItems = currentItems.length;

  const missingCount = currentItems.filter((item) => {
    const hasOg = storedImages.opengraph.includes(item.slug);
    const hasTw = storedImages.twitter.includes(item.slug);
    const hasIg = storedImages.instagram.includes(item.slug);
    if (activeTab === 'cards') {
      const hasIgCard = storedImages.instagramCardOnly.includes(item.slug);
      return !(hasOg && hasTw && hasIg && hasIgCard);
    }
    return !(hasOg && hasTw && hasIg);
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Share Images</h1>
        <p className="text-gray-400 mt-1">
          Pre-generate social share images and store in Supabase Storage. Crawlers fetch static PNGs instead of hitting Satori generators.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('cards')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'cards'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Cards ({cards.length})
        </button>
        <button
          onClick={() => setActiveTab('talks')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'talks'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Talks ({talks.length})
        </button>
      </div>

      {/* Storage Status */}
      <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
        <div className="flex items-center gap-2 text-green-400 mb-2">
          <FolderOpen className="w-4 h-4" />
          <span className="font-medium">Supabase Storage: share-images/{activeTab}/</span>
        </div>
        <div className={`grid gap-4 text-sm ${activeTab === 'cards' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div>
            <span className="text-gray-400">OpenGraph:</span>{' '}
            <span className="text-green-300 font-medium">{storedCount.opengraph} / {totalItems}</span>
            {storedCount.opengraph === totalItems && <Check className="w-4 h-4 inline ml-1 text-green-400" />}
          </div>
          <div>
            <span className="text-gray-400">Twitter:</span>{' '}
            <span className="text-green-300 font-medium">{storedCount.twitter} / {totalItems}</span>
            {storedCount.twitter === totalItems && <Check className="w-4 h-4 inline ml-1 text-green-400" />}
          </div>
          <div>
            <span className="text-gray-400">Instagram{activeTab === 'cards' ? ' (Card+Talk)' : ''}:</span>{' '}
            <span className="text-pink-300 font-medium">{storedCount.instagram} / {totalItems}</span>
            {storedCount.instagram === totalItems && <Check className="w-4 h-4 inline ml-1 text-pink-400" />}
          </div>
          {activeTab === 'cards' && (
            <div>
              <span className="text-gray-400">IG (Card only):</span>{' '}
              <span className="text-purple-300 font-medium">{storedCount.instagramCardOnly} / {totalItems}</span>
              {storedCount.instagramCardOnly === totalItems && <Check className="w-4 h-4 inline ml-1 text-purple-400" />}
            </div>
          )}
        </div>
        {missingCount > 0 && (
          <p className="text-xs text-yellow-400 mt-2">
            {missingCount} item{missingCount > 1 ? 's' : ''} missing images
          </p>
        )}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <button
          onClick={generateAllMissing}
          disabled={generating || missingCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <ImagePlus className="w-4 h-4" />
              Generate All Missing ({missingCount})
            </>
          )}
        </button>

        <button
          onClick={() => fetchData()}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {generating && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">{progress.currentItem}</span>
            <span className="text-sm text-gray-400">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">{errors.length} errors occurred</span>
          </div>
          <ul className="text-sm text-red-300 space-y-1 max-h-32 overflow-y-auto">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Items Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentItems.map((item) => {
            const isCard = activeTab === 'cards';
            const name = isCard ? (item as Card).name : (item as Talk).title;
            const ogStored = isImageStored(item.slug, 'opengraph');
            const twStored = isImageStored(item.slug, 'twitter');
            const igStored = isImageStored(item.slug, 'instagram');
            const igCardStored = isCard ? isImageStored(item.slug, 'instagramCardOnly') : true;
            const allStored = ogStored && twStored && igStored && igCardStored;
            const hasDbUrl = 'shareImageUrl' in item && item.shareImageUrl;
            const isGenerating = generatingSingle === item.slug;

            return (
              <div
                key={item.id}
                className={`bg-gray-800/50 border rounded-xl p-4 transition-all ${
                  allStored ? 'border-green-500/50' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <a
                    href={isCard ? `/admin/cards/${item.id}/edit` : `/admin/talks/${item.id}/edit`}
                    className="font-medium text-gray-100 truncate hover:text-indigo-300 transition-colors"
                    title={name}
                  >
                    {name.length > 35 ? name.slice(0, 32) + '...' : name}
                  </a>
                  <div className="flex items-center gap-1">
                    {ogStored && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded" title="OpenGraph in Supabase">
                        OG
                      </span>
                    )}
                    {twStored && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded" title="Twitter in Supabase">
                        TW
                      </span>
                    )}
                    {igStored && (
                      <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-900/50 via-pink-900/50 to-orange-900/50 text-pink-400 rounded" title="Instagram in Supabase">
                        IG
                      </span>
                    )}
                    {isCard && igCardStored && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded" title="IG Card-only in Supabase">
                        IG2
                      </span>
                    )}
                    {hasDbUrl && (
                      <span className="text-xs px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded" title="share_image_url set in DB">
                        DB
                      </span>
                    )}
                  </div>
                </div>

                {!isCard && (
                  <p className="text-xs text-gray-400 mb-3">by {(item as Talk).speakerName}</p>
                )}

                {/* OpenGraph Preview — from Supabase if available, else from Satori */}
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-gray-500">OpenGraph:</p>
                  <div className="border border-gray-700 rounded overflow-hidden">
                    <img
                      src={
                        ogStored
                          ? `/${activeTab}/${item.slug}/opengraph-image`
                          : `/${activeTab}/${item.slug}/opengraph-image?t=${Date.now()}`
                      }
                      alt={`OG: ${name}`}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Instagram Preview */}
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-gray-500">Instagram:</p>
                  {isCard ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="border border-pink-700/50 rounded overflow-hidden mb-1">
                          <img
                            src={`/cards/${item.slug}/instagram`}
                            alt={`IG: ${name}`}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                        <p className="text-[10px] text-pink-400 text-center">Card+Talk</p>
                      </div>
                      <div>
                        <div className="border border-purple-700/50 rounded overflow-hidden mb-1">
                          <img
                            src={`/cards/${item.slug}/instagram?v=card`}
                            alt={`IG Card-only: ${name}`}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                        <p className="text-[10px] text-purple-400 text-center">Card only</p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-pink-700/50 rounded overflow-hidden">
                      <img
                        src={`/talks/${item.slug}/instagram`}
                        alt={`IG: ${name}`}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => generateSingle(item.slug, name)}
                    disabled={isGenerating || generating}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : allStored ? (
                      <RefreshCw className="w-3 h-3" />
                    ) : (
                      <ImagePlus className="w-3 h-3" />
                    )}
                    {allStored ? 'Regen' : 'Generate'}
                  </button>
                  <button
                    onClick={() => downloadFromSupabase(item.slug, 'opengraph')}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    title="Download OG"
                  >
                    <Download className="w-3 h-3" />
                    OG
                  </button>
                  <button
                    onClick={() => downloadFromSupabase(item.slug, 'instagram')}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-orange-400/30 hover:from-purple-600/50 hover:via-pink-500/50 hover:to-orange-400/50 text-pink-300 rounded transition-colors"
                    title="Download IG"
                  >
                    <Download className="w-3 h-3" />
                    IG
                  </button>
                  {isCard && (
                    <button
                      onClick={() => downloadFromSupabase(item.slug, 'instagram-card-only')}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded transition-colors"
                      title="Download IG Card-only"
                    >
                      <Download className="w-3 h-3" />
                      IG2
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  {activeTab === 'cards' ? 'Card' : 'Talk'}
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">DB</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {currentItems.map((item) => {
                const isCard = activeTab === 'cards';
                const name = isCard ? (item as Card).name : (item as Talk).title;
                const ogStored = isImageStored(item.slug, 'opengraph');
                const twStored = isImageStored(item.slug, 'twitter');
                const igStored = isImageStored(item.slug, 'instagram');
                const igCardStored = isCard ? isImageStored(item.slug, 'instagramCardOnly') : true;
                const allStored = ogStored && twStored && igStored && igCardStored;
                const hasDbUrl = 'shareImageUrl' in item && item.shareImageUrl;
                const isGenerating = generatingSingle === item.slug;

                return (
                  <tr key={item.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isCard ? (
                          <img
                            src={(item as Card).imageUrl}
                            alt={name}
                            className="w-8 h-12 object-cover rounded"
                          />
                        ) : (item as Talk).thumbnailUrl ? (
                          <img
                            src={(item as Talk).thumbnailUrl!}
                            alt={name}
                            className="w-16 h-9 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-9 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500">
                            No img
                          </div>
                        )}
                        <div>
                          <a
                            href={isCard ? `/admin/cards/${item.id}/edit` : `/admin/talks/${item.id}/edit`}
                            className="font-medium text-gray-100 hover:text-indigo-300 transition-colors"
                            title={name}
                          >
                            {name.length > 50 ? name.slice(0, 47) + '...' : name}
                          </a>
                          {!isCard && (
                            <p className="text-xs text-gray-500">{(item as Talk).speakerName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {ogStored ? (
                          <span title="OG"><Check className="w-4 h-4 text-green-400" /></span>
                        ) : (
                          <span className="w-4 h-4 text-gray-600">-</span>
                        )}
                        {twStored ? (
                          <span title="TW"><Check className="w-4 h-4 text-blue-400" /></span>
                        ) : (
                          <span className="w-4 h-4 text-gray-600">-</span>
                        )}
                        {igStored ? (
                          <span title="IG"><Check className="w-4 h-4 text-pink-400" /></span>
                        ) : (
                          <span className="w-4 h-4 text-gray-600">-</span>
                        )}
                        {isCard && (igCardStored ? (
                          <span title="IG2"><Check className="w-4 h-4 text-purple-400" /></span>
                        ) : (
                          <span className="w-4 h-4 text-gray-600">-</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasDbUrl ? (
                        <span title="share_image_url set"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => generateSingle(item.slug, name)}
                          disabled={isGenerating || generating}
                          className={`p-1.5 rounded transition-colors ${
                            allStored
                              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                              : 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                          } disabled:opacity-50`}
                          title={allStored ? 'Regenerate' : 'Generate'}
                        >
                          {isGenerating ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ImagePlus className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => downloadFromSupabase(item.slug, 'opengraph')}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                          title="Download OG"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <a
                          href={`/${activeTab}/${item.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 ml-1"
                        >
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <h3 className="font-medium text-gray-100 mb-2">Summary ({activeTab})</h3>
        <div className={`grid gap-4 text-sm ${activeTab === 'cards' ? 'grid-cols-2 md:grid-cols-7' : 'grid-cols-2 md:grid-cols-6'}`}>
          <div>
            <p className="text-gray-500">Total {activeTab === 'cards' ? 'Cards' : 'Talks'}</p>
            <p className="text-2xl font-bold text-gray-100">{totalItems}</p>
          </div>
          <div>
            <p className="text-gray-500">Missing</p>
            <p className={`text-2xl font-bold ${missingCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{missingCount}</p>
          </div>
          <div>
            <p className="text-gray-500">OG Stored</p>
            <p className="text-2xl font-bold text-green-400">{storedCount.opengraph}</p>
          </div>
          <div>
            <p className="text-gray-500">Twitter Stored</p>
            <p className="text-2xl font-bold text-blue-400">{storedCount.twitter}</p>
          </div>
          <div>
            <p className="text-gray-500">IG Stored</p>
            <p className="text-2xl font-bold text-pink-400">{storedCount.instagram}</p>
          </div>
          {activeTab === 'cards' && (
            <div>
              <p className="text-gray-500">IG2 Stored</p>
              <p className="text-2xl font-bold text-purple-400">{storedCount.instagramCardOnly}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">DB URLs Set</p>
            <p className="text-2xl font-bold text-emerald-400">
              {currentItems.filter((item) => 'shareImageUrl' in item && item.shareImageUrl).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
