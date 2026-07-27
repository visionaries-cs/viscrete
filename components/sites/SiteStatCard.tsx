"use client";

import { cn } from "@/lib/utils";

export function SiteStatCard({
  label,
  value,
  icon: Icon,
  onClick,
  children,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const cls = "surface-panel min-h-28 p-4 sm:p-5 flex flex-col text-left";
  const interactive = "hover:border-primary/35 hover:-translate-y-0.5 transition-[border-color,transform,box-shadow] group";

  const inner = (
    <>
      <p className="section-kicker mb-3">{label}</p>
      <div className="flex items-center gap-2.5">
        <Icon className={cn("size-4 shrink-0 text-muted-foreground", onClick && "group-hover:text-primary transition")} />
        <span className="data-value truncate text-lg font-semibold">{value}</span>
      </div>
      {children}
      {onClick && (
        <p className="mt-auto pt-3 text-[11px] font-medium text-muted-foreground transition group-hover:text-primary">
          View details
        </p>
      )}
    </>
  );

  if (onClick) {
    return <button onClick={onClick} className={cn(cls, interactive)}>{inner}</button>;
  }
  return <div className={cls}>{inner}</div>;
}

export default SiteStatCard;
