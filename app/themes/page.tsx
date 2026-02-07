import Link from 'next/link';
import { getAllThemes } from '@/lib/db/queries/themes';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Explore Themes | TarotTALKS',
  description: 'Curated collections of cards and talks for life\'s journeys',
};

// ISR: revalidate every 24 hours (theme listing rarely changes)
export const revalidate = 86400;

const themeColors: Record<string, string> = {
  'new-beginnings': 'bg-green-500',
  'grief-and-gratitude': 'bg-indigo-500',
  'transformation': 'bg-purple-500',
  'endings-and-transitions': 'bg-gray-500',
  'leadership': 'bg-rose-500',
  'creativity-and-calling': 'bg-orange-500',
  'relationships': 'bg-pink-500',
  'resilience': 'bg-blue-500',
  'joy-and-celebration': 'bg-yellow-500',
  'fear-and-courage': 'bg-red-500',
  'wisdom-and-introspection': 'bg-teal-500',
};

export default async function ThemesPage() {
  const themes = await getAllThemes();

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block text-2xl font-light text-gray-200/60 tracking-wide mb-2">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </Link>
          <p className="text-gray-400">Curated collections for life&apos;s journeys</p>
        </div>

        {/* Themes Grid */}
        <div className="grid gap-4">
          {themes.map((theme) => (
            <Link
              key={theme.id}
              href={`/themes/${theme.slug}`}
              className="bg-gray-800/50 rounded-xl p-5 shadow-sm border border-gray-700 hover:shadow-md hover:border-gray-600 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-2 h-20 rounded-full ${themeColors[theme.slug] || 'bg-indigo-500'} group-hover:scale-110 transition-transform flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-100">{theme.name}</h3>
                  </div>
                  <p className="text-gray-400 mb-3 text-sm">{theme.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{theme.cardsCount} cards</span>
                    <span>•</span>
                    <span>{theme.talksCount} talks</span>
                  </div>
                </div>
                <div className="text-gray-500 group-hover:text-indigo-400 transition-colors text-xl">
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl p-5 border border-indigo-500/30">
          <h3 className="font-semibold text-gray-100 mb-2">About Themes</h3>
          <p className="text-gray-400 text-sm">
            Each theme brings together cards and talks that speak to a particular life experience or question. Whether you&apos;re navigating a transition, seeking inspiration, or working through grief, these curated collections offer guidance and insight.
          </p>
        </div>
      </div>
    </div>
  );
}
