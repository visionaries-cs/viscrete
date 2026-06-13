"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModalHeader({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  badge,
  subtitle,
  onClose,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  badge?: number | string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
          {badge != null && String(badge) !== "0" && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default ModalHeader;
