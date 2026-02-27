import Link from 'next/link';
import { getAllTalks } from '@/lib/db/queries/talks';
import { TalksGrid } from '@/components/talks/TalksGrid';
import { SocialLinks } from '@/components/ui/SocialLinks';

export const metadata = {
  title: 'Browse TED Talks | TarotTALKS',
  description: 'Explore curated TED talks mapped to Tarot archetypes',
};

// Dynamic rendering — skip build-time static generation to avoid DB timeout
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function TalksPage() {
  const talks = await getAllTalks();

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block text-2xl font-light text-gray-200/60 tracking-wide mb-2">
            Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
          </Link>
          <p className="text-gray-400">Discover wisdom through curated TED talks</p>
        </div>

        {/* Talks Grid with Filters */}
        <TalksGrid talks={talks} />

        {/* Social Links */}
        <div className="text-center mt-8 opacity-60 hover:opacity-100 transition-opacity duration-500">
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}
