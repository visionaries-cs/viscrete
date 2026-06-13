import { cn } from "@/lib/utils";

export function ErrorAlert({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm", className)}>
      {message}
    </div>
  );
}

export default ErrorAlert;
