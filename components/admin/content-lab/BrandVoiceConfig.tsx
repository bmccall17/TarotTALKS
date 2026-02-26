'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, X, CheckCircle } from 'lucide-react';

type BrandConfig = {
  id: string;
  offerDescription: string | null;
  audiencePersona: string | null;
  keyMessagingPillars: string | null;
  brandToneDescription: string | null;
  contentFrameworks: string | null;
  ctaOptions: string | null;
};

const ALL_FRAMEWORKS = [
  { id: '3_things', label: '3 Things I Know About [X]' },
  { id: 'hook_story_offer', label: 'Hook-Story-Offer' },
  { id: 'pas', label: 'Problem-Agitate-Solve (PAS)' },
  { id: 'open_loop', label: 'Open Loop (Question/Poll)' },
  { id: 'before_after', label: 'Before-After' },
  { id: 'aida', label: 'AIDA (Attention-Interest-Desire-Action)' },
];

export function BrandVoiceConfig() {
  const [config, setConfig] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [offerDescription, setOfferDescription] = useState('');
  const [audiencePersona, setAudiencePersona] = useState('');
  const [pillars, setPillars] = useState<string[]>([]);
  const [newPillar, setNewPillar] = useState('');
  const [brandTone, setBrandTone] = useState('');
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [ctas, setCtas] = useState<string[]>([]);
  const [newCta, setNewCta] = useState('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load config
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/content-assistant/brand-config');
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          setOfferDescription(data.config.offerDescription || '');
          setAudiencePersona(data.config.audiencePersona || '');
          setBrandTone(data.config.brandToneDescription || '');
          try { setPillars(JSON.parse(data.config.keyMessagingPillars || '[]')); } catch { setPillars([]); }
          try { setFrameworks(JSON.parse(data.config.contentFrameworks || '[]')); } catch { setFrameworks([]); }
          try { setCtas(JSON.parse(data.config.ctaOptions || '[]')); } catch { setCtas([]); }
        }
      } catch (err) {
        setError('Failed to load brand config');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto-save debounced
  const autoSave = useCallback(async (data: Record<string, string>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      setSaved(false);
      try {
        const res = await fetch('/api/admin/content-assistant/brand-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } catch {
        setError('Failed to save');
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, []);

  const handleTextChange = (field: string, value: string) => {
    const updateMap: Record<string, (v: string) => void> = {
      offerDescription: setOfferDescription,
      audiencePersona: setAudiencePersona,
      brandToneDescription: setBrandTone,
    };
    updateMap[field]?.(value);
    autoSave({ [field]: value });
  };

  const handlePillarsChange = (newPillars: string[]) => {
    setPillars(newPillars);
    autoSave({ keyMessagingPillars: JSON.stringify(newPillars) });
  };

  const handleFrameworkToggle = (id: string) => {
    const newFrameworks = frameworks.includes(id)
      ? frameworks.filter(f => f !== id)
      : [...frameworks, id];
    setFrameworks(newFrameworks);
    autoSave({ contentFrameworks: JSON.stringify(newFrameworks) });
  };

  const handleCtasChange = (newCtas: string[]) => {
    setCtas(newCtas);
    autoSave({ ctaOptions: JSON.stringify(newCtas) });
  };

  const addPillar = () => {
    if (newPillar.trim()) {
      handlePillarsChange([...pillars, newPillar.trim()]);
      setNewPillar('');
    }
  };

  const addCta = () => {
    if (newCta.trim()) {
      handleCtasChange([...ctas, newCta.trim()]);
      setNewCta('');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-gray-700 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Save indicator */}
      <div className="flex items-center gap-2 text-xs">
        {saving && <span className="text-amber-400">Saving...</span>}
        {saved && (
          <span className="text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Saved
          </span>
        )}
        {error && <span className="text-red-400">{error}</span>}
      </div>

      {/* Brand Identity */}
      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Brand Identity</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Offer Description</label>
            <textarea
              value={offerDescription}
              onChange={e => handleTextChange('offerDescription', e.target.value)}
              placeholder="Free app mapping 78 Tarot cards to TED talks..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-indigo-500"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Audience Persona</label>
            <textarea
              value={audiencePersona}
              onChange={e => handleTextChange('audiencePersona', e.target.value)}
              placeholder="Who is your ideal audience? Describe their interests, pain points, aspirations..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-indigo-500"
              rows={3}
            />
          </div>
        </div>
      </section>

      {/* Messaging Pillars */}
      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Messaging Pillars</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {pillars.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-3 py-1 text-xs">
              {p}
              <button onClick={() => handlePillarsChange(pillars.filter((_, j) => j !== i))} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newPillar}
            onChange={e => setNewPillar(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPillar()}
            placeholder="Add a pillar..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addPillar} className="p-1.5 text-gray-400 hover:text-indigo-400">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Tone */}
      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Brand Tone</h3>
        <textarea
          value={brandTone}
          onChange={e => handleTextChange('brandToneDescription', e.target.value)}
          placeholder="Describe your voice: warm, curious, slightly irreverent, avoids corporate jargon..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-indigo-500"
          rows={3}
        />
      </section>

      {/* Frameworks */}
      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Content Frameworks</h3>
        <div className="space-y-2">
          {ALL_FRAMEWORKS.map(fw => (
            <label key={fw.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={frameworks.includes(fw.id)}
                onChange={() => handleFrameworkToggle(fw.id)}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-300">{fw.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* CTAs */}
      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Reusable CTAs</h3>
        <div className="space-y-2 mb-2">
          {ctas.map((cta, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-gray-300">{cta}</span>
              <button onClick={() => handleCtasChange(ctas.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newCta}
            onChange={e => setNewCta(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCta()}
            placeholder="Add a CTA..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addCta} className="p-1.5 text-gray-400 hover:text-indigo-400">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
