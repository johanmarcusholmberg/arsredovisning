import React from "react";
import { Check, AlertCircle, AlertTriangle, Circle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export type StepState = "not-started" | "current" | "completed" | "needs-review" | "blocked";

export interface WorkflowStep {
  id: string;
  label: string;
  state: StepState;
}

interface WorkflowProgressProps {
  steps: WorkflowStep[];
}

export function WorkflowProgress({ steps }: WorkflowProgressProps) {
  const { t } = useLanguage();

  return (
    <div className="w-full">
      {/* Desktop Stepper */}
      <div className="hidden md:flex items-center w-full">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div key={step.id} className={`flex items-center ${!isLast ? "flex-1" : ""}`}>
              <div className="relative flex flex-col items-center group">
                <StepIcon state={step.state} />
                <div className="absolute top-8 w-24 text-center">
                  <span className="text-[10px] font-medium text-muted-foreground whitespace-normal">
                    {step.label}
                  </span>
                </div>
              </div>
              {!isLast && (
                <div
                  className={`h-[2px] w-full mx-2 flex-1 rounded-full ${
                    step.state === "completed" ? "bg-green-500/50" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper */}
      <div className="flex md:hidden flex-col gap-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div key={step.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <StepIcon state={step.state} />
                {!isLast && (
                  <div
                    className={`w-[2px] h-full my-1 rounded-full ${
                      step.state === "completed" ? "bg-green-500/50" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <div className="pt-1 pb-4">
                <span className="text-sm font-medium text-foreground">{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Add some padding to bottom on desktop for the absolute text */}
      <div className="hidden md:block h-10" />
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "completed":
      return (
        <div className="flex items-center justify-center size-6 rounded-full bg-green-50 border border-green-200 text-green-600 shadow-sm z-10 bg-background">
          <Check className="size-3.5" />
        </div>
      );
    case "current":
      return (
        <div className="flex items-center justify-center size-6 rounded-full border-2 border-primary bg-background shadow-sm z-10">
          <div className="size-2 rounded-full bg-primary" />
        </div>
      );
    case "needs-review":
      return (
        <div className="flex items-center justify-center size-6 rounded-full bg-amber-50 border border-amber-200 text-amber-600 shadow-sm z-10 bg-background">
          <AlertTriangle className="size-3.5" />
        </div>
      );
    case "blocked":
      return (
        <div className="flex items-center justify-center size-6 rounded-full bg-red-50 border border-red-200 text-red-600 shadow-sm z-10 bg-background">
          <AlertCircle className="size-3.5" />
        </div>
      );
    case "not-started":
    default:
      return (
        <div className="flex items-center justify-center size-6 rounded-full border border-border bg-muted/30 text-muted-foreground shadow-sm z-10 bg-background">
          <Circle className="size-3.5" />
        </div>
      );
  }
}
