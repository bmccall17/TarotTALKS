import Link from 'next/link';
import Image from 'next/image';

// Force dynamic rendering so randomization works on each request
export const dynamic = 'force-dynamic';

const LOST_CARDS = [
  {
    name: 'The Tower',
    slug: 'the-tower',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-tower.jpg',
    message: "Well, this page has collapsed! Something broke, but hey—sometimes destruction clears the path.",
    buttonText: "Rise from the rubble"
  },
  {
    name: 'The Hanged Man',
    slug: 'the-hanged-man',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-hanged-man.jpg',
    message: "You're stuck in limbo! This page is suspended somewhere in the void. Time for a new perspective.",
    buttonText: "Find a new view"
  },
  {
    name: 'The Moon',
    slug: 'the-moon',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/the-moon.jpg',
    message: "Lost in the fog? This page doesn't exist—or maybe it never did. Hard to tell in this light.",
    buttonText: "Step into the light"
  },
  {
    name: 'Death',
    slug: 'death',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/death.jpg',
    message: "This page has passed on. Don't mourn it too long—transformation awaits elsewhere.",
    buttonText: "Begin again"
  },
  {
    name: 'Eight of Cups',
    slug: 'eight-of-cups',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/eight-of-cups.jpg',
    message: "This page walked away. Sometimes you have to leave what's empty behind.",
    buttonText: "Move forward"
  },
  {
    name: 'Five of Pentacles',
    slug: 'five-of-pentacles',
    image: 'https://hldbacbxyosqpbsataqt.supabase.co/storage/v1/object/public/card-images/five-of-pentacles.jpg',
    message: "Left out in the cold? This page isn't here, but warmth is just a click away.",
    buttonText: "Come inside"
  },
];

export default function NotFound() {
  const card = LOST_CARDS[Math.floor(Math.random() * LOST_CARDS.length)];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-light text-gray-200/60 tracking-wide">
          Tarot<span className="font-bold text-[#EB0028]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>TALKS</span>
        </h1>
      </div>

      {/* Card Image - clickable, reversed, matching landing page sizing */}
      <Link
        href={`/cards/${card.slug}`}
        className="relative w-[200px] h-[340px] md:w-[220px] md:h-[370px] rounded-xl overflow-hidden transform rotate-180 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/40 transition-shadow mb-6 block"
      >
        <Image
          src={card.image}
          alt={`${card.name} (Reversed)`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 200px, 220px"
          priority
        />
      </Link>

      {/* Card Name */}
      <h2 className="text-xl md:text-2xl font-semibold text-gray-100 mb-3">
        {card.name} <span className="text-gray-400 font-normal">(Reversed)</span>
      </h2>

      {/* Card Message - no quotes */}
      <p className="text-gray-400 text-center max-w-md mb-8 leading-relaxed">
        {card.message}
      </p>

      {/* 404 Display */}
      <div className="text-6xl md:text-8xl font-bold text-gray-700/50 tracking-[0.3em] mb-10">
        404
      </div>

      {/* Single Card-Specific Button */}
      <Link
        href="/"
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-center"
      >
        {card.buttonText}
      </Link>
    </div>
  );
}
