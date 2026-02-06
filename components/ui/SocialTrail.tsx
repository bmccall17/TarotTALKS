import { Twitter, Linkedin, Instagram } from 'lucide-react';

type PublicShare = {
  platform: 'x' | 'bluesky' | 'threads' | 'linkedin' | 'instagram';
  postUrl: string;
  postedAt: Date;
};

interface SocialTrailProps {
  shares: PublicShare[];
}

function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
    </svg>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-.865 1.076-2.074 1.678-3.596 1.789a5.59 5.59 0 0 1-.405.014c-1.37 0-2.537-.36-3.376-1.046-.953-.78-1.456-1.9-1.416-3.154.074-2.308 1.883-3.826 4.728-3.965 1.08-.052 2.074.026 2.968.233-.067-1.16-.44-2.03-1.116-2.6-.743-.623-1.8-.93-3.146-.915l-.047.001c-1.092.016-2.088.397-2.8 1.07a3.704 3.704 0 0 0-.855 1.266l-1.9-.744a5.606 5.606 0 0 1 1.328-1.958C8.97 4.327 10.27 3.82 11.752 3.8l.062-.001c1.755-.023 3.166.472 4.193 1.333 1.088.912 1.685 2.2 1.778 3.834.523.153 1.01.35 1.46.595 1.149.626 2.047 1.55 2.6 2.672.804 1.634.874 4.31-1.185 6.328-1.77 1.737-3.96 2.504-7.082 2.528zm-.512-6.345-.092.003c-1.869.09-2.885.909-2.924 2.135-.024.757.278 1.352.875 1.84.598.49 1.434.73 2.414.702 1.157-.084 2.046-.514 2.647-1.262.486-.605.826-1.424.99-2.38a9.2 9.2 0 0 0-3.91-1.038z" />
    </svg>
  );
}

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  x: Twitter,
  bluesky: BlueskyIcon,
  threads: ThreadsIcon,
  linkedin: Linkedin,
  instagram: Instagram,
};

function relativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'today';
  if (diffDays === 1) return '1d';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 14) return '1w';
  if (diffDays < 21) return '2w';
  if (diffDays < 28) return '3w';
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 1) return '4w';
  if (diffMonths < 12) return `${diffMonths}mo`;
  return `${Math.floor(diffMonths / 12)}y`;
}

export function SocialTrail({ shares }: SocialTrailProps) {
  if (!shares.length) return null;

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <span className="text-gray-600 text-xs">Shared on</span>
      {shares.map((share, i) => {
        const Icon = platformIcons[share.platform];
        if (!Icon) return null;
        return (
          <a
            key={i}
            href={share.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${share.platform} post from ${relativeDate(share.postedAt)}`}
            className="group flex flex-col items-center gap-0.5"
          >
            <Icon className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300 transition-colors" />
            <span className="text-[10px] text-gray-700 group-hover:text-gray-500 transition-colors">
              {relativeDate(share.postedAt)}
            </span>
          </a>
        );
      })}
    </div>
  );
}
