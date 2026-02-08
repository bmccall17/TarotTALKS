import Link from 'next/link';
import { getAllCards } from '@/lib/db/queries/cards';
import { CardsGrid } from '@/components/cards/CardsGrid';
import { SocialLinks } from '@/components/ui/SocialLinks';

export const metadata = {
  title: 'Browse Tarot Cards | TarotTALKS',
  description: 'Explore all 78 Tarot cards and discover their meanings',
};

// ISR: revalidate every 24 hours (cards rarely change)
export const revalidate = 86400;

export default async function CardsPage() {
  const cards = await getAllCards();

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block text-2xl font-light text-gray-200/60 tracking-wide mb-2">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </Link>
          <p className="text-gray-400">Explore the 78 cards and their wisdom</p>
        </div>

        {/* Cards Grid with Filters */}
        <CardsGrid cards={cards} />

        {/* Social Links */}
        <div className="text-center mt-8 opacity-60 hover:opacity-100 transition-opacity duration-500">
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}
