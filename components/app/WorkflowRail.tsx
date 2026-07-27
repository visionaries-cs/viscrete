import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "preprocess", label: "Enhance" },
  { key: "results", label: "Review" },
  { key: "report", label: "Report" },
] as const;

export function WorkflowRail({ current }: { current: typeof STEPS[number]["key"] }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <ol className="surface-panel flex w-full overflow-x-auto p-2 sm:w-auto" aria-label="Inspection workflow">
      {STEPS.map((step, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.key} className="flex min-w-max items-center">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                active && "bg-primary text-primary-foreground",
                complete && "text-primary",
                !active && !complete && "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px]",
                active && "border-primary-foreground/35",
                complete && "border-primary bg-primary text-primary-foreground",
              )}>
                {complete ? <Check className="size-3" /> : index + 1}
              </span>
              {step.label}
            </div>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-3 bg-border sm:w-5" />}
          </li>
        );
      })}
    </ol>
  );
}
