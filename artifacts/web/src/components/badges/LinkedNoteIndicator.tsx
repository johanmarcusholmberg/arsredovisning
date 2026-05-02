import { Link } from "lucide-react";

interface LinkedNoteIndicatorProps {
  noteNumber: number;
  className?: string;
}

export function LinkedNoteIndicator({ noteNumber, className = "" }: LinkedNoteIndicatorProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-blue-500 ${className}`}>
      <Link className="size-3" />
      <span>Refereras i Not {noteNumber}</span>
    </span>
  );
}
