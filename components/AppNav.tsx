'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, LogOut, Plus } from 'lucide-react';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { getSupabase } from '@/lib/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BrandMark } from '@/components/app/BrandMark';
import { cn } from '@/lib/utils';

interface AppNavProps {
  /** Extra content (e.g. back button) to render between the logo and the right actions */
  left?: React.ReactNode;
  subtitle?: string;
}

export default function AppNav({ left, subtitle = '/ concrete inspection' }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { email } = useCurrentUser();

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.push('/login');
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/88">
      <div className="page-container flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {left}
          <BrandMark />
          {subtitle && <span className="hidden border-l pl-3 text-xs text-muted-foreground xl:block">{subtitle.replace(/^\s*\/\s*/, '')}</span>}
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <Link
            href="/inspection"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              (pathname === "/inspection" || pathname.startsWith("/sites/")) && "bg-muted text-foreground",
            )}
          >
            <ClipboardList className="size-4" />
            Sites
          </Link>
          <Link
            href="/upload"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              pathname.startsWith("/upload") && "bg-muted text-foreground",
            )}
          >
            <Plus className="size-4" />
            New inspection
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {email && (
            <span className="mr-2 hidden max-w-44 truncate text-xs text-muted-foreground lg:block">
              {email}
            </span>
          )}
          <Link
            href="/upload"
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="New inspection"
          >
            <Plus className="size-5" />
          </Link>
          <ModeToggle />
          <button
            onClick={handleLogout}
            title="Sign out"
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
