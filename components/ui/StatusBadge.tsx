import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  validating: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  validated: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  preprocessing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  preprocessed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  detecting: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  detected: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  reporting: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  valid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  invalid: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  sharp: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  blurry: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", className)}>
      {status}
    </span>
  );
}

export default StatusBadge;
