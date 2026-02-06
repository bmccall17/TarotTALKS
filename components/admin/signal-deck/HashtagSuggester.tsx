'use client';

import { useState, useMemo } from 'react';
import { Hash, Copy, Check } from 'lucide-react';

type Props = {
  cardName?: string;
  talkTitle?: string;
  speakerName?: string;
};

const HASHTAG_POOLS = {
  tarot: [
    'tarot', 'tarotcards', 'tarotreading', 'tarotcommunity', 'dailytarot',
    'tarotinsights', 'tarotguidance', 'tarotwisdom', 'modernmystic', 'spiritualtarot',
  ],
  ted: [
    'tedtalk', 'tedtalks', 'tedx', 'ideas', 'ideasworthspreading',
    'tedtalkdaily', 'tedxtalks', 'inspiration', 'learning',
  ],
  spirituality: [
    'spirituality', 'mindfulness', 'selfdiscovery', 'innerwork', 'soulwork',
    'spiritualgrowth', 'consciousness', 'healing', 'intuition', 'mysticism',
  ],
  growth: [
    'personalgrowth', 'selfdevelopment', 'motivation', 'transformation',
    'growthmindset', 'empowerment', 'lifelessons', 'wisdom', 'reflection',
  ],
  brand: [
    'tarottalks', 'tarotmeetsideas', 'cardsandtalks', 'tarotandted',
  ],
};

// Card-specific keywords for smarter suggestions
const CARD_HASHTAGS: Record<string, string[]> = {
  'the fool': ['newbeginnings', 'leapoffaith', 'adventure', 'freshstart'],
  'the magician': ['manifestation', 'willpower', 'creativity', 'alchemy'],
  'the high priestess': ['intuition', 'mystery', 'innerwisdom', 'subconscious'],
  'the empress': ['abundance', 'nurturing', 'fertility', 'nature'],
  'the emperor': ['authority', 'structure', 'leadership', 'discipline'],
  'the hierophant': ['tradition', 'spiritualteacher', 'beliefs', 'conformity'],
  'the lovers': ['love', 'choices', 'relationships', 'harmony'],
  'the chariot': ['determination', 'victory', 'willpower', 'momentum'],
  'strength': ['courage', 'patience', 'innerstrength', 'compassion'],
  'the hermit': ['solitude', 'introspection', 'innerguidance', 'seeking'],
  'wheel of fortune': ['destiny', 'change', 'cycles', 'luck'],
  'justice': ['truth', 'fairness', 'balance', 'karma'],
  'the hanged man': ['surrender', 'newperspective', 'letting go', 'pause'],
  'death': ['transformation', 'endings', 'rebirth', 'change'],
  'temperance': ['balance', 'patience', 'moderation', 'healing'],
  'the devil': ['shadow', 'temptation', 'bondage', 'liberation'],
  'the tower': ['upheaval', 'breakthrough', 'revelation', 'awakening'],
  'the star': ['hope', 'inspiration', 'renewal', 'faith'],
  'the moon': ['illusion', 'dreams', 'subconscious', 'mystery'],
  'the sun': ['joy', 'success', 'vitality', 'positivity'],
  'judgement': ['awakening', 'rebirth', 'calling', 'absolution'],
  'the world': ['completion', 'wholeness', 'achievement', 'integration'],
};

export function HashtagSuggester({ cardName, talkTitle, speakerName }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const suggestions = useMemo(() => {
    const tags: string[] = [];

    // Always include brand tags
    tags.push(...HASHTAG_POOLS.brand);

    // Add card-specific tags
    if (cardName) {
      const normalizedName = cardName.toLowerCase();
      const cardTags = CARD_HASHTAGS[normalizedName];
      if (cardTags) tags.push(...cardTags);
    }

    // Mix in category pools
    tags.push(
      ...HASHTAG_POOLS.tarot.slice(0, 5),
      ...HASHTAG_POOLS.ted.slice(0, 4),
      ...HASHTAG_POOLS.spirituality.slice(0, 3),
      ...HASHTAG_POOLS.growth.slice(0, 3)
    );

    // Deduplicate and cap at 20
    return [...new Set(tags)].slice(0, 20);
  }, [cardName]);

  const toggleTag = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleCopy = async () => {
    const hashtagString = [...selected].map((t) => `#${t}`).join(' ');
    await navigator.clipboard.writeText(hashtagString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <Hash className="w-3.5 h-3.5" />
          Hashtag Suggestions
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 rounded transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : `Copy ${selected.size}`}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              selected.has(tag)
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}
