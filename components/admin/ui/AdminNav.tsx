'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Video, Link as LinkIcon, AlertTriangle, ArrowLeft, Sparkles, BarChart3, Share2, Radio, Palette, Layers, PenLine, FlaskConical } from 'lucide-react';

export function AdminNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    // Dashboard (/admin) should only match exactly, not all admin routes
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const navLinkClass = (path: string) => {
    const base = 'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors';
    const active = 'bg-indigo-600 text-white';
    const inactive = 'text-gray-300 hover:bg-gray-800';
    return `${base} ${isActive(path) ? active : inactive}`;
  };

  return (
    <nav className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen relative z-10">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-gray-100">TarotTALKS Admin</h1>
        <p className="text-xs text-gray-500 mt-1">Content Management</p>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Curation Mode */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">
            🎨 Curation
          </h2>
          <div className="space-y-1">
            <Link href="/admin" className={navLinkClass('/admin')}>
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link href="/admin/cards" className={navLinkClass('/admin/cards')}>
              <Sparkles className="w-4 h-4" />
              <span>Cards</span>
            </Link>
            <Link href="/admin/talks" className={navLinkClass('/admin/talks')}>
              <Video className="w-4 h-4" />
              <span>Talks</span>
            </Link>
            <Link href="/admin/mappings" className={navLinkClass('/admin/mappings')}>
              <LinkIcon className="w-4 h-4" />
              <span>Mappings</span>
            </Link>
            <Link href="/admin/themes" className={navLinkClass('/admin/themes')}>
              <Palette className="w-4 h-4" />
              <span>Themes</span>
            </Link>
            <Link href="/admin/spreads" className={navLinkClass('/admin/spreads')}>
              <Layers className="w-4 h-4" />
              <span>Spreads</span>
            </Link>
          </div>
        </div>

        {/* Repair Mode */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">
            🔧 Repair
          </h2>
          <div className="space-y-1">
            <Link href="/admin/validation" className={navLinkClass('/admin/validation')}>
              <AlertTriangle className="w-4 h-4" />
              <span>Validation</span>
            </Link>
          </div>
        </div>

        {/* Analytics */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">
            📊 Analytics
          </h2>
          <div className="space-y-1">
            <Link href="/admin/behavior" className={navLinkClass('/admin/behavior')}>
              <BarChart3 className="w-4 h-4" />
              <span>Behavior</span>
            </Link>
          </div>
        </div>

        {/* Tools */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">
            🛠️ Tools
          </h2>
          <div className="space-y-1">
            <Link href="/admin/share-images" className={navLinkClass('/admin/share-images')}>
              <Share2 className="w-4 h-4" />
              <span>Share Images</span>
            </Link>
            <Link href="/admin/signal-deck" className={navLinkClass('/admin/signal-deck')}>
              <Radio className="w-4 h-4" />
              <span>Signal Deck</span>
            </Link>
            <Link href="/admin/content-lab" className={navLinkClass('/admin/content-lab')}>
              <FlaskConical className="w-4 h-4" />
              <span>Content Lab</span>
            </Link>
            <Link href="/admin/platform-style" className={navLinkClass('/admin/platform-style')}>
              <PenLine className="w-4 h-4" />
              <span>Platform Style</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Site</span>
        </Link>
      </div>
    </nav>
  );
}
