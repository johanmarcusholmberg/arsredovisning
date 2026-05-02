import { FileUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadProgressStateProps {
  filename: string;
  progress: number;
  statusMessage: string;
}

export function UploadProgressState({ filename, progress, statusMessage }: UploadProgressStateProps) {
  return (
    <div className="p-6 border border-border rounded-lg bg-card">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-2.5 rounded-md bg-primary/10 text-primary shrink-0">
          <FileUp className="size-5" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{filename}</p>
          <p className="text-xs text-muted-foreground">{statusMessage}</p>
        </div>
        <div className="text-sm font-medium text-foreground shrink-0">{Math.round(progress)}%</div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
