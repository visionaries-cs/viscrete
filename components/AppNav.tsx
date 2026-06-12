'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { getSupabase } from '@/lib/supabase';

interface AppNavProps {
  /** Extra content (e.g. back button) to render between the logo and the right actions */
  left?: React.ReactNode;
  subtitle?: string;
}

export default function AppNav({ left, subtitle = '/ concrete inspection' }: AppNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.push('/login');
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50
                       border-b border-gray-200 dark:border-gray-800
                       bg-white/80 dark:bg-[#111]/80 backdrop-blur-md">
      <div className="container max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: logo + optional slot */}
        <div className="flex items-center gap-3 min-w-0">
          {left}
          <Link href="/" className="flex items-center gap-2 select-none shrink-0">
            <span className="text-sm font-bold font-mono tracking-tight
                             bg-gradient-to-r from-[#2ca75d] to-[#0da6f2]
                             bg-clip-text text-transparent">
              viscrete
            </span>
            {subtitle && (
              <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono">
                {subtitle}
              </span>
            )}
          </Link>
        </div>

        {/* Right: theme toggle + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <ModeToggle />
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400
                       dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800
                       transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
