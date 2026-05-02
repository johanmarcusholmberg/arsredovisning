import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "not-started" | "current" | "completed" | "needs-review" | "blocked";

export interface WorkflowStep {
  id: string;
  label: string;
  status: StepStatus;
}

const DEFAULT_STEPS: WorkflowStep[] = [
  { id: "import", label: "Import accounting data", status: "not-started" },
  { id: "mapping", label: "Review account mapping", status: "not-started" },
  { id: "structure", label: "Generate report structure", status: "not-started" },
  { id: "statements", label: "Review financial statements", status: "not-started" },
  { id: "notes", label: "Review notes", status: "not-started" },
  { id: "validate", label: "Validate", status: "not-started" },
  { id: "collaborate", label: "Collaborate & review", status: "not-started" },
  { id: "preview", label: "Preview", status: "not-started" },
  { id: "export", label: "Final export", status: "not-started" },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "current") return <Clock className="h-4 w-4 text-primary shrink-0 animate-pulse" />;
  if (status === "needs-review") return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
  if (status === "blocked") return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}

interface WorkflowProgressProps {
  steps?: WorkflowStep[];
  currentStepId?: string;
  completedStepIds?: string[];
  className?: string;
}

export function WorkflowProgress({
  steps,
  currentStepId,
  completedStepIds = [],
  className,
}: WorkflowProgressProps) {
  const resolvedSteps = (steps ?? DEFAULT_STEPS).map((step) => ({
    ...step,
    status: completedStepIds.includes(step.id)
      ? ("completed" as StepStatus)
      : step.id === currentStepId
        ? ("current" as StepStatus)
        : step.status,
  }));

  const completedCount = resolvedSteps.filter((s) => s.status === "completed").length;
  const total = resolvedSteps.length;
  const percent = Math.round((completedCount / total) * 100);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium text-muted-foreground">Workflow progress</span>
        <span className="font-mono text-xs text-muted-foreground">
          {completedCount}/{total}
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="space-y-1">
        {resolvedSteps.map((step, idx) => (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
              step.status === "current" && "bg-primary/5 text-primary font-medium",
              step.status === "completed" && "text-muted-foreground",
              step.status === "needs-review" && "bg-amber-500/5 text-amber-700",
              step.status === "blocked" && "bg-destructive/5 text-destructive",
              step.status === "not-started" && "text-muted-foreground/60",
            )}
          >
            <span className="text-xs font-mono w-4 text-center shrink-0 opacity-50">
              {idx + 1}
            </span>
            <StepIcon status={step.status} />
            <span className="truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
