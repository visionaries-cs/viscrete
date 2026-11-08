'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, LogOut } from 'lucide-react';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { getSupabase } from '@/lib/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { trackVisit, canGoBack, resetVisits } from '@/lib/navHistory';

interface AppNavProps {
  /** Where Back goes when there is no in-app page to return to (fresh tab, direct link). */
  back: string;
  /** Mono label after the brand, e.g. "sites" → "viscrete / sites". */
  section?: string;
  /** Page title shown after a divider (e.g. site name, "Detection Results"). */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Page-specific buttons, placed before the account controls. */
  actions?: React.ReactNode;
  /** Extra row inside the sticky header (e.g. a filter bar). */
  children?: React.ReactNode;
  /** Sign-in pages: hide email / sign out, show "How to Use". */
  guest?: boolean;
}

export default function AppNav({ back, section = 'concrete inspection', title, subtitle, actions, children, guest = false }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { email } = useCurrentUser();

  useEffect(() => {
    if (guest) resetVisits();
    else trackVisit(pathname);
  }, [pathname, guest]);

  function goBack() {
    if (!guest && canGoBack()) { router.back(); return; }
    // Nothing in-app to return to: go up to the parent page, replacing this entry so
    // the next Back doesn't bounce down here again.
    resetVisits();
    router.replace(back);
  }

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800
                       bg-white/80 dark:bg-[#111]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto h-14 px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
        <button
          onClick={goBack}
          aria-label="Go back"
          title="Back"
          className="shrink-0 p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100
                     dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Link href="/" className="flex items-baseline gap-2 select-none shrink-0">
          <span className="text-sm font-bold font-mono tracking-tight
                           bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent">
            viscrete
          </span>
          {section && (
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono">/ {section}</span>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          {(title || subtitle) && (
            <div className="border-l border-gray-200 dark:border-gray-800 pl-2 sm:pl-3 min-w-0">
              {title && <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h1>}
              {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</div>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}
          {guest ? (
            <Link href="/instructions"
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              How to Use
            </Link>
          ) : email && (
            <span className="hidden lg:block text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[160px]">
              {email}
            </span>
          )}
          <ModeToggle />
          {!guest && (
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400
                         dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}
