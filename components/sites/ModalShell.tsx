"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full bg-white dark:bg-[#161616] rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[80vh]",
          maxWidth,
        )}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default ModalShell;
