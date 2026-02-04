'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Check, AlertCircle, Save, FolderOpen } from 'lucide-react';

type Card = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
};

type Talk = {
  id: string;
  slug: string;
  title: string;
  speakerName: string;
  thumbnailUrl: string | null;
};

type SavedImages = {
  opengraph: string[];
  twitter: string[];
  instagram: string[];
  instagramCardOnly: string[];
};

type TabType = 'cards' | 'talks';

export default function ShareImagesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [cards, setCards] = useState<Card[]>([]);
  const [talks, setTalks] = useState<Talk[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentItem: '' });
  const [generatedItems, setGeneratedItems] = useState<Set<string>>(new Set());
  const [savedImages, setSavedImages] = useState<SavedImages>({ opengraph: [], twitter: [], instagram: [], instagramCardOnly: [] });
  const [errors, setErrors] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'cards') {
      await Promise.all([fetchCards(), fetchSavedImages('cards')]);
    } else {
      await Promise.all([fetchTalks(), fetchSavedImages('talks')]);
    }
    setLoading(false);
  };

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/admin/cards');
      const data = await response.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchTalks = async () => {
    try {
      const response = await fetch('/api/admin/talks');
      const data = await response.json();
      setTalks(data.talks || []);
    } catch (error) {
      console.error('Error fetching talks:', error);
    }
  };

  const fetchSavedImages = async (category: TabType) => {
    try {
      const response = await fetch(`/api/admin/share-images/save?category=${category}`);
      const data = await response.json();
      setSavedImages(data);
    } catch (error) {
      console.error('Error fetching saved images:', error);
    }
  };

  const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  };

  const saveImageToPublic = async (
    slug: string,
    type: 'opengraph' | 'twitter' | 'instagram' | 'instagramCardOnly',
    category: TabType
  ): Promise<boolean> => {
    try {
      const basePath = category === 'cards' ? '/cards' : '/talks';
      // Instagram uses a different URL pattern (route handler, not image convention)
      let imageUrl: string;
      if (type === 'instagram') {
        imageUrl = `${basePath}/${slug}/instagram?t=${Date.now()}`;
      } else if (type === 'instagramCardOnly') {
        imageUrl = `${basePath}/${slug}/instagram?v=card&t=${Date.now()}`;
      } else {
        imageUrl = `${basePath}/${slug}/${type}-image?t=${Date.now()}`;
      }
      const base64 = await fetchImageAsBase64(imageUrl);
      if (!base64) return false;

      const response = await fetch('/api/admin/share-images/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, type, imageData: base64, category }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error saving image:', error);
      return false;
    }
  };

  const saveAllToPublic = async () => {
    setSaving(true);
    const items = activeTab === 'cards' ? cards : talks;
    // Cards: 4 images (OG, Twitter, IG Card+Talk, IG Card-only)
    // Talks: 3 images (OG, Twitter, IG)
    const imagesPerItem = activeTab === 'cards' ? 4 : 3;
    setProgress({ current: 0, total: items.length * imagesPerItem, currentItem: '' });
    setGeneratedItems(new Set());
    setErrors([]);

    const newErrors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = activeTab === 'cards' ? (item as Card).name : (item as Talk).title;
      let stepOffset = 0;

      setProgress({ current: i * imagesPerItem + stepOffset, total: items.length * imagesPerItem, currentItem: `Saving ${name}...` });

      // Save OpenGraph image
      const ogSuccess = await saveImageToPublic(item.slug, 'opengraph', activeTab);
      if (!ogSuccess) {
        newErrors.push(`${name}: OpenGraph save failed`);
      }
      stepOffset++;

      setProgress({ current: i * imagesPerItem + stepOffset, total: items.length * imagesPerItem, currentItem: `Saving ${name}...` });

      // Save Twitter image
      const twitterSuccess = await saveImageToPublic(item.slug, 'twitter', activeTab);
      if (!twitterSuccess) {
        newErrors.push(`${name}: Twitter save failed`);
      }
      stepOffset++;

      setProgress({ current: i * imagesPerItem + stepOffset, total: items.length * imagesPerItem, currentItem: `Saving ${name}...` });

      // Save Instagram image (Card+Talk for cards, Talk+Card for talks)
      const igSuccess = await saveImageToPublic(item.slug, 'instagram', activeTab);
      if (!igSuccess) {
        newErrors.push(`${name}: Instagram save failed`);
      }
      stepOffset++;

      // For cards, also save the card-only Instagram variant
      let igCardOnlySuccess = true;
      if (activeTab === 'cards') {
        setProgress({ current: i * imagesPerItem + stepOffset, total: items.length * imagesPerItem, currentItem: `Saving ${name}...` });
        igCardOnlySuccess = await saveImageToPublic(item.slug, 'instagramCardOnly', activeTab);
        if (!igCardOnlySuccess) {
          newErrors.push(`${name}: Instagram (card-only) save failed`);
        }
      }

      if (ogSuccess && twitterSuccess && igSuccess && igCardOnlySuccess) {
        setGeneratedItems((prev) => new Set([...prev, item.slug]));
      }

      // Small delay to prevent overwhelming the server
      await new Promise((r) => setTimeout(r, 150));
    }

    setProgress({ current: items.length * imagesPerItem, total: items.length * imagesPerItem, currentItem: 'Complete!' });
    setErrors(newErrors);
    setSaving(false);
    await fetchSavedImages(activeTab);
  };

  const downloadImage = async (slug: string, type: 'opengraph' | 'twitter' | 'instagram' | 'instagramCardOnly') => {
    try {
      const basePath = activeTab === 'cards' ? '/cards' : '/talks';
      // Instagram uses a different URL pattern (route handler, not image convention)
      let imageUrl: string;
      if (type === 'instagram') {
        imageUrl = `${basePath}/${slug}/instagram`;
      } else if (type === 'instagramCardOnly') {
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

  const downloadAllImages = async () => {
    setGenerating(true);
    const items = activeTab === 'cards' ? cards : talks;
    setProgress({ current: 0, total: items.length * 2, currentItem: '' });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = activeTab === 'cards' ? (item as Card).name : (item as Talk).title;
      setProgress({ current: i * 2, total: items.length * 2, currentItem: `Downloading ${name}...` });

      await downloadImage(item.slug, 'opengraph');
      await new Promise((r) => setTimeout(r, 200));

      setProgress({ current: i * 2 + 1, total: items.length * 2, currentItem: `Downloading ${name}...` });

      await downloadImage(item.slug, 'twitter');
      await new Promise((r) => setTimeout(r, 200));
    }

    setProgress({ current: items.length * 2, total: items.length * 2, currentItem: 'Complete!' });
    setGenerating(false);
  };

  const isImageSaved = (slug: string, type: 'opengraph' | 'twitter' | 'instagram' | 'instagramCardOnly') => {
    return savedImages[type].includes(slug);
  };

  const savedCount = {
    opengraph: savedImages.opengraph.length,
    twitter: savedImages.twitter.length,
    instagram: savedImages.instagram.length,
    instagramCardOnly: savedImages.instagramCardOnly.length,
  };

  const currentItems = activeTab === 'cards' ? cards : talks;
  const totalItems = currentItems.length;

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
          Generate and save OpenGraph/Twitter share images as static fallbacks
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

      {/* Saved Images Status */}
      <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
        <div className="flex items-center gap-2 text-green-400 mb-2">
          <FolderOpen className="w-4 h-4" />
          <span className="font-medium">Saved Fallback Images ({activeTab})</span>
        </div>
        <div className={`grid gap-4 text-sm ${activeTab === 'cards' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div>
            <span className="text-gray-400">OpenGraph:</span>{' '}
            <span className="text-green-300 font-medium">{savedCount.opengraph} / {totalItems}</span>
            {savedCount.opengraph === totalItems && <Check className="w-4 h-4 inline ml-1 text-green-400" />}
          </div>
          <div>
            <span className="text-gray-400">Twitter:</span>{' '}
            <span className="text-green-300 font-medium">{savedCount.twitter} / {totalItems}</span>
            {savedCount.twitter === totalItems && <Check className="w-4 h-4 inline ml-1 text-green-400" />}
          </div>
          <div>
            <span className="text-gray-400">Instagram{activeTab === 'cards' ? ' (Card+Talk)' : ''}:</span>{' '}
            <span className="text-pink-300 font-medium">{savedCount.instagram} / {totalItems}</span>
            {savedCount.instagram === totalItems && <Check className="w-4 h-4 inline ml-1 text-pink-400" />}
          </div>
          {activeTab === 'cards' && (
            <div>
              <span className="text-gray-400">IG (Card only):</span>{' '}
              <span className="text-purple-300 font-medium">{savedCount.instagramCardOnly} / {totalItems}</span>
              {savedCount.instagramCardOnly === totalItems && <Check className="w-4 h-4 inline ml-1 text-purple-400" />}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Saved to:{' '}
          <code className="bg-gray-800 px-1 rounded">
            /public/images/share/[opengraph|twitter|instagram{activeTab === 'cards' ? '|instagramCardOnly' : ''}]/{activeTab === 'talks' ? 'talks/' : ''}[slug].png
          </code>
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <button
          onClick={saveAllToPublic}
          disabled={saving || generating}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save All to Public (Fallback)
            </>
          )}
        </button>

        <button
          onClick={downloadAllImages}
          disabled={saving || generating}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Download All
        </button>

        <button
          onClick={() => {
            setRefreshKey(Date.now());
            fetchSavedImages(activeTab);
          }}
          disabled={saving || generating}
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
      {(saving || generating) && (
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
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
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
      {activeTab === 'cards' ? (
        // Cards View
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((card) => {
              const ogSaved = isImageSaved(card.slug, 'opengraph');
              const twitterSaved = isImageSaved(card.slug, 'twitter');
              const igSaved = isImageSaved(card.slug, 'instagram');
              const igCardOnlySaved = isImageSaved(card.slug, 'instagramCardOnly');
              const allSaved = ogSaved && twitterSaved && igSaved && igCardOnlySaved;

              return (
                <div
                  key={card.id}
                  className={`bg-gray-800/50 border rounded-xl p-4 transition-all ${
                    allSaved ? 'border-green-500/50' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-100 truncate">{card.name}</h3>
                    <div className="flex items-center gap-1">
                      {ogSaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded" title="OpenGraph saved">
                          OG
                        </span>
                      )}
                      {twitterSaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded" title="Twitter saved">
                          TW
                        </span>
                      )}
                      {igSaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-900/50 via-pink-900/50 to-orange-900/50 text-pink-400 rounded" title="Instagram (Card+Talk) saved">
                          IG
                        </span>
                      )}
                      {igCardOnlySaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 text-purple-400 rounded" title="Instagram (Card only) saved">
                          IG2
                        </span>
                      )}
                    </div>
                  </div>

                  {/* OpenGraph Preview */}
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-gray-500">OpenGraph:</p>
                    <a
                      href={`/cards/${card.slug}/opengraph-image`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-gray-700 rounded overflow-hidden hover:border-gray-500 transition-colors"
                    >
                      <img
                        src={`/cards/${card.slug}/opengraph-image?t=${refreshKey}`}
                        alt={`OG: ${card.name}`}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </a>
                  </div>

                  {/* Instagram Previews - side by side */}
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-gray-500">Instagram:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <a
                          href={`/cards/${card.slug}/instagram`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border border-pink-700/50 rounded overflow-hidden mb-1 hover:border-pink-500 transition-colors"
                        >
                          <img
                            src={`/cards/${card.slug}/instagram?t=${refreshKey}`}
                            alt={`IG Card+Talk: ${card.name}`}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </a>
                        <p className="text-[10px] text-pink-400 text-center">Card+Talk</p>
                      </div>
                      <div>
                        <a
                          href={`/cards/${card.slug}/instagram?v=card`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border border-purple-700/50 rounded overflow-hidden mb-1 hover:border-purple-500 transition-colors"
                        >
                          <img
                            src={`/cards/${card.slug}/instagram?v=card&t=${refreshKey}`}
                            alt={`IG Card-only: ${card.name}`}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </a>
                        <p className="text-[10px] text-purple-400 text-center">Card only</p>
                      </div>
                    </div>
                  </div>

                  {/* Download buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => downloadImage(card.slug, 'opengraph')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      OG
                    </button>
                    <button
                      onClick={() => downloadImage(card.slug, 'twitter')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      TW
                    </button>
                    <button
                      onClick={() => downloadImage(card.slug, 'instagram')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-orange-400/30 hover:from-purple-600/50 hover:via-pink-500/50 hover:to-orange-400/50 text-pink-300 rounded transition-colors"
                      title="Download Card+Talk"
                    >
                      <Download className="w-3 h-3" />
                      IG1
                    </button>
                    <button
                      onClick={() => downloadImage(card.slug, 'instagramCardOnly')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded transition-colors"
                      title="Download Card only"
                    >
                      <Download className="w-3 h-3" />
                      IG2
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Card</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">OpenGraph</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Twitter</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">IG (Card+Talk)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">IG (Card only)</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Saved</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {cards.map((card) => {
                  const ogSaved = isImageSaved(card.slug, 'opengraph');
                  const twitterSaved = isImageSaved(card.slug, 'twitter');
                  const igSaved = isImageSaved(card.slug, 'instagram');
                  const igCardOnlySaved = isImageSaved(card.slug, 'instagramCardOnly');

                  return (
                    <tr key={card.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="w-8 h-12 object-cover rounded"
                          />
                          <div>
                            <p className="font-medium text-gray-100">{card.name}</p>
                            <p className="text-xs text-gray-500">{card.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/cards/${card.slug}/opengraph-image`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/cards/${card.slug}/opengraph-image?t=${refreshKey}`}
                            alt={`OG: ${card.name}`}
                            className="w-32 h-auto rounded border border-gray-700 hover:border-gray-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/cards/${card.slug}/twitter-image`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/cards/${card.slug}/twitter-image?t=${refreshKey}`}
                            alt={`Twitter: ${card.name}`}
                            className="w-32 h-auto rounded border border-gray-700 hover:border-gray-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/cards/${card.slug}/instagram`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/cards/${card.slug}/instagram?t=${refreshKey}`}
                            alt={`IG Card+Talk: ${card.name}`}
                            className="w-20 h-20 object-cover rounded border border-pink-700/50 hover:border-pink-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/cards/${card.slug}/instagram?v=card`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/cards/${card.slug}/instagram?v=card&t=${refreshKey}`}
                            alt={`IG Card-only: ${card.name}`}
                            className="w-20 h-20 object-cover rounded border border-purple-700/50 hover:border-purple-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {ogSaved ? (
                            <span title="OpenGraph saved">
                              <Check className="w-4 h-4 text-green-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                          {twitterSaved ? (
                            <span title="Twitter saved">
                              <Check className="w-4 h-4 text-blue-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                          {igSaved ? (
                            <span title="IG Card+Talk saved">
                              <Check className="w-4 h-4 text-pink-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                          {igCardOnlySaved ? (
                            <span title="IG Card-only saved">
                              <Check className="w-4 h-4 text-purple-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadImage(card.slug, 'opengraph')}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            title="Download OpenGraph"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadImage(card.slug, 'instagram')}
                            className="p-1.5 text-pink-400 hover:text-pink-300 hover:bg-gray-700 rounded transition-colors"
                            title="Download IG Card+Talk"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadImage(card.slug, 'instagramCardOnly')}
                            className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded transition-colors"
                            title="Download IG Card-only"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <a
                            href={`/cards/${card.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300"
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
        )
      ) : (
        // Talks View
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {talks.map((talk) => {
              const ogSaved = isImageSaved(talk.slug, 'opengraph');
              const twitterSaved = isImageSaved(talk.slug, 'twitter');
              const igSaved = isImageSaved(talk.slug, 'instagram');
              const allSaved = ogSaved && twitterSaved && igSaved;

              return (
                <div
                  key={talk.id}
                  className={`bg-gray-800/50 border rounded-xl p-4 transition-all ${
                    allSaved ? 'border-green-500/50' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-100 truncate" title={talk.title}>
                      {talk.title.length > 40 ? talk.title.slice(0, 37) + '...' : talk.title}
                    </h3>
                    <div className="flex items-center gap-1">
                      {ogSaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded" title="OpenGraph saved">
                          OG
                        </span>
                      )}
                      {twitterSaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded" title="Twitter saved">
                          TW
                        </span>
                      )}
                      {igSaved && (
                        <span className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-900/50 via-pink-900/50 to-orange-900/50 text-pink-400 rounded" title="Instagram saved">
                          IG
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">by {talk.speakerName}</p>

                  {/* OpenGraph Preview */}
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-gray-500">OpenGraph:</p>
                    <a
                      href={`/talks/${talk.slug}/opengraph-image`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-gray-700 rounded overflow-hidden hover:border-gray-500 transition-colors"
                    >
                      <img
                        src={`/talks/${talk.slug}/opengraph-image?t=${refreshKey}`}
                        alt={`OG: ${talk.title}`}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </a>
                  </div>

                  {/* Instagram Preview */}
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-gray-500">Instagram:</p>
                    <a
                      href={`/talks/${talk.slug}/instagram`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-pink-700/50 rounded overflow-hidden hover:border-pink-500 transition-colors"
                    >
                      <img
                        src={`/talks/${talk.slug}/instagram?t=${refreshKey}`}
                        alt={`IG: ${talk.title}`}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </a>
                  </div>

                  {/* Download buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadImage(talk.slug, 'opengraph')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      OG
                    </button>
                    <button
                      onClick={() => downloadImage(talk.slug, 'twitter')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      TW
                    </button>
                    <button
                      onClick={() => downloadImage(talk.slug, 'instagram')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-orange-400/30 hover:from-purple-600/50 hover:via-pink-500/50 hover:to-orange-400/50 text-pink-300 rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      IG
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Talk</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">OpenGraph</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Twitter</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Instagram</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Saved</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {talks.map((talk) => {
                  const ogSaved = isImageSaved(talk.slug, 'opengraph');
                  const twitterSaved = isImageSaved(talk.slug, 'twitter');
                  const igSaved = isImageSaved(talk.slug, 'instagram');

                  return (
                    <tr key={talk.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {talk.thumbnailUrl ? (
                            <img
                              src={talk.thumbnailUrl}
                              alt={talk.title}
                              className="w-16 h-9 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-9 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500">
                              No img
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-100" title={talk.title}>
                              {talk.title.length > 50 ? talk.title.slice(0, 47) + '...' : talk.title}
                            </p>
                            <p className="text-xs text-gray-500">{talk.speakerName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/talks/${talk.slug}/opengraph-image`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/talks/${talk.slug}/opengraph-image?t=${refreshKey}`}
                            alt={`OG: ${talk.title}`}
                            className="w-32 h-auto rounded border border-gray-700 hover:border-gray-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/talks/${talk.slug}/twitter-image`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/talks/${talk.slug}/twitter-image?t=${refreshKey}`}
                            alt={`Twitter: ${talk.title}`}
                            className="w-32 h-auto rounded border border-gray-700 hover:border-gray-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/talks/${talk.slug}/instagram`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/talks/${talk.slug}/instagram?t=${refreshKey}`}
                            alt={`IG: ${talk.title}`}
                            className="w-20 h-20 object-cover rounded border border-pink-700/50 hover:border-pink-500 transition-colors"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {ogSaved ? (
                            <span title="OpenGraph saved">
                              <Check className="w-4 h-4 text-green-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                          {twitterSaved ? (
                            <span title="Twitter saved">
                              <Check className="w-4 h-4 text-blue-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                          {igSaved ? (
                            <span title="Instagram saved">
                              <Check className="w-4 h-4 text-pink-400" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 text-gray-600">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadImage(talk.slug, 'opengraph')}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            title="Download OpenGraph"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadImage(talk.slug, 'instagram')}
                            className="p-1.5 text-pink-400 hover:text-pink-300 hover:bg-gray-700 rounded transition-colors"
                            title="Download Instagram"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <a
                            href={`/talks/${talk.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300"
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
        )
      )}

      {/* Stats */}
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <h3 className="font-medium text-gray-100 mb-2">Summary ({activeTab})</h3>
        <div className={`grid gap-4 text-sm ${activeTab === 'cards' ? 'grid-cols-2 md:grid-cols-7' : 'grid-cols-2 md:grid-cols-6'}`}>
          <div>
            <p className="text-gray-500">Total {activeTab === 'cards' ? 'Cards' : 'Talks'}</p>
            <p className="text-2xl font-bold text-gray-100">{totalItems}</p>
          </div>
          <div>
            <p className="text-gray-500">Images Per Item</p>
            <p className="text-2xl font-bold text-gray-100">{activeTab === 'cards' ? 4 : 3}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Images</p>
            <p className="text-2xl font-bold text-gray-100">{totalItems * (activeTab === 'cards' ? 4 : 3)}</p>
          </div>
          <div>
            <p className="text-gray-500">OG Saved</p>
            <p className="text-2xl font-bold text-green-400">{savedCount.opengraph}</p>
          </div>
          <div>
            <p className="text-gray-500">Twitter Saved</p>
            <p className="text-2xl font-bold text-blue-400">{savedCount.twitter}</p>
          </div>
          <div>
            <p className="text-gray-500">IG{activeTab === 'cards' ? ' (Card+Talk)' : ''} Saved</p>
            <p className="text-2xl font-bold text-pink-400">{savedCount.instagram}</p>
          </div>
          {activeTab === 'cards' && (
            <div>
              <p className="text-gray-500">IG (Card only)</p>
              <p className="text-2xl font-bold text-purple-400">{savedCount.instagramCardOnly}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
