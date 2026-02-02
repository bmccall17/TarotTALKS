import Link from 'next/link';
import Image from 'next/image';

const LOST_CARDS = [
  {
    name: 'The Tower',
    slug: 'the-tower',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-tower.jpg',
    message: "Well, this page has collapsed! Something broke, but hey—sometimes destruction clears the path."
  },
  {
    name: 'The Hanged Man',
    slug: 'the-hanged-man',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-hanged-man.jpg',
    message: "You're stuck in limbo! This page is suspended somewhere in the void. Time for a new perspective."
  },
  {
    name: 'The Moon',
    slug: 'the-moon',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-moon.jpg',
    message: "Lost in the fog? This page doesn't exist—or maybe it never did. Hard to tell in this light."
  },
  {
    name: 'Death',
    slug: 'death',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-death.jpg',
    message: "This page has passed on. Don't mourn it too long—transformation awaits elsewhere."
  },
  {
    name: 'Eight of Cups',
    slug: 'eight-of-cups',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/eight-of-cups.jpg',
    message: "This page walked away. Sometimes you have to leave what's empty behind."
  },
  {
    name: 'Five of Pentacles',
    slug: 'five-of-pentacles',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/five-of-pentacles.jpg',
    message: "Left out in the cold? This page isn't here, but warmth is just a click away."
  },
];

export default function NotFound() {
  // Random card selection happens at render time (server-side)
  const card = LOST_CARDS[Math.floor(Math.random() * LOST_CARDS.length)];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-light text-gray-200/60 tracking-wide">
          Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
        </h1>
      </div>

      {/* Card Container */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 mb-6">
        <div className="relative w-48 md:w-56 aspect-[5/7] rounded-lg overflow-hidden transform rotate-180">
          <Image
            src={card.image}
            alt={`${card.name} (Reversed)`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 192px, 224px"
            priority
          />
        </div>
      </div>

      {/* Card Name */}
      <h2 className="text-xl md:text-2xl font-semibold text-gray-100 mb-3">
        {card.name} <span className="text-gray-400 font-normal">(Reversed)</span>
      </h2>

      {/* Card Message */}
      <p className="text-gray-400 text-center max-w-md mb-8 leading-relaxed">
        &ldquo;{card.message}&rdquo;
      </p>

      {/* 404 Display */}
      <div className="text-6xl md:text-8xl font-bold text-gray-700/50 tracking-[0.3em] mb-10">
        404
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-center"
        >
          Return Home
        </Link>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-600 hover:border-gray-500 hover:bg-gray-800/30 text-gray-300 hover:text-gray-200 font-medium rounded-xl transition-all text-center"
        >
          Draw a Card
        </Link>
      </div>
    </div>
  );
}
