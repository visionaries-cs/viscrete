import { cn } from "@/lib/utils";

export function FilterPillGroup({
  options,
  selected,
  onChange,
  className,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center flex-wrap gap-2", className)}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium transition shrink-0",
            selected === opt.value
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default FilterPillGroup;
