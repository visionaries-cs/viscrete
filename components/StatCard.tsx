import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({
  icon: Icon,
  label,
  value,
  color,
  children,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const cls = cn("bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col text-left", className);
  const interactive = "hover:border-blue-300 dark:hover:border-blue-600 transition group cursor-pointer";

  const inner = (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className={cn("w-4 h-4 shrink-0 text-gray-400", color, onClick && "group-hover:text-blue-500 transition")}>
          {Icon as React.ReactNode}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</span>
      </div>
      {children}
      {onClick && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 group-hover:text-blue-400 transition">
          tap to view
        </p>
      )}
    </>
  );

  if (onClick) {
    return <button onClick={onClick} className={cn(cls, interactive)}>{inner}</button>;
  }
  return <div className={cls}>{inner}</div>;
}
