"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ModeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  // Render a same-size placeholder to avoid layout shift
  if (!mounted) return <div className="w-8 h-8 shrink-0" />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0",
        "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
        "dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800",
        className
      )}
    >
      {isDark
        ? <Sun className="w-4 h-4" />
        : <Moon className="w-4 h-4" />
      }
    </button>
  );
}
