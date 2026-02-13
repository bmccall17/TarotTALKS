'use client';

import { AdminNav } from '@/components/admin/ui/AdminNav';
import { ClickDebugger } from '@/components/admin/ui/ClickDebugger';
import { Monitor } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-dyslexic-font flex min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900">
      <AdminNav />
      <ClickDebugger />
      <main className="flex-1 overflow-auto">
        {/* Mobile Notice - shown only on small screens */}
        <div className="lg:hidden bg-amber-500/20 border-b border-amber-500/30 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-300 text-sm">
            <Monitor className="w-4 h-4 flex-shrink-0" />
            <span>Admin portal is optimized for desktop. Some features may be limited on mobile.</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
